import { SiteClock } from '@/core/database/siteClock.js'

export type HistoryStartEventRow = Record<string, any>

/** Stop cron treats “due” when wall `scheduled_end` ∈ [now−5m, now] (inclusive). */
export function fiveMinutesBefore(nowDt: Date) {
  return new Date(nowDt.getTime() - 5 * 60 * 1000)
}

export function isScheduledEndInStopWindow(
  scheduledEndMysql: string,
  nowDt: Date,
  fiveAgoDt: Date,
) {
  const end = SiteClock.mysqlWallToDate(String(scheduledEndMysql))
  return end >= fiveAgoDt && end <= nowDt
}

/** History rows that are still “open” starts — caller loads via repository. */
export function filterStartEventsEligibleToStop(
  startEvents: HistoryStartEventRow[],
  nowDt: Date,
): HistoryStartEventRow[] {
  const fiveAgoDt = fiveMinutesBefore(nowDt)
  const out: HistoryStartEventRow[] = []
  for (const ev of startEvents) {
    if (isScheduledEndInStopWindow(String(ev.scheduled_end), nowDt, fiveAgoDt)) {
      out.push(ev)
    }
  }
  return out
}
