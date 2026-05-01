import { getDatabase } from '@/core/database/databaseContext.js'
import { SiteClock } from '@/core/database/siteClock.js'
import { TABLE_SUFFIX } from '../Models/scheduledRecordings.js'
import { TABLE_SUFFIX as QUEUE_SUFFIX } from '../Models/recordingsToBeDeleted.js'
import {
  datePlusDaysYmd,
  filterScheduledStreamPublicRows,
} from './recordingRepoShared.js'

/** `ccl_stream_scheduled_recordings` — static methods only. */
export class ScheduledRecordingsRepository {
  private constructor() {}

  private static get db() {
    return getDatabase()
  }

  static get table() {
    return TABLE_SUFFIX
  }

  static async getAllRecordings() {
    return ScheduledRecordingsRepository.db.fetchAll(ScheduledRecordingsRepository.table)
  }

  static async getAllRecordingsOlderThanFourWeeks() {
    const boundary = SiteClock.mysqlWeeksBefore(4)
    return ScheduledRecordingsRepository.db.fetchAll(ScheduledRecordingsRepository.table, 'WHERE date_uploaded < ?', [
      boundary,
    ])
  }

  static async getRecordingById(id: any) {
    return ScheduledRecordingsRepository.db.fetchOneById(ScheduledRecordingsRepository.table, id)
  }

  static async getAllRecordingsByPostId(postId: any) {
    return ScheduledRecordingsRepository.db.fetchAll(ScheduledRecordingsRepository.table, 'WHERE post_id = ?', [
      postId,
    ])
  }

  static async getAllPublicRecordingsByPostId(postId: any) {
    return ScheduledRecordingsRepository.db.fetchAll(
      ScheduledRecordingsRepository.table,
      'WHERE post_id = ? AND is_public = 1',
      [postId],
    )
  }

  static async getAllRecordingsByStreamId(streamId: any) {
    const recordings = await ScheduledRecordingsRepository.db.fetchAll(
      ScheduledRecordingsRepository.table,
      'WHERE stream_id = ?',
      [streamId],
    )
    return filterScheduledStreamPublicRows(recordings)
  }

  static async getAllRecordingsByUserId(userId: any) {
    return ScheduledRecordingsRepository.db.fetchAll(ScheduledRecordingsRepository.table, 'WHERE user_id = ?', [
      userId,
    ])
  }

  static async createRecording(data: Record<string, any>) {
    return ScheduledRecordingsRepository.db.insert(
      ScheduledRecordingsRepository.table,
      ScheduledRecordingsRepository.getBaseDataStructure(data),
    )
  }

  static async updateRecording(id: any, data: Record<string, any>) {
    return ScheduledRecordingsRepository.db.update(
      ScheduledRecordingsRepository.table,
      ScheduledRecordingsRepository.getBaseDataStructure(data),
      { id },
    )
  }

  static async deleteRecording(id: any) {
    const recording = await ScheduledRecordingsRepository.getRecordingById(id)
    if (recording) {
      const r = recording as any
      await ScheduledRecordingsRepository.db.insert(QUEUE_SUFFIX, {
        stream_id: r.stream_id,
        post_id: r.post_id,
        user_id: r.user_id,
        master_table_id: r.recording_directory_id,
        video_guid: r.video_guid,
        library_id: r.library_id,
        collection_id: r.collection_id,
        date_uploaded: r.date_uploaded,
        date_to_delete: datePlusDaysYmd(14),
        storage_size: r.storage_size,
      })
    }
    return ScheduledRecordingsRepository.db.delete(ScheduledRecordingsRepository.table, { id })
  }

  static getBaseDataStructure(data: Record<string, any>) {
    return {
      stream_id: data.stream_id ?? '',
      post_id: data.post_id ?? 0,
      user_id: data.user_id ?? 0,
      recording_directory_id: data.recording_directory_id ?? 0,
      recording_name: data.recording_name ?? '',
      permanent_status: data.permanent_status != null ? (data.permanent_status ? 1 : 0) : 0,
      title: data.title ?? '',
      video_guid: data.video_guid ?? '',
      library_id: data.library_id ?? '',
      recording_url: data.recording_url ?? '',
      download_url: data.download_url ?? '',
      collection_id: data.collection_id ?? '',
      category: data.category ?? '',
      date_uploaded: data.date_uploaded ?? '',
      date_to_delete: data.date_to_delete ?? '',
      views: data.views ?? 0,
      is_public: data.is_public != null ? (data.is_public ? 1 : 0) : 1,
      length_s: data.length_s ?? 0,
      framerate: data.framerate ?? 0,
      rotation: data.rotation ?? 0,
      width: data.width ?? 0,
      height: data.height ?? 0,
      resolutions: data.resolutions ?? '',
      thumbnail_count: data.thumbnail_count ?? 0,
      encode_progress: data.encode_progress ?? 0,
      embed_code: data.embed_code ?? '',
      storage_size: data.storage_size ?? 0,
      thumbnail_file_name: data.thumbnail_file_name ?? '',
      average_watch_time: data.average_watch_time ?? 0,
      total_watch_time: data.total_watch_time ?? 0,
    }
  }
}
