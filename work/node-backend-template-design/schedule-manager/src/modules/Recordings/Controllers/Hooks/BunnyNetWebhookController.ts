import type { FastifyReply, FastifyRequest } from 'fastify'
import { Controller, Post } from '@/core/http/routing/decorators.js'
import { BunnyNetWebhookManager } from '@/modules/Recordings/Services/BunnyNetWebhookManager.js'

/** Bunny Stream encoding webhook — parity with WP `ccl_admin/v1/record/information/`. */
@Controller('record')
export class BunnyNetWebhookController {
  @Post('/information', {
    tags: ['recordings'],
    summary: 'Bunny.net encoding webhook (finished / failed notifications)',
    body: {
      type: 'object',
      additionalProperties: true,
    },
    response: {
      200: {
        type: 'object',
        additionalProperties: true,
        description: 'Outcome payload; `additionalProperties` keeps dynamic keys.',
      },
    },
  })
  async main(request: FastifyRequest<{ Body: Record<string, unknown> }>, reply: FastifyReply) {
    const payload = await BunnyNetWebhookManager.handle(request.body)
    return reply.send(payload)
  }
}
