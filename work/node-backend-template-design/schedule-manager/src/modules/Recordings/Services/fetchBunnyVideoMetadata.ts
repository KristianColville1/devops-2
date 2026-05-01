export type BunnyLibraryVideoJson = {
  title?: string
  dateUploaded?: string
  views?: number
  length?: number
  framerate?: number
  rotation?: number
  width?: number
  height?: number
  availableResolutions?: string
  thumbnailCount?: number
  encodeProgress?: number
  storageSize?: number
  thumbnailFileName?: string
  averageWatchTime?: number
  totalWatchTime?: number
}

/** GET Bunny Stream API metadata for one video (same URL as legacy PHP). */
export async function fetchBunnyVideoMetadata(
  libraryId: string,
  videoId: string,
  accessKey: string,
): Promise<
  | { ok: true; status: number; body: BunnyLibraryVideoJson }
  | { ok: false; status: number; bodyText: string }
> {
  const url = `https://video.bunnycdn.com/library/${encodeURIComponent(libraryId)}/videos/${encodeURIComponent(videoId)}`
  const res = await fetch(url, {
    headers: {
      AccessKey: accessKey,
      accept: 'application/json',
    },
  })
  const status = res.status
  const text = await res.text()
  if (!res.ok) return { ok: false, status, bodyText: text }
  try {
    const body = JSON.parse(text) as BunnyLibraryVideoJson
    return { ok: true, status, body }
  } catch {
    return { ok: false, status, bodyText: text }
  }
}
