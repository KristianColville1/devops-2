import { quoteIdent } from '@/core/database/Database.js'
import { getDatabase } from '@/core/database/databaseContext.js'
import { TABLE_SUFFIX } from '../Models/allRecordings.js'
import { TABLE_SUFFIX as QUEUE_SUFFIX } from '../Models/recordingsToBeDeleted.js'
import {
  datePlusDaysYmd,
  filterScheduledStreamPublicRows,
} from './recordingRepoShared.js'

export class AllRecordingsRepository {
  private constructor() {}

  private static get db() {
    return getDatabase()
  }

  static get table() {
    return TABLE_SUFFIX
  }

  static async getAllRecordings() {
    return AllRecordingsRepository.db.fetchAll(AllRecordingsRepository.table)
  }

  static async getDistinctVideoGuidsLookup() {
    const q = quoteIdent(AllRecordingsRepository.db.qualify(AllRecordingsRepository.table))
    const sql = `SELECT DISTINCT video_guid FROM ${q} WHERE video_guid IS NOT NULL AND video_guid != ''`
    const rows = await AllRecordingsRepository.db.query(sql, [])
    const lookup: Record<string, boolean> = {}
    for (const row of rows as any[]) {
      const g = row.video_guid
      if (g == null || String(g).trim() === '') continue
      lookup[String(g).trim().toLowerCase()] = true
    }
    return lookup
  }

  static async getAllRecordingsOlderThanFourWeeks() {
    return AllRecordingsRepository.getAllRecordings()
  }

  static async getRecordingById(id: any) {
    return AllRecordingsRepository.db.fetchOneById(AllRecordingsRepository.table, id)
  }

  static async getAllRecordingsByPostId(postId: any) {
    return AllRecordingsRepository.db.fetchAll(AllRecordingsRepository.table, 'WHERE post_id = ?', [postId])
  }

  static async getAllPublicRecordingsByPostId(postId: any) {
    return AllRecordingsRepository.db.fetchAll(AllRecordingsRepository.table, 'WHERE post_id = ? AND is_public = 1', [
      postId,
    ])
  }

  static async getAllRecordingsByStreamId(streamId: any) {
    const recordings = await AllRecordingsRepository.db.fetchAll(AllRecordingsRepository.table, 'WHERE stream_id = ?', [
      streamId,
    ])
    return filterScheduledStreamPublicRows(recordings)
  }

  static async getAllRecordingsByUserId(userId: any) {
    return AllRecordingsRepository.db.fetchAll(AllRecordingsRepository.table, 'WHERE user_id = ?', [userId])
  }

  static async createRecording(data: Record<string, any>) {
    return AllRecordingsRepository.db.insert(AllRecordingsRepository.table, AllRecordingsRepository.getBaseDataStructure(data))
  }

  static async updateRecording(id: any, data: Record<string, any>) {
    return AllRecordingsRepository.db.update(AllRecordingsRepository.table, AllRecordingsRepository.getBaseDataStructure(data), {
      id,
    })
  }

  static async deleteRecording(id: any) {
    const recording = await AllRecordingsRepository.getRecordingById(id)
    if (recording) {
      const r = recording as any
      await AllRecordingsRepository.db.insert(QUEUE_SUFFIX, {
        stream_id: r.stream_id,
        post_id: r.post_id,
        user_id: r.user_id ?? 0,
        master_table_id: r.recording_directory_id ?? 0,
        video_guid: r.video_guid,
        library_id: r.library_id,
        collection_id: r.collection_id,
        date_uploaded: r.date_uploaded,
        date_to_delete: datePlusDaysYmd(14),
        storage_size: r.storage_size,
      })
    }
    return AllRecordingsRepository.db.delete(AllRecordingsRepository.table, { id })
  }

  static getBaseDataStructure(data: Record<string, any>) {
    return {
      stream_id: data.stream_id ?? '',
      post_id: data.post_id ?? 0,
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
      is_public: data.is_public != null ? (data.is_public ? 1 : 0) : 1,
      length_s: data.length_s ?? 0,
      framerate: data.framerate ?? 0,
      rotation: data.rotation ?? 0,
      width: data.width ?? 0,
      height: data.height ?? 0,
      resolutions: data.resolutions ?? '',
      thumbnail_count: data.thumbnail_count ?? 0,
      encode_progress: data.encode_progress ?? 0,
      storage_size: data.storage_size ?? 0,
      thumbnail_file_name: data.thumbnail_file_name ?? '',
      average_watch_time: data.average_watch_time ?? 0,
      total_watch_time: data.total_watch_time ?? 0,
    }
  }
}
