import { getDatabase } from '@/core/database/databaseContext.js'
import { TABLE_SUFFIX } from '../Models/totalBusinessDailyStorage.js'

export class TotalBusinessDailyStorageRepository {
  private constructor() {}

  private static get db() {
    return getDatabase()
  }

  static get table() {
    return TABLE_SUFFIX
  }

  static async getAll() {
    return TotalBusinessDailyStorageRepository.db.fetchAll(TotalBusinessDailyStorageRepository.table)
  }

  static async getByPostId(postId: any) {
    return TotalBusinessDailyStorageRepository.db.fetchAll(
      TotalBusinessDailyStorageRepository.table,
      'WHERE post_id = ? ORDER BY date DESC',
      [postId],
    )
  }

  static async getByPostAndDate(postId: any, date: string) {
    return TotalBusinessDailyStorageRepository.db.fetchOneByCustom(
      TotalBusinessDailyStorageRepository.table,
      'WHERE post_id = ? AND date = ?',
      [postId, date],
    )
  }

  static async create(data: Record<string, any>) {
    return TotalBusinessDailyStorageRepository.db.insert(
      TotalBusinessDailyStorageRepository.table,
      TotalBusinessDailyStorageRepository.normalize(data),
    )
  }

  static async update(id: any, data: Record<string, any>) {
    return TotalBusinessDailyStorageRepository.db.update(
      TotalBusinessDailyStorageRepository.table,
      TotalBusinessDailyStorageRepository.normalize(data),
      { id },
    )
  }

  static async delete(id: any) {
    return TotalBusinessDailyStorageRepository.db.delete(TotalBusinessDailyStorageRepository.table, { id })
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
