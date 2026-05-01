import { SiteClock } from '@/core/database/siteClock.js'
import type { BunnyLibraryVideoJson } from '@/modules/Recordings/Services/fetchBunnyVideoMetadata.js'

/** UTC `dateUploaded` from Bunny → site wall clock string (parity with WP `convert_to_dublin_timezone` semantics). */
export function bunnyDateUploadedToSiteWall(dateUploadedIso: string | undefined): string {
  if (!dateUploadedIso?.trim()) return SiteClock.mysqlNow()
  const d = new Date(dateUploadedIso.trim())
  if (Number.isNaN(d.getTime())) return SiteClock.mysqlNow()
  return SiteClock.formatMysql(d)
}

export function mapBunnyLibraryJsonToAllRecordingInsert(data: BunnyLibraryVideoJson): Record<string, unknown> {
  const dateUploaded = bunnyDateUploadedToSiteWall(data.dateUploaded)
  return {
    date_uploaded: dateUploaded,
    views: data.views ?? 0,
    is_public: 0,
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

export type OccurrenceHistoryRow = {
  schedule_id?: string | number
  scheduled_start?: string
  scheduled_end?: string
  schedule_name?: string
}

/** Ant title segment: recording **end** in site-local wall components (PHP `parse_recording_end_datetime`). */
export function parseRecordingEndDatetime(antmediaScriptTimestamp: string): Date | null {
  const raw = antmediaScriptTimestamp.trim().replaceAll('T', ' ')
  const m = /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})(\.\d+)?$/.exec(raw)
  if (!m) return null
  const datePart = m[1]
  const timePart = m[2]
  const msFrac = m[3] ? Math.round(Number.parseFloat(m[3]) * 1000) : 0
  const [y, mo, da] = datePart.split('-').map(Number)
  const [h, mi, s] = timePart.split(':').map(Number)
  return new Date(y, mo - 1, da, h, mi, s, msFrac)
}

function parseScheduledWall(mysql: string): Date | null {
  const raw = mysql.trim()
  const m = /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})$/.exec(raw)
  if (!m) return null
  const [_, d, t] = m
  const [y, mo, da] = d.split('-').map(Number)
  const [h, mi, s] = t.split(':').map(Number)
  return new Date(y, mo - 1, da, h, mi, s)
}

/** Full recording: covers scheduled duration and ends within tolerance of scheduled end. */
export function recordingIsFullForOccurrence(
  recordingStart: Date,
  recordingEnd: Date,
  lengthS: number,
  scheduledStart: Date,
  scheduledEnd: Date,
  toleranceSeconds: number,
): boolean {
  const scheduleDurationSec = (scheduledEnd.getTime() - scheduledStart.getTime()) / 1000
  if (lengthS < scheduleDurationSec) return false
  const endDiffSec = Math.abs(recordingEnd.getTime() - scheduledEnd.getTime()) / 1000
  return endDiffSec <= toleranceSeconds
}

/**
 * Pick one schedule occurrence from recent history that matches this encoded file (PHP `find_matching_schedule_occurrence`).
 */
export function findMatchingScheduleOccurrence(
  events: OccurrenceHistoryRow[],
  antmediaScriptTimestamp: string,
  lengthS: number,
  toleranceSeconds: number,
): OccurrenceHistoryRow | null {
  if (!events.length) return null
  const recordingEnd = parseRecordingEndDatetime(antmediaScriptTimestamp)
  if (!recordingEnd) return null
  const recordingStart = new Date(recordingEnd.getTime() - lengthS * 1000)

  let bestMatch: OccurrenceHistoryRow | null = null
  const seen = new Set<string>()

  for (const event of events) {
    const scheduleId = String(event.schedule_id ?? '0')
    const ss = String(event.scheduled_start ?? '')
    const se = String(event.scheduled_end ?? '')
    const key = `${scheduleId}|${ss}|${se}`
    if (seen.has(key)) continue
    seen.add(key)

    const scheduledStart = parseScheduledWall(ss)
    const scheduledEnd = parseScheduledWall(se)
    if (!scheduledStart || !scheduledEnd) continue

    const isFull = recordingIsFullForOccurrence(
      recordingStart,
      recordingEnd,
      lengthS,
      scheduledStart,
      scheduledEnd,
      toleranceSeconds,
    )
    const overlaps =
      recordingStart.getTime() < scheduledEnd.getTime() && recordingEnd.getTime() > scheduledStart.getTime()

    if (isFull) return event
    if (overlaps && bestMatch === null) bestMatch = event
  }

  return bestMatch
}
