import Fastify from 'fastify'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import fastifyStatic from '@fastify/static'
import {
  connectDatabaseFromEnv,
  disconnectDatabase,
} from '@/core/database/databaseContext.js'
import { env } from '@/core/env.js'
import '@/core/http/routing/controllerImports.js'
import { registerOpenApi } from '@/core/http/openapi.js'
import { registerDecoratedControllers } from '@/core/http/routing/registerDecoratedControllers.js'
import { registerHealthRoutes } from './routes/health.js'
import { registerDockerPingRoute } from '@/modules/Sync/Controllers/dockerPingRoute.js'
import { registerSyncHealthRoutes } from '@/modules/Sync/Controllers/healthCheckRoute.js'
import { registerSyncRebuildRoutes } from '@/modules/Sync/Controllers/rebuildRoute.js'

export async function buildApp() {
  const requestTimeout = Number(env('FASTIFY_REQUEST_TIMEOUT_MS') || '3600000')
  const connectionTimeout = Number(env('FASTIFY_CONNECTION_TIMEOUT_MS') || '3600000')

  const app = Fastify({
    logger: true,
    requestTimeout,
    connectionTimeout,
  })

  await connectDatabaseFromEnv()

  app.addHook('onClose', disconnectDatabase)

  await registerOpenApi(app)
  await registerDecoratedControllers(app)

  await registerHealthRoutes(app)
  await registerSyncHealthRoutes(app)
  await registerDockerPingRoute(app)
  await registerSyncRebuildRoutes(app)

  const publicDir = path.join(process.cwd(), 'public')
  await app.register(fastifyStatic, {
    root: publicDir,
    prefix: '/',
    decorateReply: false,
  })

  /** SPA fallback: serve Vite `index.html` for client routes (not `/api`, not `/docs`). */
  app.setNotFoundHandler(async (request, reply) => {
    const pathname = request.url.split('?')[0] ?? ''
    if (request.method !== 'GET') {
      return reply.code(404).send({ error: 'Not Found' })
    }
    if (pathname.startsWith('/api') || pathname.startsWith('/docs')) {
      return reply.code(404).send({ error: 'Not Found' })
    }
    try {
      const html = await readFile(path.join(publicDir, 'index.html'), 'utf8')
      return reply.type('text/html').send(html)
    } catch {
      return reply.code(404).send({ error: 'Not Found' })
    }
  })

  return app
}
