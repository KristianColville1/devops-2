import type { FastifyInstance } from 'fastify'
import { JSON_API_V1_PREFIX } from '@/core/http/jsonApiV1Prefix.js'
import { joinRoutePaths } from '@/core/http/routing/joinRoutePaths.js'
import { runSyncHealthCheck } from '@/modules/Sync/Services/syncHealth.js'

/**
 * Minimal readiness check for Docker/local boot: LibSQL + JWT + mother WordPress
 * `ccl_sync/v1/ping` (see wp-content/plugins/ChurchCamLive/.../CclBackendSyncApi.php).
 * Returns 503 when any prerequisite fails so `curl -f` healthchecks fail loudly.
 */
export async function registerDockerPingRoute(app: FastifyInstance) {
  app.get(joinRoutePaths(JSON_API_V1_PREFIX, 'sync', 'docker-ping'), async (_request, reply) => {
    const r = await runSyncHealthCheck()
    if (!r.summary.allChecksPassed) {
      return reply.code(503).send({
        ok: false,
        at: r.at,
        holes: r.summary.holes,
        libsql: r.libsql,
        jwt: r.jwt,
        wordpress: r.wordpress,
      })
    }
    return reply.send({
      ok: true,
      at: r.at,
      mother: r.wordpress.origin,
      wordpress: r.wordpress.pingPreview,
      libsql: { latencyMs: r.libsql.latencyMs },
    })
  })
}
