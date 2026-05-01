import { cclTable } from '@/core/database/tableModel.js'
import { int, text, SqliteTableDefinition } from '@/core/database/schema/sqliteDdlBuilder.js'

export const TABLE_SUFFIX = 'ccl_stream_recording_switch' as const

export const recordingSwitchTable = cclTable(TABLE_SUFFIX)

const RECORDING_SWITCH_DDL = new SqliteTableDefinition()
  .add(int('id').primaryKey().autoIncrement())
  .add(text('stream_id').notNull().defaultText(''))
  .add(int('post_id').notNull())
  .add(int('is_stream_on').notNull().defaultNumber(1))

export function buildCreateTableSql(qualified: string): string {
  return RECORDING_SWITCH_DDL.toCreateTableSql(qualified)
}
