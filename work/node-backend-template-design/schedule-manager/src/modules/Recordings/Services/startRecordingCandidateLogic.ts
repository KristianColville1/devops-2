import { SiteClock } from '@/core/database/siteClock.js'
import {
  isRepeatUntilExpired,
  recurringOccurrenceInWindow,
} from '@/modules/Recordings/Services/recordingScheduleOccurrences.js'

/** Row from `getSchedulesToStartCandidates` plus optional `_occurrence_*` after enrichment. */
export type StartCandidateRow = Record<string, any>

/**
 * Live cron window: `now` through `mysqlNow()+5m`, both parsed with {@link SiteClock.mysqlWallToDate}.
 */
export function buildLiveStartWindowBounds() {
  const nowWall = SiteClock.mysqlNow()
  const nowDt = SiteClock.mysqlWallToDate(nowWall)
  const windowEndWall = SiteClock.plusMinutes(5)
  const windowEndDt = SiteClock.mysqlWallToDate(windowEndWall)
  return { nowWall, nowDt, windowEndWall, windowEndDt }
}

/** Explicit bounds for tests or tooling (no reliance on real clock). */
export function buildStartWindowBoundsFromMysql(nowMysql: string, windowEndMysql: string) {
  return {
    nowDt: SiteClock.mysqlWallToDate(nowMysql),
    windowEndDt: SiteClock.mysqlWallToDate(windowEndMysql),
  }
}

export function scheduleHasStreamId(schedule: StartCandidateRow) {
  return schedule.stream_id != null && String(schedule.stream_id).trim() !== ''
}

export function scheduleIsRecurring(schedule: StartCandidateRow) {
  return schedule.is_recurring != null && Number(schedule.is_recurring) === 1
}

/**
 * One DB candidate → enriched row with `_occurrence_start` / `_occurrence_end`, or `null` if this
 * run should not start it (wrong recurrence window, bad RRULE, expired repeat, etc.).
 */
export function enrichSingleStartCandidate(
  schedule: StartCandidateRow,
  nowDt: Date,
  windowEndDt: Date,
): StartCandidateRow | null {
  if (!scheduleHasStreamId(schedule)) return null

  if (!scheduleIsRecurring(schedule)) {
    const copy = { ...schedule }
    copy._occurrence_start = schedule.first_start
    copy._occurrence_end = schedule.first_end
    return copy
  }

  if (!schedule.recurring_rule || !schedule.first_start) return null
  if (isRepeatUntilExpired(schedule, nowDt)) return null

  try {
    const occ = recurringOccurrenceInWindow(schedule, nowDt, windowEndDt)
    if (!occ) return null
    const copy = { ...schedule }
    copy._occurrence_start = occ.occurrenceStart
    copy._occurrence_end = occ.occurrenceEnd
    return copy
  } catch {
    return null
  }
}

/** Applies {@link enrichSingleStartCandidate} to each candidate (same order; drops nulls). */
export function enrichStartCandidates(
  candidates: StartCandidateRow[],
  nowDt: Date,
  windowEndDt: Date,
): StartCandidateRow[] {
  const out: StartCandidateRow[] = []
  for (const row of candidates) {
    const enriched = enrichSingleStartCandidate(row, nowDt, windowEndDt)
    if (enriched) out.push(enriched)
  }
  return out
}

/** Drops permanent-retention rows when that post is already at/over the byte cap. */
export function filterPermanentStorageQuota(
  schedules: StartCandidateRow[],
  permanentBytesByPostId: Record<number, number>,
  limitBytes: number,
): StartCandidateRow[] {
  const filtered: StartCandidateRow[] = []
  for (const schedule of schedules) {
    const wantPerm =
      schedule.permanent_status != null && Number(schedule.permanent_status) === 1
    const pid = Number(schedule.post_id)
    if (wantPerm && pid > 0 && (permanentBytesByPostId[pid] ?? 0) >= limitBytes) {
      continue
    }
    filtered.push(schedule)
  }
  return filtered
}

export function scheduledStartKey(schedule: StartCandidateRow) {
  return String(schedule._occurrence_start ?? schedule.first_start)
}
