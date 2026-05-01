/**
 * Unit tests: `@/modules/Recordings/Services/startRecordingCandidateLogic`
 * — pure functions + static fixture JSON (no DB, no cron scripts).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, test } from 'node:test'

import {
  buildStartWindowBoundsFromMysql,
  enrichStartCandidates,
  filterPermanentStorageQuota,
  type StartCandidateRow,
} from '@/modules/Recordings/Services/startRecordingCandidateLogic.js'
import { PERMANENT_STORAGE_LIMIT_BYTES } from '@/modules/Storage/Services/permanentStorageConstants.js'

const _dir = dirname(fileURLToPath(import.meta.url))
const startCasesPath = join(_dir, '../../../fixtures/recordings/start-candidates/cases.json')

type StartCase = {
  id: string
  description?: string
  window: { start: string; end: string }
  candidates: StartCandidateRow[]
  expected: {
    includedIds: number[]
    byId: Record<string, { _occurrence_start: string; _occurrence_end: string }>
  }
}

describe('@/modules/Recordings/Services/startRecordingCandidateLogic · unit', () => {
  test('fixture matrix: enrichStartCandidates matches JSON expectations', () => {
    const raw = readFileSync(startCasesPath, 'utf8')
    const cases = JSON.parse(raw) as StartCase[]
    for (const c of cases) {
      const { nowDt, windowEndDt } = buildStartWindowBoundsFromMysql(c.window.start, c.window.end)
      const got = enrichStartCandidates(c.candidates, nowDt, windowEndDt)
      const gotIds = got.map((r) => Number(r.id)).sort((a, b) => a - b)
      const expIds = [...c.expected.includedIds].sort((a, b) => a - b)
      assert.deepEqual(
        gotIds,
        expIds,
        `Case ${c.id}: included schedule ids should match (description: ${c.description ?? ''})`,
      )
      for (const idStr of Object.keys(c.expected.byId)) {
        const row = got.find((r) => String(r.id) === idStr)
        assert.ok(row, `Case ${c.id}: expected row id ${idStr}`)
        const exp = c.expected.byId[idStr]
        assert.equal(String(row!._occurrence_start), exp._occurrence_start, `Case ${c.id} id ${idStr} start`)
        assert.equal(String(row!._occurrence_end), exp._occurrence_end, `Case ${c.id} id ${idStr} end`)
      }
    }
  })

  test('filterPermanentStorageQuota keeps rows under cap', () => {
    const schedules: StartCandidateRow[] = [
      {
        id: 1,
        stream_id: 'a',
        post_id: 10,
        permanent_status: 1,
        is_recurring: 0,
        first_start: '2026-01-01 10:00:00',
        first_end: '2026-01-01 11:00:00',
      },
      {
        id: 2,
        stream_id: 'b',
        post_id: 11,
        permanent_status: 1,
        is_recurring: 0,
        first_start: '2026-01-01 10:00:00',
        first_end: '2026-01-01 11:00:00',
      },
      {
        id: 3,
        stream_id: 'c',
        post_id: 12,
        permanent_status: 0,
        is_recurring: 0,
        first_start: '2026-01-01 10:00:00',
        first_end: '2026-01-01 11:00:00',
      },
    ]
    const bytes = { 10: PERMANENT_STORAGE_LIMIT_BYTES, 11: 0, 12: 999_999_999_999 }
    const out = filterPermanentStorageQuota(schedules, bytes, PERMANENT_STORAGE_LIMIT_BYTES)
    assert.equal(out.length, 2)
    assert.deepEqual(
      out.map((r) => r.id).sort(),
      [2, 3],
    )
  })
})
