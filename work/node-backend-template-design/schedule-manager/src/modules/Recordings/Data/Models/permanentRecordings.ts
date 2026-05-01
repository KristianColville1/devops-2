import { cclTable } from '@/core/database/tableModel.js'
import { int, real, text, SqliteTableDefinition } from '@/core/database/schema/sqliteDdlBuilder.js'

export const TABLE_SUFFIX = 'ccl_stream_permanent_recordings' as const

export const permanentRecordingsTable = cclTable(TABLE_SUFFIX)

const PERMANENT_RECORDINGS_DDL = new SqliteTableDefinition()
  .add(int('id').primaryKey().autoIncrement())
  .add(text('stream_id').notNull().defaultText(''))
  .add(int('post_id').notNull())
  .add(int('user_id').notNull())
  .add(int('scheduled_recording_table_id').notNull())
  .add(int('recording_directory_id').notNull())
  .add(text('recording_name').notNull().defaultText(''))
  .add(text('title').notNull().defaultText(''))
  .add(text('video_guid').notNull().defaultText(''))
  .add(text('library_id').notNull().defaultText(''))
  .add(text('recording_url').notNull().defaultText(''))
  .add(text('download_url').notNull().defaultText(''))
  .add(text('collection_id').notNull().defaultText(''))
  .add(text('category').notNull().defaultText(''))
  .add(text('date_uploaded').notNull().defaultText(''))
  .add(text('date_to_delete').notNull().defaultText(''))
  .add(int('views').notNull().defaultNumber(0))
  .add(int('is_public').notNull().defaultNumber(0))
  .add(int('length_s').notNull().defaultNumber(0))
  .add(real('framerate').notNull().defaultNumber(0))
  .add(int('rotation').notNull().defaultNumber(0))
  .add(int('width').notNull().defaultNumber(0))
  .add(int('height').notNull().defaultNumber(0))
  .add(text('resolutions').notNull().defaultText(''))
  .add(int('thumbnail_count').notNull().defaultNumber(0))
  .add(int('encode_progress').notNull().defaultNumber(0))
  .add(text('embed_code').notNull().defaultText(''))
  .add(int('storage_size').notNull().defaultNumber(0))
  .add(text('thumbnail_file_name').notNull().defaultText(''))
  .add(int('average_watch_time').notNull().defaultNumber(0))
  .add(int('total_watch_time').notNull().defaultNumber(0))

export function buildCreateTableSql(qualified: string): string {
  return PERMANENT_RECORDINGS_DDL.toCreateTableSql(qualified)
}
