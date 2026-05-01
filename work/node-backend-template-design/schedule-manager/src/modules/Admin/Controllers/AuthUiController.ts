import type { FastifyReply, FastifyRequest } from 'fastify'
import {
  appendSessionClearCookie,
  appendSessionSetCookie,
  isAuthorizedOperator,
  signUiSessionJwt,
} from '@/core/http/auth/adminSession.js'
import { getExpectedAdminUiToken } from '@/core/http/auth/adminUiToken.js'
import { Controller, Get, Post } from '@/core/http/routing/decorators.js'

@Controller('auth')
export class AuthUiController {
  /** Sets HttpOnly session cookie (JWT, 1 hour). */
  @Post('/login', {
    tags: ['auth'],
    summary: 'Exchange operator token for session cookie',
    body: {
      type: 'object',
      additionalProperties: false,
      properties: {
        token: { type: 'string' },
      },
    },
    response: {
      200: {
        type: 'object',
        additionalProperties: true,
      },
    },
  })
  async login(request: FastifyRequest<{ Body: { token?: string } }>, reply: FastifyReply) {
    const expected = getExpectedAdminUiToken()
    if (!expected) {
      return reply.code(503).send({ ok: false, error: 'admin_ui_token_not_configured' })
    }
    const token = request.body?.token?.trim() ?? ''
    if (token !== expected) {
      return reply.code(401).send({ ok: false, error: 'invalid_token' })
    }
    const jwtToken = signUiSessionJwt()
    if (!jwtToken) {
      return reply.code(503).send({ ok: false, error: 'admin_ui_token_not_configured' })
    }
    appendSessionSetCookie(reply, jwtToken)
    return reply.send({ ok: true })
  }

  /** Clears session cookie (always allowed without auth). */
  @Post('/logout', {
    tags: ['auth'],
    summary: 'Clear session cookie',
    response: {
      200: {
        type: 'object',
        additionalProperties: true,
      },
    },
  })
  async logout(_request: FastifyRequest, reply: FastifyReply) {
    appendSessionClearCookie(reply)
    return reply.send({ ok: true })
  }

  /** Public probe: whether current cookie / bearer is valid (no secret in response). */
  @Get('/session', {
    tags: ['auth'],
    summary: 'Session status for SPA bootstrap',
    response: {
      200: {
        type: 'object',
        additionalProperties: true,
      },
    },
  })
  async session(request: FastifyRequest, reply: FastifyReply) {
    if (!getExpectedAdminUiToken()) {
      return reply.code(503).send({ ok: false, error: 'admin_ui_token_not_configured' })
    }
    return reply.send({ ok: isAuthorizedOperator(request) })
  }
}
