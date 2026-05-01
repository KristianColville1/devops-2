import { getDatabase } from '@/core/database/databaseContext.js'
import { TABLE_SUFFIX } from '../Models/recordingUsage.js'

export class RecordingUsageRepository {
  private constructor() {}

  private static get db() {
    return getDatabase()
  }

  static get table() {
    return TABLE_SUFFIX
  }

  static async getAll() {
    return RecordingUsageRepository.db.fetchAll(RecordingUsageRepository.table, 'ORDER BY id DESC')
  }

  static async getLatest() {
    return RecordingUsageRepository.db.fetchOneByCustom(RecordingUsageRepository.table, 'ORDER BY id DESC LIMIT 1', [])
  }

  static async create(data: Record<string, any>) {
    return RecordingUsageRepository.db.insert(RecordingUsageRepository.table, {
      all_recordings: data.all_recordings ?? 0,
      scheduled_recordings: data.scheduled_recordings ?? 0,
    })
  }

  static async deleteById(id: any) {
    return RecordingUsageRepository.db.delete(RecordingUsageRepository.table, { id })
  }
}
