import { cclTable } from '@/core/database/tableModel.js'
import { int, SqliteTableDefinition } from '@/core/database/schema/sqliteDdlBuilder.js'

export const TABLE_SUFFIX = 'ccl_stream_total_storage_amount_in_database' as const

export const totalStorageTable = cclTable(TABLE_SUFFIX)

const TOTAL_STORAGE_DDL = new SqliteTableDefinition()
  .add(int('id').primaryKey().autoIncrement())
  .add(int('total').notNull().defaultNumber(0))
  .add(int('total_uploads').notNull().defaultNumber(0))
  .add(int('total_recorded').notNull().defaultNumber(0))

export function buildCreateTableSql(qualified: string): string {
  return TOTAL_STORAGE_DDL.toCreateTableSql(qualified)
}
