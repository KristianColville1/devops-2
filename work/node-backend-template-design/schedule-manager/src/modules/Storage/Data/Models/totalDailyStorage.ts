import { cclTable } from '@/core/database/tableModel.js'
import { int, text, SqliteTableDefinition } from '@/core/database/schema/sqliteDdlBuilder.js'

export const TABLE_SUFFIX = 'ccl_stream_total_daily_storage' as const

export const totalDailyStorageTable = cclTable(TABLE_SUFFIX)

const TOTAL_DAILY_STORAGE_DDL = new SqliteTableDefinition()
  .add(int('id').primaryKey().autoIncrement())
  .add(text('stream_id').notNull().defaultText(''))
  .add(int('post_id').notNull())
  .add(text('post_slug').notNull().defaultText(''))
  .add(int('total_storage').notNull().defaultNumber(0))
  .add(int('total_uploads_storage').notNull().defaultNumber(0))
  .add(int('total_recorded_storage').notNull().defaultNumber(0))
  .add(text('date', { quote: true }).notNull())
  .unique('date', 'post_id')

export function buildCreateTableSql(qualified: string): string {
  return TOTAL_DAILY_STORAGE_DDL.toCreateTableSql(qualified)
}
