/**
 * Unit tests: `@/core/database/insertRows` — `unionColumns` helper
 * — in-memory rows only.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { unionColumns } from '@/core/database/insertRows.js'

describe('@/core/database/insertRows · unionColumns · unit', () => {
  it('merges keys across sparse rows', () => {
    const cols = unionColumns([
      { id: 1, a: 'x' },
      { id: 2, b: 'y' },
    ])
    assert.deepStrictEqual(cols, ['a', 'b', 'id'])
  })
})
