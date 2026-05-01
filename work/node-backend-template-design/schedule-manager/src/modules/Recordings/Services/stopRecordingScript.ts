import { SiteClock } from '@/core/database/siteClock.js'
import { AntMediaRestApiBaseController } from '@/modules/Antmedia/Controllers/AntMediaRestApiBaseController.js'
import { ScheduleRecordingHistoryRepository } from '@/modules/Schedules/Data/Repositories/ScheduleRecordingHistoryRepository.js'
import {
  filterStartEventsEligibleToStop,
  type HistoryStartEventRow,
} from '@/modules/Recordings/Services/stopRecordingLogic.js'

/**
 * Stop-recording job: open start rows in history → due by `scheduled_end` in the last 5 minutes →
 * insert stop rows → Ant Media (and optional restart before 17:00 site hour) → patch history.
 */
export async function runStopRecordingScript() {
  const t0 = performance.now()
  const payload = await main()
  payload.execution_time_ms = Math.round((performance.now() - t0) * 100) / 100
  return payload
}

async function main() {
  const nowWall = SiteClock.mysqlNow()
  const nowDt = SiteClock.mysqlWallToDate(nowWall)

  const openStarts = await ScheduleRecordingHistoryRepository.getStartEventsWithoutStops()
  const due = filterStartEventsEligibleToStop(openStarts, nowDt)

  if (due.length === 0) {
    return {
      success: true,
      message: openStarts.length === 0 ? 'No recordings to stop' : 'No recordings ready to stop',
      stopped: 0,
      execution_time_ms: 0,
      timestamp: nowWall,
      api_results: null as unknown,
    }
  }

  const historyIds = await insertStopHistoryRows(due, nowWall)
  const apiResults = await stopStreamsOnAntMedia(due, historyIds)

  return {
    success: true,
    execution_time_ms: 0,
    stopped: due.length,
    events: due.map((ev) => ({ start_event: ev })),
    timestamp: nowWall,
    api_results: apiResults,
  }
}

function stopHistoryInsertPayload(se: HistoryStartEventRow, nowWall: string) {
  return {
    schedule_id: Number(se.schedule_id),
    post_id: Number(se.post_id),
    stream_id: se.stream_id,
    event_type: 'stop' as const,
    event_datetime: nowWall,
    scheduled_start: String(se.scheduled_start),
    scheduled_end: String(se.scheduled_end),
    schedule_name: se.schedule_name ?? '',
    is_recurring: !!(se.is_recurring && Number(se.is_recurring) === 1),
    recurring_rule: se.recurring_rule ?? null,
    is_timetable: !!(se.is_timetable && Number(se.is_timetable) === 1),
    timetable_name: se.timetable_name ?? null,
    recording_password: se.recording_password ?? null,
    password_protected: !!(se.password_protected && Number(se.password_protected) === 1),
    origin_api_success: null,
    origin_api_response: null,
    origin_api_error: null,
    cronjob_run_datetime: nowWall,
  }
}

async function insertStopHistoryRows(events: HistoryStartEventRow[], nowWall: string) {
  const historyIds: Record<number, number> = {}
  for (const se of events) {
    const hid = await ScheduleRecordingHistoryRepository.create(stopHistoryInsertPayload(se, nowWall))
    if (hid) historyIds[Number(se.schedule_id)] = Number(hid)
  }
  return historyIds
}

async function stopStreamsOnAntMedia(due: HistoryStartEventRow[], historyIds: Record<number, number>) {
  const streamIds = [...new Set(due.map((w) => w.stream_id).filter(Boolean))] as string[]
  if (streamIds.length === 0) return null

  const ant = new AntMediaRestApiBaseController()
  const stopResults = await ant.changeRecordingStatusForMultipleStreamsV2('false', streamIds)

  const hour = SiteClock.siteHourFromMysqlClock()
  let restart: unknown = null
  if (hour < 17) {
    restart = await ant.changeRecordingStatusForMultipleStreamsV2('true', streamIds)
  }

  const apiResults = { stop: stopResults, restart }

  const stopSummary = (stopResults as any)?.results ?? {}
  for (const scheduleIdStr of Object.keys(historyIds)) {
    const scheduleId = Number(scheduleIdStr)
    const histId = historyIds[scheduleId]
    const row = due.find((w) => Number(w.schedule_id) === scheduleId)
    const streamId = row?.stream_id
    if (!streamId || !stopSummary[streamId]) continue
    const result = stopSummary[streamId]
    await ScheduleRecordingHistoryRepository.updateById(histId, {
      origin_api_success: result.success ? 1 : 0,
      origin_api_response: result.response ?? null,
      origin_api_error: result.error ?? null,
    })
  }

  return apiResults
}
