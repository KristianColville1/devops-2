#!/usr/bin/env npx tsx
/**
 * Standalone RRULE probe — uses the same stack as production (`recordingScheduleOccurrences`
 * + SiteClock). Run from `apps/schedule-manager`:
 *
 *   npm run rrule:probe -- \
 *     --rule 'FREQ=WEEKLY;BYDAY=WE' \
 *     --first-start '2026-01-07 10:00:00' \
 *     --first-end '2026-01-07 10:40:00' \
 *     --window-start '2040-08-22 09:58:00' \
 *     --window-end '2040-08-22 10:03:00'
 *
 * `--scan-day YYYY-MM-DD` sets window to that entire local calendar day (wide probe).
 * Prints JSON for `recurringOccurrenceInWindow` so you can paste expected values or verify
 * future cron windows (start cron runs ~every minute inside a 5-minute RRULE window).
 */
import '../src/core/env/bootstrap.js'
import { SiteClock } from '../src/core/database/siteClock.js'
import { recurringOccurrenceInWindow } from '../src/modules/Recordings/Services/recordingScheduleOccurrences.js'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  if (i === -1 || !process.argv[i + 1]) return undefined
  return process.argv[i + 1]
}

const rule = arg('--rule')
const firstStart = arg('--first-start')
const firstEnd = arg('--first-end')
const windowStart = arg('--window-start')
const windowEnd = arg('--window-end')
const scanDay = arg('--scan-day')

if (!rule || !firstStart || !firstEnd) {
  console.error(
    'Usage: npm run rrule:probe -- --rule RRULE --first-start "Y-m-d H:i:s" --first-end "..." [--window-start ... --window-end ... | --scan-day YYYY-MM-DD]',
  )
  process.exit(1)
}

const schedule = {
  recurring_rule: rule,
  first_start: firstStart,
  first_end: firstEnd,
}

let ws: Date
let we: Date

if (scanDay) {
  ws = SiteClock.mysqlWallToDate(`${scanDay} 00:00:01`)
  we = SiteClock.mysqlWallToDate(`${scanDay} 23:59:58`)
} else if (windowStart && windowEnd) {
  ws = SiteClock.mysqlWallToDate(windowStart)
  we = SiteClock.mysqlWallToDate(windowEnd)
} else {
  console.error('Provide either --scan-day or both --window-start and --window-end')
  process.exit(1)
}

const occ = recurringOccurrenceInWindow(schedule, ws, we)
console.log(JSON.stringify({ schedule, window: { start: SiteClock.formatMysql(ws), end: SiteClock.formatMysql(we) }, occurrence: occ }, null, 2))

if (occ) {
  const t = SiteClock.mysqlWallToDate(occ.occurrenceStart)
  const cronBefore = new Date(t.getTime() - 2 * 60 * 1000)
  const cronAfter = new Date(t.getTime() + 3 * 60 * 1000)
  console.log(
    '\nSuggested 5-minute cron-style window (± ~2–3 min around occurrence start):\n',
    JSON.stringify(
      {
        window_start: SiteClock.formatMysql(cronBefore),
        window_end: SiteClock.formatMysql(cronAfter),
      },
      null,
      2,
    ),
  )
}
