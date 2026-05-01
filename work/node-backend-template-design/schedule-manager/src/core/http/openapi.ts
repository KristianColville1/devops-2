import type { FastifyInstance } from 'fastify'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'

export async function registerOpenApi(app: FastifyInstance) {
  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'Schedule Manager API',
        version: '0.1.0',
      },
      tags: [
        { name: 'auth', description: 'Admin UI token verification' },
        { name: 'admin', description: 'Admin portal API (Bearer token)' },
        { name: 'recordings', description: 'Recording start/stop cron endpoints' },
      ],
    },
  })

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  })
}
