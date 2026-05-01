/**
 * Unit tests: `@/modules/Recordings/Services/stopRecordingLogic`
 * — pure filters + static fixture JSON (no history repository).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, test } from 'node:test'

import { SiteClock } from '@/core/database/siteClock.js'
import { filterStartEventsEligibleToStop } from '@/modules/Recordings/Services/stopRecordingLogic.js'

const _dir = dirname(fileURLToPath(import.meta.url))
const stopCasesPath = join(_dir, '../../../fixtures/recordings/stop-candidates/cases.json')

type StopCase = {
  id: string
  nowWall: string
  startEvents: Record<string, unknown>[]
  expectedIds: number[]
}

describe('@/modules/Recordings/Services/stopRecordingLogic · unit', () => {
  test('fixture matrix: scheduled_end in [now−5m, now]', () => {
    const raw = readFileSync(stopCasesPath, 'utf8')
    const cases = JSON.parse(raw) as StopCase[]
    for (const c of cases) {
      const nowDt = SiteClock.mysqlWallToDate(c.nowWall)
      const got = filterStartEventsEligibleToStop(c.startEvents as any, nowDt)
      const gotIds = got.map((r) => Number(r.schedule_id)).sort((a, b) => a - b)
      const exp = [...c.expectedIds].sort((a, b) => a - b)
      assert.deepEqual(gotIds, exp, `Case ${c.id}`)
    }
  })
})
