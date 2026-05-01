import { getDatabase } from '@/core/database/databaseContext.js'
import { TABLE_SUFFIX } from '../Models/scheduleDeleted.js'

export class ScheduleDeletedRepository {
  private constructor() {}

  private static get db() {
    return getDatabase()
  }

  static get table() {
    return TABLE_SUFFIX
  }

  static async create(data: Record<string, any>) {
    return ScheduleDeletedRepository.db.insert(ScheduleDeletedRepository.table, data)
  }

  static async getByOriginalId(originalScheduleId: any) {
    return ScheduleDeletedRepository.db.fetchOneByCustom(
      ScheduleDeletedRepository.table,
      'WHERE original_schedule_id = ?',
      [originalScheduleId],
    )
  }

  static async getByPostId(postId: any) {
    return ScheduleDeletedRepository.db.fetchAll(
      ScheduleDeletedRepository.table,
      'WHERE post_id = ? ORDER BY deleted_at DESC',
      [postId],
    )
  }

  static async getAll() {
    return ScheduleDeletedRepository.db.fetchAll(ScheduleDeletedRepository.table, 'ORDER BY deleted_at DESC')
  }
}
