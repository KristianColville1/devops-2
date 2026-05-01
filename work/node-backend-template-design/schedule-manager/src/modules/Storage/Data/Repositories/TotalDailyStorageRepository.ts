import { getDatabase } from '@/core/database/databaseContext.js'
import { TABLE_SUFFIX } from '../Models/totalDailyStorage.js'

export class TotalDailyStorageRepository {
  private constructor() {}

  private static get db() {
    return getDatabase()
  }

  static get table() {
    return TABLE_SUFFIX
  }

  static async getAll() {
    return TotalDailyStorageRepository.db.fetchAll(TotalDailyStorageRepository.table)
  }

  static async getByPostId(postId: any) {
    return TotalDailyStorageRepository.db.fetchAll(TotalDailyStorageRepository.table, 'WHERE post_id = ? ORDER BY date DESC', [
      postId,
    ])
  }

  static async getByPostAndDate(postId: any, date: string) {
    return TotalDailyStorageRepository.db.fetchOneByCustom(TotalDailyStorageRepository.table, 'WHERE post_id = ? AND date = ?', [
      postId,
      date,
    ])
  }

  static async create(data: Record<string, any>) {
    return TotalDailyStorageRepository.db.insert(TotalDailyStorageRepository.table, TotalDailyStorageRepository.normalize(data))
  }

  static async update(id: any, data: Record<string, any>) {
    return TotalDailyStorageRepository.db.update(TotalDailyStorageRepository.table, TotalDailyStorageRepository.normalize(data), {
      id,
    })
  }

  static async delete(id: any) {
    return TotalDailyStorageRepository.db.delete(TotalDailyStorageRepository.table, { id })
  }

  static normalize(data: Record<string, any>) {
    return {
      stream_id: data.stream_id ?? '',
      post_id: data.post_id ?? 0,
      post_slug: data.post_slug ?? '',
      total_storage: data.total_storage ?? 0,
      total_uploads_storage: data.total_uploads_storage ?? 0,
      total_recorded_storage: data.total_recorded_storage ?? 0,
      date: data.date ?? '',
    }
  }
}
