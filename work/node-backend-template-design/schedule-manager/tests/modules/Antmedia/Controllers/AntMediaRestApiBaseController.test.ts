/**
 * Unit tests: `@/modules/Antmedia/Controllers/AntMediaRestApiBaseController`
 * — fetch + ORIGIN_AMS_* env stubbed per test (no real Ant Media server).
 */
import assert from 'node:assert/strict'
import { afterEach, describe, test } from 'node:test'

import { AntMediaRestApiBaseController } from '@/modules/Antmedia/Controllers/AntMediaRestApiBaseController.js'

/** Surface we expect vs WordPress `AntMediaRestAPIController` (+ playlist helper). */
const EXPECTED_PUBLIC_METHODS = [
  'addNewEndpointToOriginServer',
  'deleteRTMPEndpointFromOriginServer',
  'changeRecordingStatus',
  'changeRecordingStatusForMultipleStreams',
  'changeRecordingStatusForMultipleStreamsV3',
  'changeRecordingStatusForMultipleStreamsV2',
  'changeStreamStopStartStatus',
  'createPlaylist',
  'deletePlaylist',
  'getBroadcastInfo',
  'getBroadcasts',
  'createBroadcast',
  'createFilter',
  'deleteStreamFilter',
  'stopStreamFilter',
  'playlistCreateBroadcast',
] as const

let snapshot: {
  fetch: typeof fetch
  base: string | undefined
  key: string | undefined
} | null = null

afterEach(() => {
  if (!snapshot) return
  globalThis.fetch = snapshot.fetch
  if (snapshot.base === undefined) delete process.env.ORIGIN_AMS_BASE_URL
  else process.env.ORIGIN_AMS_BASE_URL = snapshot.base
  if (snapshot.key === undefined) delete process.env.ORIGIN_AMS_SECRET_KEY
  else process.env.ORIGIN_AMS_SECRET_KEY = snapshot.key
  snapshot = null
})

function stubAntMediaEnvForFetch(fakeFetch: typeof fetch) {
  snapshot = {
    fetch: globalThis.fetch,
    base: process.env.ORIGIN_AMS_BASE_URL,
    key: process.env.ORIGIN_AMS_SECRET_KEY,
  }
  globalThis.fetch = fakeFetch
  process.env.ORIGIN_AMS_BASE_URL = 'https://origin.example/LiveApp/rest/v2/broadcasts'
  process.env.ORIGIN_AMS_SECRET_KEY = 'secret-key'
}

describe('@/modules/Antmedia/Controllers/AntMediaRestApiBaseController · unit', () => {
  test('exposes expected REST helpers', () => {
    const proto = AntMediaRestApiBaseController.prototype as Record<string, unknown>
    for (const name of EXPECTED_PUBLIC_METHODS) {
      assert.equal(typeof proto[name], 'function', `missing ${name}`)
    }
  })

  test('changeRecordingStatus builds PUT …/recording/{status} and sends Authorization JWT', async () => {
    let sawAuth = ''
    stubAntMediaEnvForFetch(async (url, init) => {
      assert.match(String(url), /\/cam-1\/recording\/true$/)
      assert.equal(init?.method, 'PUT')
      const h = new Headers(init?.headers)
      sawAuth = h.get('Authorization') ?? ''
      assert.ok(sawAuth.length > 20)
      return new Response('{}', { status: 200 })
    })

    const ctrl = new AntMediaRestApiBaseController()
    const out = await ctrl.changeRecordingStatus('true', 'cam-1')
    assert.equal(out.status, 200)
    assert.ok(sawAuth.length > 0)
  })

  test('changeRecordingStatusForMultipleStreamsV2 aggregates per-stream results', async () => {
    stubAntMediaEnvForFetch(async () => new Response('ok', { status: 200 }))

    const ctrl = new AntMediaRestApiBaseController()
    const batch = await ctrl.changeRecordingStatusForMultipleStreamsV2('false', ['a', 'b'], 10)
    assert.equal(batch.summary.total, 2)
    assert.equal(batch.summary.success, 2)
    assert.equal(batch.summary.failed, 0)
    assert.equal(batch.results.a?.success, true)
    assert.equal(batch.results.b?.success, true)
  })
})
