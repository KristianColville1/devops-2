import { getDatabase } from '@/core/database/databaseContext.js'
import { TABLE_SUFFIX } from '../Models/permanentRecordings.js'

export class PermanentRecordingsRepository {
  private constructor() {}

  private static get db() {
    return getDatabase()
  }

  static get table() {
    return TABLE_SUFFIX
  }

  static async getAll() {
    return PermanentRecordingsRepository.db.fetchAll(PermanentRecordingsRepository.table)
  }

  static async getById(id: any) {
    return PermanentRecordingsRepository.db.fetchOneById(PermanentRecordingsRepository.table, id)
  }

  static async getByPostId(postId: any) {
    return PermanentRecordingsRepository.db.fetchAll(PermanentRecordingsRepository.table, 'WHERE post_id = ?', [postId])
  }

  static async getByStreamId(streamId: any) {
    return PermanentRecordingsRepository.db.fetchAll(PermanentRecordingsRepository.table, 'WHERE stream_id = ?', [
      streamId,
    ])
  }

  static async getByScheduledRecordingTableId(scheduledRecordingTableId: any) {
    return PermanentRecordingsRepository.db.fetchAll(PermanentRecordingsRepository.table, 'WHERE scheduled_recording_table_id = ?', [
      scheduledRecordingTableId,
    ])
  }

  static async create(data: Record<string, any>) {
    return PermanentRecordingsRepository.db.insert(
      PermanentRecordingsRepository.table,
      PermanentRecordingsRepository.getBaseDataStructure(data),
    )
  }

  static async update(id: any, data: Record<string, any>) {
    return PermanentRecordingsRepository.db.update(
      PermanentRecordingsRepository.table,
      PermanentRecordingsRepository.getBaseDataStructure(data),
      { id },
    )
  }

  static async delete(id: any) {
    return PermanentRecordingsRepository.db.delete(PermanentRecordingsRepository.table, { id })
  }

  static getBaseDataStructure(data: Record<string, any>) {
    return {
      stream_id: data.stream_id ?? '',
      post_id: data.post_id ?? 0,
      user_id: data.user_id ?? 0,
      scheduled_recording_table_id: data.scheduled_recording_table_id ?? 0,
      recording_directory_id: data.recording_directory_id ?? 0,
      recording_name: data.recording_name ?? '',
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
      is_public: data.is_public != null ? (data.is_public ? 1 : 0) : 0,
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
