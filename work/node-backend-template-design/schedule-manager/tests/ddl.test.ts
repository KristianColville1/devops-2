/**
 * Unit tests: `@/core/database/schema/ddl` (+ `@/modules/Recordings/Data/Models/allRecordings` DDL helpers)
 * — string output only.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { createTableDdl } from '@/core/database/schema/ddl.js'
import {
  TABLE_SUFFIX,
  buildCreateTableSql,
} from '@/modules/Recordings/Data/Models/allRecordings.js'

describe('@/core/database/schema/ddl · unit', () => {
  describe('createTableDdl', () => {
    it('delegates to module buildCreateTableSql', () => {
      const q = 'wp_ccl_stream_all_recordings'
      assert.strictEqual(
        createTableDdl(q, TABLE_SUFFIX),
        buildCreateTableSql(q),
      )
    })

    it('emits SQLite DDL for a known suffix', () => {
      const q = 'wp_ccl_stream_all_recordings'
      const sql = createTableDdl(q, TABLE_SUFFIX)
      assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS'))
      assert.ok(sql.includes('ccl_stream_all_recordings') || sql.includes(q))
      assert.ok(sql.includes('post_id'))
    })
  })
})
