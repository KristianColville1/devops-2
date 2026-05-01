import { RRule } from '@/core/rrule/rruleExports.js'
import { SiteClock } from '@/core/database/siteClock.js'

export function normalizeRruleBody(rule: string) {
  let r = rule.trim()
  if (r.toUpperCase().startsWith('RRULE:')) r = r.slice(6)
  return r
}

/** True when `repeat_until` (date) is entirely before `now` (end-of-day on that date). */
export function isRepeatUntilExpired(schedule: Record<string, any>, now: Date) {
  const ru = schedule.repeat_until
  if (!ru) return false
  const end = SiteClock.mysqlWallToDate(String(ru))
  end.setHours(23, 59, 59, 999)
  return end < now
}

/**
 * First recurrence start in [windowStart, windowEnd] for a recurring row; occurrence end uses
 * the duration from `first_start` to `first_end`.
 */
export function recurringOccurrenceInWindow(
  schedule: Record<string, any>,
  windowStart: Date,
  windowEnd: Date,
): { occurrenceStart: string; occurrenceEnd: string } | null {
  if (!schedule.recurring_rule || !schedule.first_start || !schedule.first_end) return null

  const dtstart = SiteClock.mysqlWallToDate(String(schedule.first_start))
  const firstEndWall = SiteClock.mysqlWallToDate(String(schedule.first_end))
  const durationMs = Math.max(0, firstEndWall.getTime() - dtstart.getTime())

  const ruleBody = normalizeRruleBody(String(schedule.recurring_rule))
  const parsed = RRule.parseString(ruleBody)
  const rule = new RRule({ ...parsed, dtstart })

  const hits = rule.between(windowStart, windowEnd, true)
  if (hits.length === 0) return null

  const startDt = hits[0]
  const endDt = new Date(startDt.getTime() + durationMs)
  return {
    occurrenceStart: SiteClock.formatMysql(startDt),
    occurrenceEnd: SiteClock.formatMysql(endDt),
  }
}
