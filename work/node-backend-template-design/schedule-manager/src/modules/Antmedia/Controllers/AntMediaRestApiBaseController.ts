import { BaseController } from '@/core/http/BaseController.js'
import { joinUrl, responseStatusBody } from '@/core/http/shared.js'
import {
  originAmsBaseUrl,
  originAmsSecretKey,
  originFilterUrl,
  playlistAmsBaseUrl,
  playlistAmsSecretKey,
  recordingBatchDelayMs,
} from '@/modules/Antmedia/Services/antMediaEnv.js'
import {
  generateOriginAmsJwt,
  generatePlaylistAmsJwt,
} from '@/modules/Antmedia/Services/antMediaJwt.js'
import { enqueueRecordingStatusBatch } from '@/modules/Antmedia/Services/recordingStatusQueue.js'

/**
 * Fetch-based Ant Media REST client. Reads ORIGIN_AMS_*, ORIGIN_FILTER_URL,
 * PLAYLIST_AMS_*, ORIGIN_AMS_RECORDING_BATCH_GAP_MS from env (same names as WordPress where applicable).
 *
 * RTMP helpers take stream ids directly (no WordPress post lookup).
 */
export class AntMediaRestApiBaseController extends BaseController {
  /** Origin AMS JWT (same payload as PHP AntMediaRestAPIController). */
  protected generateJwt() {
    return generateOriginAmsJwt(originAmsSecretKey())
  }

  /** Playlist AMS JWT. */
  protected generatePlaylistJwt() {
    return generatePlaylistAmsJwt(playlistAmsSecretKey())
  }

  /** Raw JWT in Authorization (no Bearer), matching PHP curl headers. */
  protected originHeaders(extra?: RequestInit['headers']) {
    const jwt = this.generateJwt()
    const h = new Headers(extra)
    h.set('Content-Type', 'application/json')
    h.set('Authorization', jwt)
    return h
  }

  protected playlistHeaders(extra?: RequestInit['headers']) {
    const jwt = this.generatePlaylistJwt()
    const h = new Headers(extra)
    h.set('Content-Type', 'application/json')
    h.set('Authorization', jwt)
    return h
  }

  /** Origin JWT request; pass body for JSON POST or omit for GET/DELETE. */
  protected async originJsonRequest(
    url: string,
    init: { method?: string; body?: unknown } = {},
  ) {
    const method = init.method ?? 'GET'
    const headers = this.originHeaders()
    const body =
      init.body !== undefined && init.body !== null ? JSON.stringify(init.body) : undefined
    return fetch(url, { method, headers, body })
  }

  async addNewEndpointToOriginServer(streamId: string, rtmpEndpoint: string, endpointServiceId: string) {
    const url = joinUrl(originAmsBaseUrl(), streamId, 'rtmp-endpoint')
    const res = await this.originJsonRequest(url, {
      method: 'POST',
      body: { rtmpUrl: rtmpEndpoint, endpointServiceId },
    })
    return responseStatusBody(res)
  }

  async deleteRTMPEndpointFromOriginServer(endpointServiceId: string, streamId: string) {
    const url =
      joinUrl(originAmsBaseUrl(), streamId, 'rtmp-endpoint') +
      `?endpointServiceId=${encodeURIComponent(endpointServiceId)}`
    const res = await this.originJsonRequest(url, { method: 'DELETE' })
    return responseStatusBody(res)
  }

  async changeRecordingStatus(status: string, streamId: string) {
    const url = joinUrl(originAmsBaseUrl(), streamId, 'recording', status)
    const headers = this.originHeaders({ Accept: 'application/json' })
    const res = await fetch(url, { method: 'PUT', headers })
    return responseStatusBody(res)
  }

  /** Parallel PUTs; no per-stream summary. */
  async changeRecordingStatusForMultipleStreams(status: string, streamArr: string[]) {
    await Promise.all(streamArr.map((id) => this.changeRecordingStatus(status, id)))
  }

  /** Queued staggered PUTs (PHP V3 intent); returns immediately. */
  changeRecordingStatusForMultipleStreamsV3(status: string, streamArr: string[]) {
    enqueueRecordingStatusBatch(recordingBatchDelayMs(), status, streamArr, (s, id) =>
      this.changeRecordingStatus(s, id),
    )
  }

  /** Parallel pool (default 10 workers); returns per-stream HTTP outcome + counts (PHP V2). */
  async changeRecordingStatusForMultipleStreamsV2(
    status: string,
    streamArr: string[],
    maxConcurrent = 10,
  ) {
    if (!streamArr?.length) {
      return {
        results: {},
        summary: { total: 0, success: 0, failed: 0 },
      }
    }

    const results: Record<
      string,
      { success: boolean; http_code: number; response: string; error: string | null }
    > = {}
    let cursor = 0
    const ids = [...streamArr]
    const self = this

    async function worker() {
      while (cursor < ids.length) {
        const i = cursor++
        const streamId = ids[i]
        try {
          const r = await self.changeRecordingStatus(status, streamId)
          const ok = r.status >= 200 && r.status < 300
          results[streamId] = {
            success: ok,
            http_code: r.status,
            response: r.body,
            error: ok ? null : r.body || null,
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          results[streamId] = {
            success: false,
            http_code: 0,
            response: '',
            error: msg,
          }
        }
      }
    }

    const n = Math.min(maxConcurrent, ids.length)
    await Promise.all(Array.from({ length: n }, () => worker()))

    let success = 0
    let failed = 0
    for (const r of Object.values(results)) {
      if (r.success) success++
      else failed++
    }

    return {
      results,
      summary: { total: ids.length, success, failed },
    }
  }

  async changeStreamStopStartStatus(status: 'start' | 'stop', streamId: string) {
    const path = status === 'start' ? 'start' : 'stop'
    const url = joinUrl(originAmsBaseUrl(), streamId, path)
    const headers = this.originHeaders({ Accept: 'application/json' })
    const res = await fetch(url, { method: 'POST', headers })
    return responseStatusBody(res)
  }

  /** POST …/create on origin (plugin naming). */
  async createPlaylist(dataToSend: Record<string, unknown>) {
    const url = joinUrl(originAmsBaseUrl(), 'create')
    const res = await this.originJsonRequest(url, { method: 'POST', body: dataToSend })
    return responseStatusBody(res)
  }

  async deletePlaylist(streamId: string) {
    const url = joinUrl(originAmsBaseUrl(), streamId)
    const res = await this.originJsonRequest(url, { method: 'DELETE' })
    return responseStatusBody(res)
  }

  async getBroadcastInfo(streamId: string) {
    const url = joinUrl(originAmsBaseUrl(), streamId)
    const res = await this.originJsonRequest(url, { method: 'GET' })
    return responseStatusBody(res)
  }

  async getBroadcasts(offset = 0, size = 50) {
    const sz = Math.min(size, 50)
    const url = joinUrl(originAmsBaseUrl(), 'list', String(offset), String(sz))
    const res = await this.originJsonRequest(url, { method: 'GET' })
    return responseStatusBody(res)
  }

  async createBroadcast(data: Record<string, unknown>) {
    const url = joinUrl(originAmsBaseUrl(), 'create')
    const headers = this.originHeaders({ Accept: 'application/json' })
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    })
    return responseStatusBody(res)
  }

  async createFilter(data: Record<string, unknown>) {
    const url = joinUrl(originFilterUrl(), 'create')
    const res = await this.originJsonRequest(url, { method: 'POST', body: data })
    return responseStatusBody(res)
  }

  async deleteStreamFilter(filterId: string) {
    const url = joinUrl(originFilterUrl(), filterId)
    const res = await this.originJsonRequest(url, { method: 'DELETE' })
    return responseStatusBody(res)
  }

  async stopStreamFilter(filterId: string) {
    const url = joinUrl(originAmsBaseUrl(), filterId, 'stop')
    const headers = this.originHeaders({ Accept: 'application/json' })
    const res = await fetch(url, { method: 'POST', headers })
    return responseStatusBody(res)
  }

  /** POST …/create using PLAYLIST_AMS_BASE_URL and playlist JWT. */
  async playlistCreateBroadcast(data: Record<string, unknown>) {
    const url = joinUrl(playlistAmsBaseUrl(), 'create')
    const headers = this.playlistHeaders({ Accept: 'application/json' })
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    })
    return responseStatusBody(res)
  }
}
