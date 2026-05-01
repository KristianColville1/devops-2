import { cclTable } from '@/core/database/tableModel.js'
import { int, text, SqliteTableDefinition } from '@/core/database/schema/sqliteDdlBuilder.js'

export const TABLE_SUFFIX = 'ccl_stream_recording_collections' as const

export const recordingCollectionsTable = cclTable(TABLE_SUFFIX)

const RECORDING_COLLECTIONS_DDL = new SqliteTableDefinition()
  .add(int('id').primaryKey().autoIncrement())
  .add(text('stream_id').notNull().defaultText(''))
  .add(text('library_id').notNull().defaultText(''))
  .add(text('collection_guid').notNull().defaultText(''))
  .add(text('collection_name').notNull().defaultText(''))
  .add(int('video_count').notNull())
  .add(int('collection_size_bytes').notNull())

export function buildCreateTableSql(qualified: string): string {
  return RECORDING_COLLECTIONS_DDL.toCreateTableSql(qualified)
}
