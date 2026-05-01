/**
 * Unit tests: `@/modules/Recordings/Services/bunnyWebhookRecordingMapper`
 * — pure occurrence matching (no DB).
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  findMatchingScheduleOccurrence,
  parseRecordingEndDatetime,
  recordingIsFullForOccurrence,
} from '@/modules/Recordings/Services/bunnyWebhookRecordingMapper.js'

describe('@/modules/Recordings/Services/bunnyWebhookRecordingMapper · unit', () => {
  test('parseRecordingEndDatetime accepts date space time and optional fractional seconds', () => {
    const a = parseRecordingEndDatetime('2024-06-15 14:30:00')
    const b = parseRecordingEndDatetime('2024-06-15T14:30:00.500')
    assert.ok(a && b)
    assert.equal(a!.getFullYear(), 2024)
    assert.equal(a!.getMonth(), 5)
    assert.equal(a!.getDate(), 15)
    assert.equal(b!.getMilliseconds(), 500)
  })

  test('parseRecordingEndDatetime returns null when empty or invalid', () => {
    assert.equal(parseRecordingEndDatetime(''), null)
    assert.equal(parseRecordingEndDatetime('not-a-date'), null)
  })

  test('recordingIsFullForOccurrence enforces duration + end tolerance', () => {
    const s = new Date(2024, 0, 1, 10, 0, 0)
    const e = new Date(2024, 0, 1, 11, 0, 0)
    const ss = new Date(2024, 0, 1, 10, 0, 0)
    const se = new Date(2024, 0, 1, 11, 0, 0)
    assert.equal(recordingIsFullForOccurrence(s, e, 3600, ss, se, 300), true)
    assert.equal(recordingIsFullForOccurrence(s, e, 3500, ss, se, 300), false)
  })

  test('findMatchingScheduleOccurrence prefers full match over overlap-only', () => {
    const events = [
      {
        schedule_id: 1,
        scheduled_start: '2024-01-01 10:00:00',
        scheduled_end: '2024-01-01 11:00:00',
        schedule_name: 'Full',
      },
    ]
    const full = findMatchingScheduleOccurrence(events, '2024-01-01 11:00:00', 3600, 300)
    assert.equal(full?.schedule_name, 'Full')
  })

  test('findMatchingScheduleOccurrence dedupes identical occurrence keys', () => {
    const dup = {
      schedule_id: 2,
      scheduled_start: '2024-02-01 09:00:00',
      scheduled_end: '2024-02-01 09:30:00',
      schedule_name: 'Dup',
    }
    const events = [
      { ...dup, event_type: 'start' },
      { ...dup, event_type: 'stop' },
    ]
    const m = findMatchingScheduleOccurrence(events as any[], '2024-02-01 09:30:00', 1800, 300)
    assert.equal(m?.schedule_name, 'Dup')
  })
})
