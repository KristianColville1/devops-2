import { env } from '@/core/env.js'

function stripTrailingSlash(u: string) {
  return u.replace(/\/$/, '')
}

/** Same define names as WordPress `wp-config.php` (`ORIGIN_AMS_*`). */
export function originAmsSecretKey(): string {
  return env('ORIGIN_AMS_SECRET_KEY') ?? ''
}

export function originAmsBaseUrl(): string {
  return stripTrailingSlash(env('ORIGIN_AMS_BASE_URL') ?? '')
}

/** Filters API root (`ORIGIN_FILTER_URL`). */
export function originFilterUrl(): string {
  return stripTrailingSlash(env('ORIGIN_FILTER_URL') ?? '')
}

/** Playlist stack (`PLAYLIST_AMS_*`). */
export function playlistAmsSecretKey(): string {
  return env('PLAYLIST_AMS_SECRET_KEY') ?? ''
}

export function playlistAmsBaseUrl(): string {
  return stripTrailingSlash(env('PLAYLIST_AMS_BASE_URL') ?? '')
}

/** Milliseconds between staggered recording PUTs (queued batches). Default 500. */
export function recordingBatchDelayMs(): number {
  const raw = env('ORIGIN_AMS_RECORDING_BATCH_GAP_MS')
  if (raw === undefined) return 500
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n >= 0 ? n : 500
}
