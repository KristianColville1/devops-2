import { cclTable } from '@/core/database/tableModel.js'
import { int, text, SqliteTableDefinition } from '@/core/database/schema/sqliteDdlBuilder.js'

export const TABLE_SUFFIX = 'ccl_stream_schedule_recording_history' as const

export const scheduleRecordingHistoryTable = cclTable(TABLE_SUFFIX)

const SCHEDULE_RECORDING_HISTORY_DDL = new SqliteTableDefinition()
  .add(int('id').primaryKey().autoIncrement())
  .add(int('schedule_id').notNull())
  .add(int('post_id').notNull())
  .add(text('stream_id').notNull())
  .add(text('event_type').notNull())
  .add(text('event_datetime').notNull())
  .add(text('scheduled_start').notNull())
  .add(text('scheduled_end').notNull())
  .add(text('schedule_name').notNull())
  .add(int('is_recurring').notNull().defaultNumber(0))
  .add(text('recurring_rule'))
  .add(int('is_timetable').notNull().defaultNumber(0))
  .add(text('timetable_name'))
  .add(text('recording_password'))
  .add(int('password_protected').notNull().defaultNumber(0))
  .add(int('origin_api_success'))
  .add(text('origin_api_response'))
  .add(text('origin_api_error'))
  .add(text('cronjob_run_datetime').notNull())
  .add(
    text('created_at')
      .notNull()
      .defaultExpr("(datetime('now'))"),
  )

export function buildCreateTableSql(qualified: string): string {
  return SCHEDULE_RECORDING_HISTORY_DDL.toCreateTableSql(qualified)
}
