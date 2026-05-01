import type { FastifyInstance } from 'fastify'
import { JSON_API_V1_PREFIX } from '@/core/http/jsonApiV1Prefix.js'
import { joinRoutePaths } from '@/core/http/routing/joinRoutePaths.js'
import { runSyncHealthCheck } from '@/modules/Sync/Services/syncHealth.js'

export async function registerSyncHealthRoutes(app: FastifyInstance) {
  app.get(joinRoutePaths(JSON_API_V1_PREFIX, 'sync', 'health'), async () => {
    return runSyncHealthCheck()
  })
}
