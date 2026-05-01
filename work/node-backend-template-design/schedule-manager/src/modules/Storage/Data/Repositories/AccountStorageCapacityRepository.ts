import { getDatabase } from '@/core/database/databaseContext.js'
import { TABLE_SUFFIX } from '../Models/accountStorageCapacityInformation.js'

export class AccountStorageCapacityRepository {
  private constructor() {}

  private static get db() {
    return getDatabase()
  }

  static get table() {
    return TABLE_SUFFIX
  }

  static async getAll() {
    return AccountStorageCapacityRepository.db.fetchAll(AccountStorageCapacityRepository.table)
  }

  static async getById(id: any) {
    return AccountStorageCapacityRepository.db.fetchOneById(AccountStorageCapacityRepository.table, id)
  }

  static async getByPostId(postId: any) {
    return AccountStorageCapacityRepository.db.fetchAll(AccountStorageCapacityRepository.table, 'WHERE post_id = ?', [
      postId,
    ])
  }

  static async getByStreamId(streamId: any) {
    return AccountStorageCapacityRepository.db.fetchAll(AccountStorageCapacityRepository.table, 'WHERE stream_id = ?', [
      streamId,
    ])
  }

  static async create(data: Record<string, any>) {
    return AccountStorageCapacityRepository.db.insert(
      AccountStorageCapacityRepository.table,
      AccountStorageCapacityRepository.normalize(data),
    )
  }

  static async update(id: any, data: Record<string, any>) {
    return AccountStorageCapacityRepository.db.update(
      AccountStorageCapacityRepository.table,
      AccountStorageCapacityRepository.normalize(data),
      { id },
    )
  }

  static async delete(id: any) {
    return AccountStorageCapacityRepository.db.delete(AccountStorageCapacityRepository.table, { id })
  }

  static normalize(data: Record<string, any>) {
    return {
      stream_id: data.stream_id ?? '',
      capacity: data.capacity ?? '100',
      post_id: data.post_id ?? 0,
      user_id: data.user_id ?? 0,
      account_name: data.account_name ?? '',
      max_capacity_gb: data.max_capacity_gb ?? 0,
      current_capacity_gb: data.current_capacity_gb ?? 0,
      storage_note: data.storage_note ?? '',
    }
  }
}
