import { getDatabase } from '@/core/database/databaseContext.js'
import { TABLE_SUFFIX } from '../Models/scheduleRecordingHistoryArchive.js'

export class ScheduleRecordingHistoryArchiveRepository {
  private constructor() {}

  private static get db() {
    return getDatabase()
  }

  static get table() {
    return TABLE_SUFFIX
  }

  static async create(data: Record<string, any>) {
    return ScheduleRecordingHistoryArchiveRepository.db.insert(
      ScheduleRecordingHistoryArchiveRepository.table,
      data,
    )
  }

  static async getByScheduleId(scheduleId: any, limit = 100) {
    return ScheduleRecordingHistoryArchiveRepository.db.fetchAll(
      ScheduleRecordingHistoryArchiveRepository.table,
      'WHERE schedule_id = ? ORDER BY event_datetime DESC LIMIT ?',
      [scheduleId, limit],
    )
  }

  static async getByPostStream(
    postId: any,
    streamId: any,
    startDate: any = null,
    endDate: any = null,
  ) {
    let where = 'WHERE post_id = ? AND stream_id = ?'
    const params: any[] = [postId, streamId]
    if (startDate && endDate) {
      where += ' AND event_datetime BETWEEN ? AND ?'
      params.push(startDate, endDate)
    }
    where += ' ORDER BY event_datetime ASC'
    return ScheduleRecordingHistoryArchiveRepository.db.fetchAll(
      ScheduleRecordingHistoryArchiveRepository.table,
      where,
      params,
    )
  }

  static async getByDateRange(startDate: any, endDate: any) {
    return ScheduleRecordingHistoryArchiveRepository.db.fetchAll(
      ScheduleRecordingHistoryArchiveRepository.table,
      'WHERE event_datetime BETWEEN ? AND ? ORDER BY event_datetime ASC',
      [startDate, endDate],
    )
  }
}
