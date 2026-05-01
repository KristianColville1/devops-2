import { createLibSqlClientFromProcessEnv } from '@/core/database/libsql.js'
import { env } from '@/core/env.js'
import { encodeProxyJwt, verifyProxyJwt } from '@/core/jwt/proxyWordPressJwt.js'
import { fetchWordPressPing, wordpressRestOrigin } from './wordpressTableClient.js'

export type SyncHealthResult = {
  at: string
  summary: {
    allChecksPassed: boolean
    holes: string[]
  }
  libsql: {
    ok: boolean
    latencyMs?: number
    error?: string
    urlConfigured?: boolean
  }
  jwt: {
    secretConfigured: boolean
    mintVerifyRoundTripOk: boolean
    error?: string
  }
  wordpress: {
    origin: string
    httpStatus?: number
    pingOk: boolean
    error?: string
    /** WP payload when HTTP OK (blog name etc.) — no secrets */
    pingPreview?: Record<string, unknown>
  }
}

function holesFromChecks(r: Omit<SyncHealthResult, 'summary'>): string[] {
  const holes: string[] = []
  if (!r.libsql.ok) {
    holes.push(
      'LibSQL unreachable or misconfigured — check BUNNY_DATABASE_URL / BUNNY_DATABASE_AUTH_TOKEN',
    )
  }
  if (!r.jwt.secretConfigured) {
    holes.push('PROXY_JWT_SECRET missing — cannot mint tokens for WordPress')
  } else if (!r.jwt.mintVerifyRoundTripOk) {
    holes.push('JWT mint/verify failed — inspect PROXY_JWT_TTL_SECONDS / encoding')
  }
  if (!r.wordpress.pingOk) {
    holes.push(
      'WordPress ccl_sync/v1/ping failed — WP must define PROXY_JWT_SECRET (same as Node), reachable origin (CCL_WORDPRESS_REST_ORIGIN), and plugin REST routes active',
    )
  }
  return holes
}

export async function runSyncHealthCheck(): Promise<SyncHealthResult> {
  const at = new Date().toISOString()

  let libsql: SyncHealthResult['libsql'] = { ok: false }
  const urlConfigured = Boolean(env('BUNNY_DATABASE_URL') && env('BUNNY_DATABASE_AUTH_TOKEN'))
  libsql.urlConfigured = urlConfigured
  if (!urlConfigured) {
    libsql.error = 'BUNNY_DATABASE_URL or BUNNY_DATABASE_AUTH_TOKEN unset'
  } else {
    try {
      const t0 = Date.now()
      const client = createLibSqlClientFromProcessEnv()
      await client.execute('SELECT 1')
      libsql = { ok: true, latencyMs: Date.now() - t0, urlConfigured: true }
    } catch (e) {
      libsql = {
        ok: false,
        urlConfigured: true,
        error: e instanceof Error ? e.message : String(e),
      }
    }
  }

  let jwtBlock: SyncHealthResult['jwt'] = {
    secretConfigured: false,
    mintVerifyRoundTripOk: false,
  }
  if (!env('PROXY_JWT_SECRET')) {
    jwtBlock.error = 'PROXY_JWT_SECRET unset'
  } else {
    jwtBlock.secretConfigured = true
    try {
      const tok = encodeProxyJwt(120)
      verifyProxyJwt(tok)
      jwtBlock.mintVerifyRoundTripOk = true
    } catch (e) {
      jwtBlock.error = e instanceof Error ? e.message : String(e)
    }
  }

  let wordpress: SyncHealthResult['wordpress'] = {
    origin: wordpressRestOrigin(),
    pingOk: false,
  }
  if (!jwtBlock.secretConfigured || !jwtBlock.mintVerifyRoundTripOk) {
    wordpress.error =
      'Skipping WP ping — fix JWT first so we can send Authorization Bearer'
  } else {
    try {
      const tok = encodeProxyJwt(120)
      const wp = await fetchWordPressPing(tok)
      wordpress.httpStatus = wp.httpStatus
      const body = wp.body
      const pingLogicalOk = wp.httpStatus === 200 && body.ok === true
      wordpress.pingOk = pingLogicalOk
      if (!pingLogicalOk) {
        wordpress.error =
          wp.httpStatus === 401
            ? 'WordPress rejected JWT (401) — secret mismatch with wp-config PROXY_JWT_SECRET'
            : wp.httpStatus === 503
              ? 'WordPress ccl_sync misconfigured (503) — define PROXY_JWT_SECRET in wp-config'
              : `HTTP ${wp.httpStatus} or body.ok !== true`
      } else {
        wordpress.pingPreview = {
          blog: body.blog,
          table_prefix: body.table_prefix,
          mysql_datetime: body.mysql_datetime,
          timezone_string: body.timezone_string,
        }
      }
    } catch (e) {
      wordpress.error = e instanceof Error ? e.message : String(e)
    }
  }

  const base: Omit<SyncHealthResult, 'summary'> = { at, libsql, jwt: jwtBlock, wordpress }
  const allChecksPassed =
    libsql.ok && jwtBlock.secretConfigured && jwtBlock.mintVerifyRoundTripOk && wordpress.pingOk

  return {
    ...base,
    summary: {
      allChecksPassed,
      holes: allChecksPassed ? [] : holesFromChecks(base),
    },
  }
}
