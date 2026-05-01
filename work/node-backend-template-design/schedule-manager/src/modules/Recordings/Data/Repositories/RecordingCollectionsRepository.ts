import { getDatabase } from '@/core/database/databaseContext.js'
import { TABLE_SUFFIX } from '../Models/recordingCollections.js'

export class RecordingCollectionsRepository {
  private constructor() {}

  private static get db() {
    return getDatabase()
  }

  static get table() {
    return TABLE_SUFFIX
  }

  static async getAllCollections() {
    return RecordingCollectionsRepository.db.fetchAll(RecordingCollectionsRepository.table)
  }

  static async getCollectionById(id: any) {
    return RecordingCollectionsRepository.db.fetchOneById(RecordingCollectionsRepository.table, id)
  }

  static async getCollectionsByStreamId(streamId: any) {
    return RecordingCollectionsRepository.db.fetchAll(RecordingCollectionsRepository.table, 'WHERE stream_id = ?', [
      streamId,
    ])
  }

  static async getCollectionsByLibraryId(libraryId: any) {
    return RecordingCollectionsRepository.db.fetchAll(RecordingCollectionsRepository.table, 'WHERE library_id = ?', [
      libraryId,
    ])
  }

  /** Lookup by `collection_name` (Ant recording title slug segment). */
  static async getCollectionByCollectionName(collectionName: string) {
    return RecordingCollectionsRepository.db.fetchOneByCustom(
      RecordingCollectionsRepository.table,
      'WHERE collection_name = ?',
      [collectionName],
    )
  }

  static async createCollection(data: Record<string, any>) {
    return RecordingCollectionsRepository.db.insert(
      RecordingCollectionsRepository.table,
      RecordingCollectionsRepository.getBaseDataStructure(data),
    )
  }

  static async updateCollection(id: any, data: Record<string, any>) {
    return RecordingCollectionsRepository.db.update(
      RecordingCollectionsRepository.table,
      RecordingCollectionsRepository.getBaseDataStructure(data),
      { id },
    )
  }

  static async deleteCollection(id: any) {
    return RecordingCollectionsRepository.db.delete(RecordingCollectionsRepository.table, { id })
  }

  static getBaseDataStructure(data: Record<string, any>) {
    return {
      stream_id: data.stream_id ?? '',
      library_id: data.library_id ?? '',
      collection_guid: data.collection_guid ?? '',
      collection_name: data.collection_name ?? '',
      video_count: data.video_count ?? 0,
      collection_size_bytes: data.collection_size_bytes ?? 0,
    }
  }
}
