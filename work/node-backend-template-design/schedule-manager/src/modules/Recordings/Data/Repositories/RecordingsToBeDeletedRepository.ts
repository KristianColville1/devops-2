import { getDatabase } from '@/core/database/databaseContext.js'
import { TABLE_SUFFIX } from '../Models/recordingsToBeDeleted.js'

export class RecordingsToBeDeletedRepository {
  private constructor() {}

  private static get db() {
    return getDatabase()
  }

  static get table() {
    return TABLE_SUFFIX
  }

  static async getAll() {
    return RecordingsToBeDeletedRepository.db.fetchAll(RecordingsToBeDeletedRepository.table)
  }

  static async getWhereDateToDeleteBefore(date: string) {
    return RecordingsToBeDeletedRepository.db.fetchAll(RecordingsToBeDeletedRepository.table, 'WHERE date_to_delete < ?', [
      date,
    ])
  }

  static async getById(id: any) {
    return RecordingsToBeDeletedRepository.db.fetchOneById(RecordingsToBeDeletedRepository.table, id)
  }

  static async getByPostId(postId: any) {
    return RecordingsToBeDeletedRepository.db.fetchAll(RecordingsToBeDeletedRepository.table, 'WHERE post_id = ?', [
      postId,
    ])
  }

  static async getByUserId(userId: any) {
    return RecordingsToBeDeletedRepository.db.fetchAll(RecordingsToBeDeletedRepository.table, 'WHERE user_id = ?', [
      userId,
    ])
  }

  static async getByStreamId(streamId: any) {
    return RecordingsToBeDeletedRepository.db.fetchAll(RecordingsToBeDeletedRepository.table, 'WHERE stream_id = ?', [
      streamId,
    ])
  }

  static async getByVideoGuid(videoGuid: any) {
    return RecordingsToBeDeletedRepository.db.fetchAll(RecordingsToBeDeletedRepository.table, 'WHERE video_guid = ?', [
      videoGuid,
    ])
  }

  static async create(data: Record<string, any>) {
    return RecordingsToBeDeletedRepository.db.insert(
      RecordingsToBeDeletedRepository.table,
      RecordingsToBeDeletedRepository.getBaseDataStructure(data),
    )
  }

  static async updateById(id: any, data: Record<string, any>) {
    return RecordingsToBeDeletedRepository.db.update(
      RecordingsToBeDeletedRepository.table,
      RecordingsToBeDeletedRepository.getBaseDataStructure(data),
      { id },
    )
  }

  static async deleteById(id: any) {
    return RecordingsToBeDeletedRepository.db.delete(RecordingsToBeDeletedRepository.table, { id })
  }

  static getBaseDataStructure(data: Record<string, any>) {
    return {
      stream_id: data.stream_id ?? '',
      post_id: data.post_id != null ? Number(data.post_id) : 0,
      user_id: data.user_id != null ? Number(data.user_id) : 0,
      master_table_id: data.master_table_id != null ? Number(data.master_table_id) : 0,
      video_guid: data.video_guid ?? '',
      library_id: data.library_id ?? '',
      collection_id: data.collection_id ?? '',
      date_uploaded: data.date_uploaded ?? '',
      date_to_delete: data.date_to_delete ?? '',
      storage_size: data.storage_size != null ? Number(data.storage_size) : 0,
    }
  }
}
