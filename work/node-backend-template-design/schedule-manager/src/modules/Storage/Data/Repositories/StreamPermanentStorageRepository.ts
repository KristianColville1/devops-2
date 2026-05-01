import { quoteIdent } from '@/core/database/Database.js'
import { getDatabase } from '@/core/database/databaseContext.js'
import { TABLE_SUFFIX as SCHEDULED_RECORDINGS } from '@/modules/Recordings/Data/Models/scheduledRecordings.js'

const UPLOADED_VIDEOS_SUFFIX = 'ccl_stream_uploaded_videos'

/** Aggregates over scheduled recordings + uploads — static methods only. */
export class StreamPermanentStorageRepository {
  private constructor() {}

  private static get db() {
    return getDatabase()
  }

  static async sumPermanentBytesForPost(postId: number) {
    const t = quoteIdent(StreamPermanentStorageRepository.db.qualify(SCHEDULED_RECORDINGS))
    const sql = `SELECT COALESCE(SUM(storage_size), 0) AS total FROM ${t} WHERE post_id = ? AND permanent_status = 1`
    const rows = await StreamPermanentStorageRepository.db.query(sql, [postId])
    return Number((rows[0] as any)?.total ?? 0)
  }

  static async sumPermanentBytesForPosts(postIds: number[]) {
    const ids = [...new Set(postIds.filter((n) => Number.isFinite(n) && n > 0).map((n) => Math.floor(n)))]
    if (ids.length === 0) return {} as Record<number, number>
    const t = quoteIdent(StreamPermanentStorageRepository.db.qualify(SCHEDULED_RECORDINGS))
    const placeholders = ids.map(() => '?').join(',')
    const sql = `SELECT post_id, COALESCE(SUM(storage_size), 0) AS total FROM ${t} WHERE permanent_status = 1 AND post_id IN (${placeholders}) GROUP BY post_id`
    const rows = await StreamPermanentStorageRepository.db.query(sql, ids)
    const out: Record<number, number> = {}
    for (const id of ids) out[id] = 0
    for (const row of rows as any[]) {
      out[Number(row.post_id)] = Number(row.total)
    }
    return out
  }

  static async sumUploadBytesForPost(postId: number) {
    const t = quoteIdent(StreamPermanentStorageRepository.db.qualify(UPLOADED_VIDEOS_SUFFIX))
    const sql = `SELECT COALESCE(SUM(storage_size), 0) AS total FROM ${t} WHERE post_id = ?`
    const rows = await StreamPermanentStorageRepository.db.query(sql, [postId])
    return Number((rows[0] as any)?.total ?? 0)
  }
}
