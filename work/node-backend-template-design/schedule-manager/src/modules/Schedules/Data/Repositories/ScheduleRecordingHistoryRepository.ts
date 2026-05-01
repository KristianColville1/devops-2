import { quoteIdent } from '@/core/database/Database.js'
import { getDatabase } from '@/core/database/databaseContext.js'
import { SiteClock } from '@/core/database/siteClock.js'
import { TABLE_SUFFIX } from '../Models/scheduleRecordingHistory.js'

/** Live schedule recording history — static methods only. */
export class ScheduleRecordingHistoryRepository {
  private constructor() {}

  private static get db() {
    return getDatabase()
  }

  static get table() {
    return TABLE_SUFFIX
  }

  static async create(data: Record<string, any>) {
    return ScheduleRecordingHistoryRepository.db.insert(ScheduleRecordingHistoryRepository.table, data)
  }

  static async isCurrentlyRecording(scheduleId: any) {
    const rows = await ScheduleRecordingHistoryRepository.db.fetchAll(
      ScheduleRecordingHistoryRepository.table,
      'WHERE schedule_id = ? ORDER BY event_datetime DESC, id DESC LIMIT 1',
      [scheduleId],
    )
    if (!rows.length) return false
    return rows[0]?.event_type === 'start'
  }

  static async getLatestEvent(scheduleId: any) {
    return ScheduleRecordingHistoryRepository.db.fetchOneByCustom(
      ScheduleRecordingHistoryRepository.table,
      'WHERE schedule_id = ? ORDER BY event_datetime DESC, id DESC LIMIT 1',
      [scheduleId],
    )
  }

  static async getByScheduleId(scheduleId: any, limit = 100) {
    return ScheduleRecordingHistoryRepository.db.fetchAll(
      ScheduleRecordingHistoryRepository.table,
      'WHERE schedule_id = ? ORDER BY event_datetime DESC LIMIT ?',
      [scheduleId, limit],
    )
  }

  static async getRecentStopEventsForStream(postId: any, streamId: any, hoursBack = 4) {
    const endDate = SiteClock.mysqlNow()
    const startDate = SiteClock.mysqlHoursAgo(hoursBack)
    return ScheduleRecordingHistoryRepository.db.fetchAll(
      ScheduleRecordingHistoryRepository.table,
      `WHERE post_id = ? AND stream_id = ? AND event_type = 'stop'
       AND event_datetime BETWEEN ? AND ? ORDER BY event_datetime DESC`,
      [postId, streamId, startDate, endDate],
    )
  }

  static async getRecentOccurrenceEventsForStream(postId: any, streamId: any, hoursBack = 4) {
    const endDate = SiteClock.mysqlNow()
    const startDate = SiteClock.mysqlHoursAgo(hoursBack)
    return ScheduleRecordingHistoryRepository.db.fetchAll(
      ScheduleRecordingHistoryRepository.table,
      `WHERE post_id = ? AND stream_id = ?
       AND event_type IN ('start', 'stop')
       AND event_datetime BETWEEN ? AND ? ORDER BY event_datetime DESC`,
      [postId, streamId, startDate, endDate],
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
    return ScheduleRecordingHistoryRepository.db.fetchAll(ScheduleRecordingHistoryRepository.table, where, params)
  }

  static async updateById(id: unknown, data: Record<string, any>) {
    return ScheduleRecordingHistoryRepository.db.update(ScheduleRecordingHistoryRepository.table, data, {
      id,
    })
  }

  static async hasStartForOccurrence(scheduleId: any, scheduledStart: string) {
    const rows = await ScheduleRecordingHistoryRepository.db.fetchAll(
      ScheduleRecordingHistoryRepository.table,
      `WHERE schedule_id = ? AND event_type = 'start' AND scheduled_start = ? LIMIT 1`,
      [scheduleId, scheduledStart],
    )
    return rows.length > 0
  }

  static async getFailedEvents(days = 7) {
    const cutoff = SiteClock.mysqlDaysBefore(days)
    return ScheduleRecordingHistoryRepository.db.fetchAll(
      ScheduleRecordingHistoryRepository.table,
      `WHERE origin_api_success = 0 AND event_datetime >= ? ORDER BY event_datetime DESC`,
      [cutoff],
    )
  }

  static async getStartEventsWithoutStops() {
    const t = quoteIdent(ScheduleRecordingHistoryRepository.db.qualify(ScheduleRecordingHistoryRepository.table))
    const sql = `
      SELECT s.* FROM ${t} s
      LEFT JOIN ${t} st ON (
        s.schedule_id = st.schedule_id
        AND st.event_type = 'stop'
        AND s.scheduled_start = st.scheduled_start
        AND s.scheduled_end = st.scheduled_end
      )
      WHERE s.event_type = 'start'
      AND st.id IS NULL
      ORDER BY s.event_datetime DESC
    `.trim()
    return ScheduleRecordingHistoryRepository.db.query(sql, [])
  }
}
