import { SiteClock } from '@/core/database/siteClock.js'
import { AllRecordingsRepository } from '@/modules/Recordings/Data/Repositories/AllRecordingsRepository.js'
import { PermanentRecordingsRepository } from '@/modules/Recordings/Data/Repositories/PermanentRecordingsRepository.js'
import { RecordingCollectionsRepository } from '@/modules/Recordings/Data/Repositories/RecordingCollectionsRepository.js'
import { RecordingsToBeDeletedRepository } from '@/modules/Recordings/Data/Repositories/RecordingsToBeDeletedRepository.js'
import { ScheduledRecordingsRepository } from '@/modules/Recordings/Data/Repositories/ScheduledRecordingsRepository.js'
import { ScheduleRepository } from '@/modules/Schedules/Data/Repositories/ScheduleRepository.js'
import { ScheduleRecordingHistoryRepository } from '@/modules/Schedules/Data/Repositories/ScheduleRecordingHistoryRepository.js'
import { StreamPermanentStorageRepository } from '@/modules/Storage/Data/Repositories/StreamPermanentStorageRepository.js'
import { PERMANENT_STORAGE_LIMIT_BYTES } from '@/modules/Storage/Services/permanentStorageConstants.js'
import {
  BUNNY_FULL_RECORDING_END_TOLERANCE_SECONDS,
  BUNNY_HISTORY_LOOKBACK_HOURS,
  BUNNY_NON_SCHEDULED_RETENTION_DAYS,
} from '@/modules/Recordings/Services/bunnyWebhookConstants.js'
import {
  findMatchingScheduleOccurrence,
  mapBunnyLibraryJsonToAllRecordingInsert,
} from '@/modules/Recordings/Services/bunnyWebhookRecordingMapper.js'
import type { BunnyLibraryVideoJson } from '@/modules/Recordings/Services/fetchBunnyVideoMetadata.js'
import { fetchBunnyVideoMetadata } from '@/modules/Recordings/Services/fetchBunnyVideoMetadata.js'

export type SanitizedBunnyWebhook = {
  status?: number
  videoLibraryId?: string
  videoGuid?: string
  raw: Record<string, unknown>
}

/** Normalize Bunny webhook JSON (keys used by legacy WP hook). */
export function sanitizeBunnyWebhookBody(body: unknown): SanitizedBunnyWebhook {
  const raw =
    body !== null && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {}
  const num = (v: unknown): number | undefined => {
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string' && v.trim() !== '') {
      const n = Number(v)
      if (!Number.isNaN(n)) return n
    }
    return undefined
  }
  const str = (v: unknown): string =>
    typeof v === 'string' ? v.trim() : v !== undefined && v !== null ? String(v).trim() : ''

  return {
    status: num(raw.Status ?? raw.status),
    videoLibraryId: str(raw.VideoLibraryId ?? raw.videoLibraryId) || undefined,
    videoGuid: str(raw.VideoGuid ?? raw.videoGuid) || undefined,
    raw,
  }
}

function logWebhookAlert(subject: string, message: string) {
  console.error(`[bunny-webhook] ${subject}\n${message}`)
}

function recordingUrls(libraryId: string, videoId: string) {
  return {
    iframe: `https://iframe.mediadelivery.net/play/${libraryId}/${videoId}/`,
    download: `https://recordings.churchcamlive.ie/${videoId}/original`,
  }
}

/** Resolve stream post + owner id without WordPress (schedule row + prior recording rows). */
async function resolvePostAndUserForStream(streamId: string): Promise<{ postId: number; userId: number } | null> {
  const schedules = await ScheduleRepository.getByStreamId(streamId)
  if (!schedules.length) return null
  const postId = Number((schedules[0] as any).post_id)
  if (!Number.isFinite(postId) || postId <= 0) return null

  let userId = 0
  const scheduled = await ScheduledRecordingsRepository.getAllRecordingsByPostId(postId)
  for (const row of scheduled) {
    const u = Number((row as any).user_id)
    if (u > 0) {
      userId = u
      break
    }
  }
  if (userId === 0) {
    const permanent = await PermanentRecordingsRepository.getByPostId(postId)
    for (const row of permanent) {
      const u = Number((row as any).user_id)
      if (Number.isFinite(u) && u > 0) {
        userId = u
        break
      }
    }
  }
  return { postId, userId }
}

function ymdFromWallDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function deletionQueuePayload(args: {
  streamId: string
  postId: number
  userId: number
  masterTableId: number
  videoGuid: string
  libraryId: string
  storageSize: number
  uploadMysqlWall: string
}) {
  const wall = SiteClock.mysqlWallToDate(args.uploadMysqlWall)
  const end = new Date(wall)
  end.setDate(end.getDate() + BUNNY_NON_SCHEDULED_RETENTION_DAYS)
  return {
    stream_id: args.streamId,
    post_id: args.postId,
    user_id: args.userId,
    master_table_id: args.masterTableId,
    video_guid: args.videoGuid,
    library_id: args.libraryId,
    date_uploaded: ymdFromWallDate(wall),
    date_to_delete: ymdFromWallDate(end),
    storage_size: args.storageSize,
  }
}

function scheduledRecordingFieldsFromBunny(data: BunnyLibraryVideoJson, dateUploaded: string) {
  return {
    date_uploaded: dateUploaded,
    views: data.views ?? 0,
    length_s: data.length ?? 0,
    framerate: data.framerate ?? 0,
    rotation: data.rotation ?? 0,
    width: data.width ?? 0,
    height: data.height ?? 0,
    resolutions:
      data.availableResolutions !== undefined && data.availableResolutions !== null
        ? String(data.availableResolutions)
        : 'N/A',
    thumbnail_count: data.thumbnailCount ?? 0,
    encode_progress: data.encodeProgress ?? 0,
    storage_size: data.storageSize ?? 0,
    thumbnail_file_name: data.thumbnailFileName ?? '',
    average_watch_time: data.averageWatchTime ?? 0,
    total_watch_time: data.totalWatchTime ?? 0,
  }
}

/**
 * Bunny encoding webhook orchestration (PHP `BunnyNetWebHook`), using repositories only.
 * WordPress-only `refresh_post_meta` is omitted.
 */
export class BunnyNetWebhookManager {
  private constructor() {}

  static async handle(body: unknown): Promise<Record<string, unknown>> {
    const p = sanitizeBunnyWebhookBody(body)
    if (p.status === undefined) return { ok: true, action: 'ignored_no_status' }

    if (p.status === 5) {
      logWebhookAlert('Video Encoding Failed CODE 5', JSON.stringify(p.raw, null, 2))
      return { ok: true, action: 'encoding_failed_logged' }
    }

    if (p.status !== 3) {
      return { ok: true, action: 'ignored_status', status: p.status }
    }

    return this.onEncodingFinished(p)
  }

  private static async onEncodingFinished(p: SanitizedBunnyWebhook): Promise<Record<string, unknown>> {
    const libraryId = p.videoLibraryId ?? ''
    const videoId = p.videoGuid ?? ''
    if (!libraryId || !videoId) {
      logWebhookAlert('Bunny webhook missing library/video id', JSON.stringify(p.raw, null, 2))
      return { ok: false, error: 'missing_ids' }
    }

    const accessKey = process.env.BUNNY_REC_PASS ?? ''
    if (!accessKey) {
      logWebhookAlert('BUNNY_REC_PASS is not set', '')
      return { ok: false, error: 'missing_bunny_rec_pass' }
    }

    const fetched = await fetchBunnyVideoMetadata(libraryId, videoId, accessKey)
    if (fetched.ok === false) {
      logWebhookAlert(
        'BUNNY => CCL: response wrong',
        `HTTP ${fetched.status} — ${fetched.bodyText.slice(0, 500)}`,
      )
      return { ok: false, error: 'bunny_http', status: fetched.status }
    }

    const data = fetched.body
    const title = typeof data.title === 'string' ? data.title : ''
    const parts = title.split('_')

    if (parts[0] === 'filter') {
      const slug = parts[1] ?? ''
      const outcome = await this.placeFilterRecording(libraryId, videoId, data, slug)
      return { ok: true, path: 'filter', ...outcome }
    }

    const slug = parts[0] ?? ''
    const antmediaScriptTimestamp = parts[3] ?? ''
    const outcome = await this.sortNormalRecording(libraryId, videoId, data, slug, antmediaScriptTimestamp)
    return { ok: true, path: 'standard', ...outcome }
  }

  /** Title prefix `filter_<collectionSlug>_…` — mixed-output recording path. */
  private static async placeFilterRecording(
    libraryId: string,
    videoId: string,
    data: BunnyLibraryVideoJson,
    collectionSlug: string,
  ): Promise<Record<string, unknown>> {
    if (!collectionSlug) return { action: 'filter_missing_slug' }

    const row = await RecordingCollectionsRepository.getCollectionByCollectionName(collectionSlug)
    if (!row) return { action: 'filter_collection_not_found' }

    const streamId = String((row as any).stream_id ?? '')
    const resolved = await resolvePostAndUserForStream(streamId)
    if (!resolved) return { action: 'filter_stream_unresolved' }

    const mapped = mapBunnyLibraryJsonToAllRecordingInsert(data)
    const dateUploaded = String(mapped.date_uploaded ?? '')
    const insertPayload = {
      ...mapped,
      stream_id: streamId,
      post_id: resolved.postId,
      library_id: libraryId,
      video_guid: videoId,
      date_uploaded: dateUploaded,
    }

    const allId = await AllRecordingsRepository.createRecording(insertPayload)
    if (allId == null) {
      logWebhookAlert('Database Error', `all_recordings insert failed post=${resolved.postId}`)
      return { action: 'filter_all_insert_failed' }
    }

    const { iframe, download } = recordingUrls(libraryId, videoId)
    const named = 'New Video Mixed recording'
    await ScheduledRecordingsRepository.createRecording({
      ...scheduledRecordingFieldsFromBunny(data, dateUploaded),
      recording_directory_id: allId,
      recording_name: named,
      stream_id: streamId,
      post_id: resolved.postId,
      user_id: resolved.userId,
      library_id: libraryId,
      video_guid: videoId,
      title: named,
      recording_url: iframe,
      download_url: download,
      is_public: 0,
    })

    return { action: 'filter_completed', all_recordings_id: allId }
  }

  /** Default Ant title `<slug>_…` — classify vs schedule history or queue deletion. */
  private static async sortNormalRecording(
    libraryId: string,
    videoId: string,
    data: BunnyLibraryVideoJson,
    slug: string,
    antmediaScriptTimestamp: string,
  ): Promise<Record<string, unknown>> {
    if (!slug) return { action: 'missing_slug' }

    const collection = await RecordingCollectionsRepository.getCollectionByCollectionName(slug)
    if (!collection) {
      logWebhookAlert('Database Error: Collection not found', JSON.stringify({ slug, libraryId, videoId }, null, 2))
      return { action: 'collection_not_found' }
    }

    const streamId = String((collection as any).stream_id ?? '')
    const resolved = await resolvePostAndUserForStream(streamId)
    if (!resolved) {
      logWebhookAlert('Database Error: Stream ID Wrong', JSON.stringify({ slug, streamId }, null, 2))
      return { action: 'stream_unresolved' }
    }

    const mapped = mapBunnyLibraryJsonToAllRecordingInsert(data)
    const insertPayload = {
      ...mapped,
      stream_id: streamId,
      post_id: resolved.postId,
      library_id: libraryId,
      video_guid: videoId,
    }

    const allId = await AllRecordingsRepository.createRecording(insertPayload)
    if (allId == null) {
      logWebhookAlert(
        'Database Error',
        `all_recordings insert failed post=${resolved.postId} data=${JSON.stringify(insertPayload)}`,
      )
      return { action: 'all_insert_failed' }
    }

    const lengthS = Number(data.length ?? 0)
    const occurrenceEvents = await ScheduleRecordingHistoryRepository.getRecentOccurrenceEventsForStream(
      resolved.postId,
      streamId,
      BUNNY_HISTORY_LOOKBACK_HOURS,
    )

    const matched = findMatchingScheduleOccurrence(
      occurrenceEvents as any[],
      antmediaScriptTimestamp,
      lengthS,
      BUNNY_FULL_RECORDING_END_TOLERANCE_SECONDS,
    )

    if (matched) {
      await this.insertScheduledFromOccurrence(matched as any, data, allId, streamId, resolved, libraryId, videoId)
      return { action: 'scheduled_from_occurrence', all_recordings_id: allId }
    }

    await RecordingsToBeDeletedRepository.create(
      deletionQueuePayload({
        streamId,
        postId: resolved.postId,
        userId: resolved.userId,
        masterTableId: allId,
        videoGuid: videoId,
        libraryId,
        storageSize: Number(data.storageSize ?? 0),
        uploadMysqlWall: String(mapped.date_uploaded ?? ''),
      }),
    )

    return { action: 'queued_non_scheduled_deletion', all_recordings_id: allId }
  }

  private static async insertScheduledFromOccurrence(
    occurrence: Record<string, unknown>,
    data: BunnyLibraryVideoJson,
    allRecordingsRowId: number,
    streamId: string,
    resolved: { postId: number; userId: number },
    libraryId: string,
    videoId: string,
  ) {
    const recordingName = String(occurrence.schedule_name ?? '').trim()
    const scheduleId = Number(occurrence.schedule_id ?? 0)
    let permanentStatus = 0
    let isPublic = 0

    if (scheduleId > 0) {
      const scheduleRow = await ScheduleRepository.getById(scheduleId)
      if (scheduleRow) {
        permanentStatus = Number((scheduleRow as any).permanent_status ?? 0)
        isPublic = Number((scheduleRow as any).is_visible ?? 0)
      }
    }

    const storageBytes = Number(data.storageSize ?? 0)
    if (permanentStatus === 1) {
      const already = await StreamPermanentStorageRepository.sumPermanentBytesForPost(resolved.postId)
      if (already + storageBytes > PERMANENT_STORAGE_LIMIT_BYTES) {
        permanentStatus = 0
      }
    }

    const { iframe, download } = recordingUrls(libraryId, videoId)
    const mapped = mapBunnyLibraryJsonToAllRecordingInsert(data)
    const dateUploaded = String(mapped.date_uploaded ?? '')

    await ScheduledRecordingsRepository.createRecording({
      ...scheduledRecordingFieldsFromBunny(data, dateUploaded),
      recording_directory_id: allRecordingsRowId,
      recording_name: recordingName,
      permanent_status: permanentStatus,
      stream_id: streamId,
      post_id: resolved.postId,
      user_id: resolved.userId,
      library_id: libraryId,
      video_guid: videoId,
      title: recordingName,
      recording_url: iframe,
      download_url: download,
      is_public: isPublic,
    })
  }
}
