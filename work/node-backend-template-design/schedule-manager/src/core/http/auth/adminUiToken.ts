import type { FastifyReply, FastifyRequest } from 'fastify'
import { isAuthorizedOperator } from '@/core/http/auth/adminSession.js'

/** Shared secret for Bearer tokens and signing UI session cookies (`SCHEDULE_MANAGER_UI_TOKEN`). */
export function getExpectedAdminUiToken(): string {
  return process.env.SCHEDULE_MANAGER_UI_TOKEN?.trim() ?? ''
}

export function bearerTokenFromRequest(request: FastifyRequest): string {
  const h = request.headers.authorization
  if (!h?.startsWith('Bearer ')) return ''
  return h.slice(7).trim()
}

/** Cookie session or Bearer (same secret). */
export function isAdminUiAuthorized(request: FastifyRequest): boolean {
  return isAuthorizedOperator(request)
}

export function sendAdminUnauthorized(reply: FastifyReply) {
  return reply.code(401).send({ ok: false, error: 'unauthorized' })
}
