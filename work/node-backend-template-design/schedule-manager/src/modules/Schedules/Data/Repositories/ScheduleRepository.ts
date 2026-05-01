import { getDatabase } from '@/core/database/databaseContext.js'
import { SiteClock } from '@/core/database/siteClock.js'
import { TABLE_SUFFIX } from '../Models/scheduleV2.js'

/**
 * LibSQL data access for `ccl_stream_schedule_v2`, aligned with WordPress `ScheduleRepository` (V2).
 * Static methods only — no repository instances.
 */
export class ScheduleRepository {
  private constructor() {}

  private static get db() {
    return getDatabase()
  }

  static get table() {
    return TABLE_SUFFIX
  }

  static async getAll() {
    return ScheduleRepository.db.fetchAll(ScheduleRepository.table)
  }

  static async getById(id: any) {
    return ScheduleRepository.db.fetchOneById(ScheduleRepository.table, id)
  }

  static async getByPostId(postId: any, includeVisibleOnly = false) {
    let where = 'WHERE post_id = ?'
    const args: any[] = [postId]
    if (includeVisibleOnly) {
      where += ' AND is_visible = 1'
    }
    return ScheduleRepository.db.fetchAll(ScheduleRepository.table, where, args)
  }

  static async getByStreamId(streamId: any) {
    return ScheduleRepository.db.fetchAll(ScheduleRepository.table, 'WHERE stream_id = ?', [streamId])
  }

  static async getRecordingSchedules() {
    const now = SiteClock.mysqlNow()
    return ScheduleRepository.db.fetchAll(
      ScheduleRepository.table,
      `WHERE record_events = 1 AND (repeat_until IS NULL OR repeat_until >= ?) ORDER BY first_start ASC`,
      [now],
    )
  }

  static async getSchedulesToStartCandidates() {
    const now = SiteClock.mysqlNow()
    const nowPlus5 = SiteClock.plusMinutes(5)
    return ScheduleRepository.db.fetchAll(
      ScheduleRepository.table,
      `WHERE record_events = 1 AND (repeat_until IS NULL OR repeat_until >= ?)
       AND (first_start BETWEEN ? AND ?) ORDER BY first_start ASC`,
      [now, now, nowPlus5],
    )
  }

  static async getSchedulesToStopCandidates() {
    const now = SiteClock.mysqlNow()
    const nowMinus5 = SiteClock.minusMinutes(5)
    return ScheduleRepository.db.fetchAll(
      ScheduleRepository.table,
      `WHERE record_events = 1 AND (repeat_until IS NULL OR repeat_until >= ?)
       AND first_end <= ? AND first_end >= ? ORDER BY first_end ASC`,
      [now, now, nowMinus5],
    )
  }

  static async create(data: Record<string, any>) {
    return ScheduleRepository.db.insert(ScheduleRepository.table, data)
  }

  static async update(id: any, data: Record<string, any>) {
    return ScheduleRepository.db.update(ScheduleRepository.table, data, { id })
  }

  static async delete(id: any) {
    return ScheduleRepository.db.delete(ScheduleRepository.table, { id })
  }
}
