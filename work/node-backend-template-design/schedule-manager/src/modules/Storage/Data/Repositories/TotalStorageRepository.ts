import { getDatabase } from '@/core/database/databaseContext.js'
import { TABLE_SUFFIX } from '../Models/totalStorage.js'

export class TotalStorageRepository {
  private constructor() {}

  private static get db() {
    return getDatabase()
  }

  static get table() {
    return TABLE_SUFFIX
  }

  static async getFirst() {
    return TotalStorageRepository.db.fetchOneByCustom(TotalStorageRepository.table, 'ORDER BY id ASC LIMIT 1', [])
  }

  static async getAll() {
    return TotalStorageRepository.db.fetchAll(TotalStorageRepository.table)
  }

  static async updateById(id: any, data: Record<string, any>) {
    return TotalStorageRepository.db.update(TotalStorageRepository.table, data, { id })
  }

  static async create(data: Record<string, any>) {
    return TotalStorageRepository.db.insert(TotalStorageRepository.table, {
      total: data.total ?? 0,
      total_uploads: data.total_uploads ?? 0,
      total_recorded: data.total_recorded ?? 0,
    })
  }
}
