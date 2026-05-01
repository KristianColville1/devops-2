import { env } from '@/core/env.js'

const DEFAULT_ORIGIN = 'https://admin.churchcamlive.ie'

export function wordpressRestOrigin(): string {
  const o = env('CCL_WORDPRESS_REST_ORIGIN')
  if (o && o.trim()) return o.replace(/\/$/, '')
  return DEFAULT_ORIGIN
}

export function syncHttpTimeoutMs(): number {
  const s = Number(env('CCL_SYNC_HTTP_TIMEOUT_SECONDS') || '600')
  if (!Number.isFinite(s) || s < 1) return 600_000
  return Math.min(s * 1000, 86_400_000)
}

export type WpTableDataJson = {
  ok?: boolean
  error?: string
  message?: string
  table?: string
  suffix?: string
  count?: number
  rows?: Record<string, unknown>[]
}

/** GET `/wp-json/ccl_sync/v1/table-data?table=<suffix>` — suffix only, e.g. ccl_stream_all_recordings */
export async function fetchWordPressTableData(
  suffix: string,
  bearerJwt: string,
): Promise<WpTableDataJson> {
  const base = wordpressRestOrigin()
  const path = `/wp-json/ccl_sync/v1/table-data?table=${encodeURIComponent(suffix)}`
  const url = `${base}${path}`
  const ms = syncHttpTimeoutMs()
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), ms)

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${bearerJwt}`,
        Accept: 'application/json',
      },
      signal: ac.signal,
    })

    const text = await res.text()
    let body: WpTableDataJson = {}
    try {
      body = JSON.parse(text) as WpTableDataJson
    } catch {
      body = { ok: false, error: 'invalid_json', message: text.slice(0, 200) }
    }

    if (!res.ok && body.ok !== false) {
      body = {
        ok: false,
        error: `http_${res.status}`,
        message: text.slice(0, 500),
      }
    }

    return body
  } finally {
    clearTimeout(timer)
  }
}

export type WpPingResult = {
  httpStatus: number
  body: Record<string, unknown>
}

/** GET `/wp-json/ccl_sync/v1/ping` — JWT required. */
export async function fetchWordPressPing(
  bearerJwt: string,
): Promise<WpPingResult> {
  const base = wordpressRestOrigin()
  const url = `${base}/wp-json/ccl_sync/v1/ping`
  const ms = Math.min(syncHttpTimeoutMs(), 120_000)
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), ms)

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${bearerJwt}`,
        Accept: 'application/json',
      },
      signal: ac.signal,
    })
    const text = await res.text()
    let body: Record<string, unknown> = {}
    try {
      body = JSON.parse(text) as Record<string, unknown>
    } catch {
      body = { parse_error: true, raw: text.slice(0, 300) }
    }
    return { httpStatus: res.status, body }
  } finally {
    clearTimeout(timer)
  }
}
