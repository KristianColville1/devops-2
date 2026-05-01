/**
 * Unit tests: `@/core/database/qualify` (+ `@/core/database/tablePrefix`)
 * — pure string logic.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { qualifyTable } from '@/core/database/qualify.js'
import { tablePrefix } from '@/core/database/tablePrefix.js'

describe('@/core/database/qualify · unit', () => {
  it('uses hardcoded wp_ prefix', () => {
    assert.strictEqual(tablePrefix(), 'wp_')
    assert.strictEqual(
      qualifyTable('ccl_stream_all_recordings'),
      'wp_ccl_stream_all_recordings',
    )
  })
})
