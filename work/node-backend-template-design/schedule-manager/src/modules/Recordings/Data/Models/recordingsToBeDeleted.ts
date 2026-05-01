import { cclTable } from '@/core/database/tableModel.js'
import { int, text, SqliteTableDefinition } from '@/core/database/schema/sqliteDdlBuilder.js'

export const TABLE_SUFFIX = 'ccl_stream_recordings_to_be_deleted' as const

export const recordingsToBeDeletedTable = cclTable(TABLE_SUFFIX)

const RECORDINGS_TO_BE_DELETED_DDL = new SqliteTableDefinition()
  .add(int('id').primaryKey().autoIncrement())
  .add(text('stream_id').notNull().defaultText(''))
  .add(int('post_id').notNull())
  .add(int('user_id').notNull())
  .add(int('master_table_id').notNull())
  .add(text('video_guid').notNull().defaultText(''))
  .add(text('library_id').notNull().defaultText(''))
  .add(text('collection_id').notNull().defaultText(''))
  .add(text('date_uploaded').notNull())
  .add(text('date_to_delete').notNull())
  .add(int('storage_size').notNull().defaultNumber(0))

export function buildCreateTableSql(qualified: string): string {
  return RECORDINGS_TO_BE_DELETED_DDL.toCreateTableSql(qualified)
}
