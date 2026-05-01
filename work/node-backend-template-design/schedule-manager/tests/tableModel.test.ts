/**
 * Unit tests: `@/modules/Recordings/Data/Models/allRecordings` (`allRecordingsTable`)
 * — constants / qualification only (no DB).
 */
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { allRecordingsTable } from '@/modules/Recordings/Data/Models/allRecordings.js'

describe('@/modules/Recordings/Data/Models/allRecordings · unit', () => {
  it('resolves qualified table for LibSQL (wp_ prefix)', () => {
    assert.strictEqual(
      allRecordingsTable.qualifiedTable(),
      'wp_ccl_stream_all_recordings',
    )
    assert.strictEqual(
      allRecordingsTable.suffix,
      'ccl_stream_all_recordings',
    )
  })
})
