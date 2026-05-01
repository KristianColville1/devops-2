import { cclTable } from '@/core/database/tableModel.js'
import { int, real, text, SqliteTableDefinition } from '@/core/database/schema/sqliteDdlBuilder.js'

export const TABLE_SUFFIX = 'ccl_stream_storage_capacity' as const

export const accountStorageCapacityTable = cclTable(TABLE_SUFFIX)

const ACCOUNT_STORAGE_CAPACITY_DDL = new SqliteTableDefinition()
  .add(int('id').primaryKey().autoIncrement())
  .add(text('stream_id').notNull().defaultText(''))
  .add(text('capacity').notNull().defaultText('100'))
  .add(int('post_id').notNull())
  .add(int('user_id').notNull())
  .add(text('account_name').notNull().defaultText(''))
  .add(real('max_capacity_gb').notNull().defaultNumber(20))
  .add(real('current_capacity_gb').notNull().defaultNumber(0))
  .add(text('storage_note').notNull().defaultText(''))

export function buildCreateTableSql(qualified: string): string {
  return ACCOUNT_STORAGE_CAPACITY_DDL.toCreateTableSql(qualified)
}
