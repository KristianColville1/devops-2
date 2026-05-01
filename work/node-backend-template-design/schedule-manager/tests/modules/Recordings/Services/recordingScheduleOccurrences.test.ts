/**
 * Unit tests: `@/modules/Recordings/Services/recordingScheduleOccurrences`
 * — pure RRULE helpers; fixed dates only (no DB). Far-future cases prove schedules
 * anchored in the past still resolve when cron windows fall years later (same behavior as
 * a start script polling ~every minute inside the RRULE [now, now+5m] window).
 *
 * To explore windows manually: `npm run rrule:probe -- --rule ... --first-start ... --scan-day YYYY-MM-DD`
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { SiteClock } from '@/core/database/siteClock.js'
import {
  isRepeatUntilExpired,
  recurringOccurrenceInWindow,
} from '@/modules/Recordings/Services/recordingScheduleOccurrences.js'

/** Event length matches `first_start` → `first_end` (WordPress / StartRecording duration rule). */
function assertOccurrenceDuration(
  occ: NonNullable<ReturnType<typeof recurringOccurrenceInWindow>>,
  firstStart: string,
  firstEnd: string,
) {
  const exp =
    SiteClock.mysqlWallToDate(firstEnd).getTime() - SiteClock.mysqlWallToDate(firstStart).getTime()
  const got =
    SiteClock.mysqlWallToDate(occ.occurrenceEnd).getTime() -
    SiteClock.mysqlWallToDate(occ.occurrenceStart).getTime()
  assert.equal(got, exp)
}

/** Full local calendar day probe (avoids missing an occurrence that lands strictly inside the day). */
function occurrenceForScheduleOnDay(
  schedule: { recurring_rule: string; first_start: string; first_end: string },
  calendarDay: string,
) {
  const ws = SiteClock.mysqlWallToDate(`${calendarDay} 00:00:01`)
  const we = SiteClock.mysqlWallToDate(`${calendarDay} 23:59:58`)
  return recurringOccurrenceInWindow(schedule, ws, we)
}

/** Simulates many cron ticks: any 5-minute-style span around the occurrence start must match. */
function assertNarrowCronWindowFindsOccurrence(
  schedule: { recurring_rule: string; first_start: string; first_end: string },
  occ: NonNullable<ReturnType<typeof recurringOccurrenceInWindow>>,
) {
  const t = SiteClock.mysqlWallToDate(occ.occurrenceStart)
  const ws = new Date(t.getTime() - 2 * 60 * 1000)
  const we = new Date(t.getTime() + 3 * 60 * 1000)
  const again = recurringOccurrenceInWindow(schedule, ws, we)
  assert.deepEqual(again, occ)
}

describe('@/modules/Recordings/Services/recordingScheduleOccurrences · unit', () => {
  describe('DAILY', () => {
    test('narrow window finds an occurrence inside [windowStart, windowEnd]', () => {
      const schedule = {
        recurring_rule: 'FREQ=DAILY',
        first_start: '2026-05-01 10:00:00',
        first_end: '2026-05-01 10:30:00',
      }
      const ws = SiteClock.mysqlWallToDate('2026-05-03 09:58:00')
      const we = SiteClock.mysqlWallToDate('2026-05-03 10:03:00')
      const occ = recurringOccurrenceInWindow(schedule, ws, we)
      assert.ok(occ)
      assert.equal(occ!.occurrenceStart, '2026-05-03 10:00:00')
      assert.equal(occ!.occurrenceEnd, '2026-05-03 10:30:00')
    })

    test('returns null when the window misses the daily start instant', () => {
      const schedule = {
        recurring_rule: 'FREQ=DAILY',
        first_start: '2026-05-01 10:00:00',
        first_end: '2026-05-01 10:30:00',
      }
      const ws = SiteClock.mysqlWallToDate('2026-05-03 10:10:00')
      const we = SiteClock.mysqlWallToDate('2026-05-03 10:14:00')
      assert.equal(recurringOccurrenceInWindow(schedule, ws, we), null)
    })

    test('years later: schedule anchored in 2026 still hits on an arbitrary future day', () => {
      const schedule = {
        recurring_rule: 'FREQ=DAILY',
        first_start: '2026-06-01 06:15:00',
        first_end: '2026-06-01 06:45:00',
      }
      const day = '2032-04-18'
      const occ = occurrenceForScheduleOnDay(schedule, day)
      assert.ok(occ)
      assert.equal(occ!.occurrenceStart, `${day} 06:15:00`)
      assert.equal(occ!.occurrenceEnd, `${day} 06:45:00`)
      assertNarrowCronWindowFindsOccurrence(schedule, occ!)
    })
  })

  describe('WEEKLY / BYDAY', () => {
    test('BYDAY=WE: occurrence years later on a Wednesday preserves duration (wall hour may shift with DST)', () => {
      const schedule = {
        recurring_rule: 'FREQ=WEEKLY;BYDAY=WE',
        first_start: '2026-01-07 10:00:00',
        first_end: '2026-01-07 10:40:00',
      }
      const day = '2040-08-22'
      assert.equal(SiteClock.mysqlWallToDate(`${day} 12:00:00`).getDay(), 3)
      const occ = occurrenceForScheduleOnDay(schedule, day)
      assert.ok(occ)
      assert.ok(occ!.occurrenceStart.startsWith(day))
      assertOccurrenceDuration(occ!, schedule.first_start, schedule.first_end)
      assertNarrowCronWindowFindsOccurrence(schedule, occ!)
    })

    test('BYDAY=MO,TU,WE,TH,FR: weekday bundle on a future weekday preserves duration', () => {
      const schedule = {
        recurring_rule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
        first_start: '2026-02-02 07:00:00',
        first_end: '2026-02-02 07:20:00',
      }
      const day = '2035-08-13'
      const dow = SiteClock.mysqlWallToDate(`${day} 12:00:00`).getDay()
      assert.ok(dow >= 1 && dow <= 5, 'fixture must be Mon–Fri')
      const occ = occurrenceForScheduleOnDay(schedule, day)
      assert.ok(occ)
      assertOccurrenceDuration(occ!, schedule.first_start, schedule.first_end)
      assertNarrowCronWindowFindsOccurrence(schedule, occ!)
    })
  })

  describe('MONTHLY', () => {
    test('BYMONTHDAY=15: still lands on the 15th years ahead (duration preserved; hour may differ by DST)', () => {
      const schedule = {
        recurring_rule: 'FREQ=MONTHLY;BYMONTHDAY=15',
        first_start: '2026-05-15 14:00:00',
        first_end: '2026-05-15 14:50:00',
      }
      const day = '2033-11-15'
      const occ = occurrenceForScheduleOnDay(schedule, day)
      assert.ok(occ)
      assert.ok(occ!.occurrenceStart.startsWith(day))
      assertOccurrenceDuration(occ!, schedule.first_start, schedule.first_end)
      assertNarrowCronWindowFindsOccurrence(schedule, occ!)
    })
  })

  describe('YEARLY', () => {
    test('BYMONTH+BYMONTHDAY: annual fixed date still resolves far ahead', () => {
      const schedule = {
        recurring_rule: 'FREQ=YEARLY;BYMONTH=7;BYMONTHDAY=4',
        first_start: '2020-07-04 18:00:00',
        first_end: '2020-07-04 19:00:00',
      }
      const day = '2030-07-04'
      const occ = occurrenceForScheduleOnDay(schedule, day)
      assert.ok(occ)
      assert.ok(occ!.occurrenceStart.startsWith(day))
      assertOccurrenceDuration(occ!, schedule.first_start, schedule.first_end)
      assertNarrowCronWindowFindsOccurrence(schedule, occ!)
    })
  })

  describe('repeat_until', () => {
    test('isRepeatUntilExpired respects end-of-day on repeat_until date', () => {
      const now = SiteClock.mysqlWallToDate('2026-06-15 12:00:00')
      assert.equal(isRepeatUntilExpired({ repeat_until: '2026-05-01' }, now), true)
      assert.equal(isRepeatUntilExpired({ repeat_until: '2026-12-31' }, now), false)
    })
  })

  describe('FREQ=WEEKLY + INTERVAL (biweekly cadence)', () => {
    test('still hits a matching Monday years away', () => {
      const schedule = {
        recurring_rule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO',
        first_start: '2026-05-04 08:00:00',
        first_end: '2026-05-04 08:35:00',
      }
      let found: ReturnType<typeof recurringOccurrenceInWindow> = null
      for (let m = 0; m < 12 && !found; m++) {
        for (let d = 1; d <= 31; d++) {
          const probe = new Date(2038, m, d)
          if (probe.getMonth() !== m) continue
          if (probe.getDay() !== 1) continue
          const day = `${2038}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          const occ = occurrenceForScheduleOnDay(schedule, day)
          if (occ) {
            found = occ
            assertOccurrenceDuration(occ, schedule.first_start, schedule.first_end)
            assertNarrowCronWindowFindsOccurrence(schedule, occ)
            break
          }
        }
      }
      assert.ok(found, 'expected at least one biweekly Monday in 2038')
    })
  })
})
