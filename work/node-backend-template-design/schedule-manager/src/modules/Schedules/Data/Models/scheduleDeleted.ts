import { cclTable } from '@/core/database/tableModel.js'
import { int, text, SqliteTableDefinition } from '@/core/database/schema/sqliteDdlBuilder.js'

export const TABLE_SUFFIX = 'ccl_stream_schedule_deleted' as const

export const scheduleDeletedTable = cclTable(TABLE_SUFFIX)

const SCHEDULE_DELETED_DDL = new SqliteTableDefinition()
  .add(int('id').primaryKey().autoIncrement())
  .add(int('original_schedule_id').notNull())
  .add(int('post_id').notNull())
  .add(text('stream_id').notNull())
  .add(text('schedule_name').notNull())
  .add(text('first_start').notNull())
  .add(text('first_end').notNull())
  .add(int('is_timetable').notNull().defaultNumber(0))
  .add(text('timetable_name'))
  .add(int('is_recurring').notNull().defaultNumber(0))
  .add(text('recurring_rule'))
  .add(int('record_events').notNull().defaultNumber(0))
  .add(int('permanent_status').notNull().defaultNumber(0))
  .add(int('is_visible').notNull().defaultNumber(0))
  .add(int('password_protected').notNull().defaultNumber(0))
  .add(text('recording_password'))
  .add(
    text('deleted_at')
      .notNull()
      .defaultExpr("(datetime('now'))"),
  )
  .add(text('original_created_at').notNull())
  .add(text('original_updated_at').notNull())

export function buildCreateTableSql(qualified: string): string {
  return SCHEDULE_DELETED_DDL.toCreateTableSql(qualified)
}
