import Fastify from 'fastify'
import { env } from '@/core/env.js'
import '@/core/http/routing/controllerImports.js'
import { registerOpenApi } from '@/core/http/openapi.js'
import { registerDecoratedControllers } from '@/core/http/routing/registerDecoratedControllers.js'
import { registerHealthRoutes } from '@/core/http/routes/health.js'

export async function buildApp() {
  const requestTimeout = Number(env('FASTIFY_REQUEST_TIMEOUT_MS') || '300000')
  const connectionTimeout = Number(env('FASTIFY_CONNECTION_TIMEOUT_MS') || '300000')

  const app = Fastify({
    logger: true,
    requestTimeout,
    connectionTimeout,
  })

  await registerOpenApi(app)
  await registerDecoratedControllers(app)
  await registerHealthRoutes(app)

  app.setNotFoundHandler(async (request, reply) => {
    return reply.code(404).send({ error: 'Not Found', method: request.method, url: request.url })
  })

  return app
}
