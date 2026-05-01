import { cclTable } from '@/core/database/tableModel.js'
import { int, text, SqliteTableDefinition } from '@/core/database/schema/sqliteDdlBuilder.js'

export const TABLE_SUFFIX = 'ccl_stream_recording_usage' as const

export const recordingUsageTable = cclTable(TABLE_SUFFIX)

const RECORDING_USAGE_DDL = new SqliteTableDefinition()
  .add(int('id').primaryKey().autoIncrement())
  .add(int('all_recordings').notNull().defaultNumber(0))
  .add(int('scheduled_recordings').notNull().defaultNumber(0))
  .add(
    text('created')
      .notNull()
      .defaultExpr("(datetime('now'))"),
  )

export function buildCreateTableSql(qualified: string): string {
  return RECORDING_USAGE_DDL.toCreateTableSql(qualified)
}
