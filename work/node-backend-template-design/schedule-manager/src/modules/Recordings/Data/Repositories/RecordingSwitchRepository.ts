import { getDatabase } from '@/core/database/databaseContext.js'
import { TABLE_SUFFIX } from '../Models/recordingSwitch.js'

export class RecordingSwitchRepository {
  private constructor() {}

  private static get db() {
    return getDatabase()
  }

  static get table() {
    return TABLE_SUFFIX
  }

  static async getAll() {
    return RecordingSwitchRepository.db.fetchAll(RecordingSwitchRepository.table)
  }

  static async getById(id: any) {
    return RecordingSwitchRepository.db.fetchOneById(RecordingSwitchRepository.table, id)
  }

  static async getByPostId(postId: any) {
    return RecordingSwitchRepository.db.fetchAll(RecordingSwitchRepository.table, 'WHERE post_id = ?', [postId])
  }

  static async getByStreamId(streamId: any) {
    return RecordingSwitchRepository.db.fetchAll(RecordingSwitchRepository.table, 'WHERE stream_id = ?', [streamId])
  }

  static async create(data: Record<string, any>) {
    return RecordingSwitchRepository.db.insert(RecordingSwitchRepository.table, data)
  }

  static async update(id: any, data: Record<string, any>) {
    return RecordingSwitchRepository.db.update(RecordingSwitchRepository.table, data, { id })
  }

  static async delete(id: any) {
    return RecordingSwitchRepository.db.delete(RecordingSwitchRepository.table, { id })
  }
}
