import { SiteClock } from '@/core/database/siteClock.js'
import { AntMediaRestApiBaseController } from '@/modules/Antmedia/Controllers/AntMediaRestApiBaseController.js'
import { PERMANENT_STORAGE_LIMIT_BYTES } from '@/modules/Storage/Services/permanentStorageConstants.js'
import { StreamPermanentStorageRepository } from '@/modules/Storage/Data/Repositories/StreamPermanentStorageRepository.js'
import { ScheduleRepository } from '@/modules/Schedules/Data/Repositories/ScheduleRepository.js'
import { ScheduleRecordingHistoryRepository } from '@/modules/Schedules/Data/Repositories/ScheduleRecordingHistoryRepository.js'
import {
  buildLiveStartWindowBounds,
  enrichStartCandidates,
  filterPermanentStorageQuota,
  scheduledStartKey,
  type StartCandidateRow,
} from '@/modules/Recordings/Services/startRecordingCandidateLogic.js'

/**
 * Start-recording job: SQL candidates → RRULE window [now, now+5m] → permanent cap →
 * dedupe by history → insert start rows → Ant Media → patch history.
 */
export async function runStartRecordingScript() {
  const t0 = performance.now()
  const payload = await main()
  payload.execution_time_ms = Math.round((performance.now() - t0) * 100) / 100
  return payload
}

async function main(): Promise<{
  success: boolean
  execution_time_ms: number
  schedules_found: number
  schedules: StartCandidateRow[]
  timestamp: string
  api_results: unknown
}> {
  const { nowWall, nowDt, windowEndDt } = buildLiveStartWindowBounds()

  // 1) Rows whose first_start is already in the DB window; still need RRULE pass for recurring.
  const sqlCandidates = await ScheduleRepository.getSchedulesToStartCandidates()
  const afterOccurrence = enrichStartCandidates(sqlCandidates, nowDt, windowEndDt)

  // 2) Permanent-storage schedules skip when that post is full (others continue).
  const permanentPosts = collectPermanentPostIds(afterOccurrence)
  const permanentBytes =
    permanentPosts.length > 0
      ? await StreamPermanentStorageRepository.sumPermanentBytesForPosts(permanentPosts)
      : {}
  const afterQuota = filterPermanentStorageQuota(
    afterOccurrence,
    permanentBytes,
    PERMANENT_STORAGE_LIMIT_BYTES,
  )

  // 3) Skip if we already logged a start for this occurrence (idempotent cron).
  const readyToLog = await excludeSchedulesWithExistingStart(afterQuota)

  // 4) History first, then origin API.
  const historyIds = await insertStartHistoryRows(readyToLog, nowWall)

  const apiResults = await startRecordingOnStreams(readyToLog, historyIds)

  return {
    success: true,
    execution_time_ms: 0,
    schedules_found: readyToLog.length,
    schedules: readyToLog,
    timestamp: nowWall,
    api_results: apiResults,
  }
}

function collectPermanentPostIds(schedules: StartCandidateRow[]) {
  const ids: number[] = []
  for (const s of schedules) {
    if (s.permanent_status != null && Number(s.permanent_status) === 1 && s.post_id) {
      ids.push(Number(s.post_id))
    }
  }
  return ids
}

async function excludeSchedulesWithExistingStart(schedules: StartCandidateRow[]) {
  const ready: StartCandidateRow[] = []
  for (const schedule of schedules) {
    const startKey = scheduledStartKey(schedule)
    const exists = await ScheduleRecordingHistoryRepository.hasStartForOccurrence(schedule.id, startKey)
    if (!exists) ready.push(schedule)
  }
  return ready
}

function startHistoryInsertPayload(schedule: StartCandidateRow, nowWall: string) {
  return {
    schedule_id: Number(schedule.id),
    post_id: Number(schedule.post_id),
    stream_id: schedule.stream_id,
    event_type: 'start' as const,
    event_datetime: nowWall,
    scheduled_start: String(schedule._occurrence_start ?? schedule.first_start),
    scheduled_end: String(schedule._occurrence_end ?? schedule.first_end),
    schedule_name: schedule.schedule_name ?? '',
    is_recurring: !!(schedule.is_recurring && Number(schedule.is_recurring) === 1),
    recurring_rule: schedule.recurring_rule ?? null,
    is_timetable: !!(schedule.is_timetable && Number(schedule.is_timetable) === 1),
    timetable_name: schedule.timetable_name ?? null,
    recording_password: schedule.recording_password ?? null,
    password_protected: !!(schedule.password_protected && Number(schedule.password_protected) === 1),
    origin_api_success: null,
    origin_api_response: null,
    origin_api_error: null,
    cronjob_run_datetime: nowWall,
  }
}

/** Inserts `event_type: start` rows; returns map schedule_id → history id for API correlation. */
async function insertStartHistoryRows(schedules: StartCandidateRow[], nowWall: string) {
  const historyIds: Record<number, number> = {}
  for (const schedule of schedules) {
    const hid = await ScheduleRecordingHistoryRepository.create(startHistoryInsertPayload(schedule, nowWall))
    if (hid) historyIds[Number(schedule.id)] = Number(hid)
  }
  return historyIds
}

async function startRecordingOnStreams(schedules: StartCandidateRow[], historyIds: Record<number, number>) {
  const streamIds = [...new Set(schedules.map((s) => s.stream_id).filter(Boolean))] as string[]
  if (streamIds.length === 0) return null

  const ant = new AntMediaRestApiBaseController()
  await ant.changeRecordingStatusForMultipleStreamsV2('false', streamIds)
  const apiResults = await ant.changeRecordingStatusForMultipleStreamsV2('true', streamIds)

  await mergeAntResultsIntoHistory(apiResults, historyIds)
  return apiResults
}

async function mergeAntResultsIntoHistory(apiResults: unknown, historyIds: Record<number, number>) {
  const results = (apiResults as any)?.results ?? {}
  for (const sid of Object.keys(historyIds)) {
    const scheduleId = Number(sid)
    const histId = historyIds[scheduleId]
    const row = await ScheduleRepository.getById(scheduleId)
    const streamId = row?.stream_id != null ? String(row.stream_id) : ''
    if (!streamId || results[streamId] === undefined) continue
    const result = results[streamId]
    await ScheduleRecordingHistoryRepository.updateById(histId, {
      origin_api_success: result.success ? 1 : 0,
      origin_api_response: result.response ?? null,
      origin_api_error: result.error ?? null,
    })
  }
}
