/**
 * Helpers shared by recording repositories (stream listings + queue dates).
 */

/** Public fields returned for scheduled recording stream listings. */
export const SCHEDULED_RECORDING_STREAM_PUBLIC_FIELDS = [
  'id',
  'recording_name',
  'recording_url',
  'date_uploaded',
  'thumbnail_file_name',
  'length_s',
  'video_guid',
  'is_public',
] as const

/** Strip to listed columns; keep only rows where `is_public` is set. */
export function filterScheduledStreamPublicRows(rows: any[]) {
  const out: any[] = []
  for (const rec of rows) {
    if (rec.is_public != 1 && rec.is_public !== true) continue
    const slim: any = {}
    for (const k of SCHEDULED_RECORDING_STREAM_PUBLIC_FIELDS) {
      if (k in rec) slim[k] = rec[k]
    }
    out.push(slim)
  }
  return out
}

/** Y-m-d date string `days` from today (local calendar), used like PHP `date('Y-m-d', strtotime('+14 days'))`. */
export function datePlusDaysYmd(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
