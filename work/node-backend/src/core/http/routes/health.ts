import type { FastifyInstance } from 'fastify'

/** ALB/docker health — no auth, no `/api/v1` prefix. */
export async function registerHealthRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({ ok: true }))
}
