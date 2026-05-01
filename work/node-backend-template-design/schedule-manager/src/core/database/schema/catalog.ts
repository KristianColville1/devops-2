/**
 * CCL table suffixes (models under Recordings, Schedules, Storage, Antmedia).
 * Order: safe for drop/create (no FKs in SQLite schema); sync runs in this order.
 */
export const CCL_TABLE_SUFFIXES: string[] = [
  'ccl_stream_antmedia_webhook_table',
  'ccl_stream_storage_capacity',
  'ccl_stream_total_business_daily_storage',
  'ccl_stream_total_daily_storage',
  'ccl_stream_total_storage_amount_in_database',
  'ccl_stream_schedule_recording_history_archive',
  'ccl_stream_schedule_recording_history',
  'ccl_stream_schedule_deleted',
  'ccl_stream_schedule_v2',
  'ccl_stream_recording_collections',
  'ccl_stream_recordings_to_be_deleted',
  'ccl_stream_recording_switch',
  'ccl_stream_scheduled_recordings',
  'ccl_stream_recording_usage',
  'ccl_stream_all_recordings',
  'ccl_stream_permanent_recordings',
]
