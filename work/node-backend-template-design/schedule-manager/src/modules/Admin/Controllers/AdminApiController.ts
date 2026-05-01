import type { FastifyReply, FastifyRequest } from 'fastify'
import {
  getExpectedAdminUiToken,
  isAdminUiAuthorized,
  sendAdminUnauthorized,
} from '@/core/http/auth/adminUiToken.js'
import { Controller, Get } from '@/core/http/routing/decorators.js'
import { runSyncHealthCheck } from '@/modules/Sync/Services/syncHealth.js'

/**
 * Admin dashboard JSON only — requires session cookie (after login) or Bearer token.
 * Other `/api/v1/*` routes stay callable without this (cron, webhooks, sync, etc.).
 */
@Controller('admin')
export class AdminApiController {
  @Get('/overview', {
    tags: ['admin'],
    summary: 'Minimal authenticated ping',
    response: {
      200: {
        type: 'object',
        additionalProperties: true,
      },
    },
  })
  async overview(request: FastifyRequest, reply: FastifyReply) {
    if (!getExpectedAdminUiToken()) {
      return reply.code(503).send({ ok: false, error: 'admin_ui_token_not_configured' })
    }
    if (!isAdminUiAuthorized(request)) return sendAdminUnauthorized(reply)
    return reply.send({
      ok: true,
      message: 'Schedule Manager admin API.',
    })
  }

  @Get('/dashboard', {
    tags: ['admin'],
    summary: 'Sync health, API index, and operator links',
    response: {
      200: {
        type: 'object',
        additionalProperties: true,
      },
    },
  })
  async dashboard(request: FastifyRequest, reply: FastifyReply) {
    if (!getExpectedAdminUiToken()) {
      return reply.code(503).send({ ok: false, error: 'admin_ui_token_not_configured' })
    }
    if (!isAdminUiAuthorized(request)) return sendAdminUnauthorized(reply)

    const syncHealth = await runSyncHealthCheck()
    return reply.send({
      ok: true,
      at: new Date().toISOString(),
      syncHealth,
      links: {
        openapi: '/docs',
        syncRebuild: '/sync-rebuild.html',
        legacyHealthHtml: '/health.html',
      },
      api: {
        prefix: '/api/v1',
        recordingsStart: '/api/v1/record/start',
        recordingsStop: '/api/v1/record/stop',
        bunnyWebhook: '/api/v1/record/information',
        syncHealthJson: '/api/v1/sync/health',
        dockerPing: '/api/v1/sync/docker-ping',
      },
    })
  }
}
