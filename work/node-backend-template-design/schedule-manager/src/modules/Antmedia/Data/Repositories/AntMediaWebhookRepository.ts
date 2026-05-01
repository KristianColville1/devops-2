import { getDatabase } from '@/core/database/databaseContext.js'
import { TABLE_SUFFIX } from '../Models/antMediaWebhookTable.js'

export class AntMediaWebhookRepository {
  private constructor() {}

  private static get db() {
    return getDatabase()
  }

  static get table() {
    return TABLE_SUFFIX
  }

  static async getAll() {
    return AntMediaWebhookRepository.db.fetchAll(AntMediaWebhookRepository.table)
  }

  static async getByPostId(postId: any) {
    return AntMediaWebhookRepository.db.fetchAll(AntMediaWebhookRepository.table, 'WHERE post_id = ? ORDER BY id DESC', [
      postId,
    ])
  }

  static async create(data: Record<string, any>) {
    return AntMediaWebhookRepository.db.insert(AntMediaWebhookRepository.table, data)
  }

  static async deleteById(id: any) {
    return AntMediaWebhookRepository.db.delete(AntMediaWebhookRepository.table, { id })
  }
}
