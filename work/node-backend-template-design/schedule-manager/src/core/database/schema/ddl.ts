/**
 * Resolves `CREATE TABLE` SQL from each module’s `buildCreateTableSql` (source of truth for columns).
 */
import { buildCreateTableSql as ddlAllRecordings } from '@/modules/Recordings/Data/Models/allRecordings.js'
import { buildCreateTableSql as ddlPermanentRecordings } from '@/modules/Recordings/Data/Models/permanentRecordings.js'
import { buildCreateTableSql as ddlRecordingCollections } from '@/modules/Recordings/Data/Models/recordingCollections.js'
import { buildCreateTableSql as ddlRecordingSwitch } from '@/modules/Recordings/Data/Models/recordingSwitch.js'
import { buildCreateTableSql as ddlRecordingUsage } from '@/modules/Recordings/Data/Models/recordingUsage.js'
import { buildCreateTableSql as ddlRecordingsToBeDeleted } from '@/modules/Recordings/Data/Models/recordingsToBeDeleted.js'
import { buildCreateTableSql as ddlScheduledRecordings } from '@/modules/Recordings/Data/Models/scheduledRecordings.js'
import { buildCreateTableSql as ddlScheduleDeleted } from '@/modules/Schedules/Data/Models/scheduleDeleted.js'
import { buildCreateTableSql as ddlScheduleRecordingHistory } from '@/modules/Schedules/Data/Models/scheduleRecordingHistory.js'
import { buildCreateTableSql as ddlScheduleRecordingHistoryArchive } from '@/modules/Schedules/Data/Models/scheduleRecordingHistoryArchive.js'
import { buildCreateTableSql as ddlScheduleV2 } from '@/modules/Schedules/Data/Models/scheduleV2.js'
import { buildCreateTableSql as ddlAccountStorageCapacity } from '@/modules/Storage/Data/Models/accountStorageCapacityInformation.js'
import { buildCreateTableSql as ddlTotalBusinessDailyStorage } from '@/modules/Storage/Data/Models/totalBusinessDailyStorage.js'
import { buildCreateTableSql as ddlTotalDailyStorage } from '@/modules/Storage/Data/Models/totalDailyStorage.js'
import { buildCreateTableSql as ddlTotalStorage } from '@/modules/Storage/Data/Models/totalStorage.js'
import { buildCreateTableSql as ddlAntmediaWebhook } from '@/modules/Antmedia/Data/Models/antMediaWebhookTable.js'

const TABLE_DDL: Record<string, (qualified: string) => string> = {
  ccl_stream_antmedia_webhook_table: ddlAntmediaWebhook,
  ccl_stream_storage_capacity: ddlAccountStorageCapacity,
  ccl_stream_total_business_daily_storage: ddlTotalBusinessDailyStorage,
  ccl_stream_total_daily_storage: ddlTotalDailyStorage,
  ccl_stream_total_storage_amount_in_database: ddlTotalStorage,
  ccl_stream_schedule_recording_history_archive: ddlScheduleRecordingHistoryArchive,
  ccl_stream_schedule_recording_history: ddlScheduleRecordingHistory,
  ccl_stream_schedule_deleted: ddlScheduleDeleted,
  ccl_stream_schedule_v2: ddlScheduleV2,
  ccl_stream_recording_collections: ddlRecordingCollections,
  ccl_stream_recordings_to_be_deleted: ddlRecordingsToBeDeleted,
  ccl_stream_recording_switch: ddlRecordingSwitch,
  ccl_stream_scheduled_recordings: ddlScheduledRecordings,
  ccl_stream_recording_usage: ddlRecordingUsage,
  ccl_stream_all_recordings: ddlAllRecordings,
  ccl_stream_permanent_recordings: ddlPermanentRecordings,
}

export function createTableDdl(qualified: string, suffix: string): string {
  const fn = TABLE_DDL[suffix]
  if (!fn) {
    throw new Error(`No SQLite DDL for suffix: ${suffix}`)
  }
  return fn(qualified)
}
