import { cclTable } from '@/core/database/tableModel.js'
import { int, text, SqliteTableDefinition } from '@/core/database/schema/sqliteDdlBuilder.js'

export const TABLE_SUFFIX = 'ccl_stream_antmedia_webhook_table' as const

export const antMediaWebhookTable = cclTable(TABLE_SUFFIX)

const ANTMEDIA_WEBHOOK_DDL = new SqliteTableDefinition()
  .add(int('id').primaryKey().autoIncrement())
  .add(text('action').notNull().defaultText(''))
  .add(text('vod_name').notNull().defaultText(''))
  .add(text('time_stamp').notNull().defaultText(''))
  .add(int('post_id').notNull())

export function buildCreateTableSql(qualified: string): string {
  return ANTMEDIA_WEBHOOK_DDL.toCreateTableSql(qualified)
}
