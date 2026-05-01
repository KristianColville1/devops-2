import type { FastifyReply, FastifyRequest } from 'fastify'
import { Controller, Get } from '@/core/http/routing/decorators.js'
import { runStartRecordingScript } from '@/modules/Recordings/Services/startRecordingScript.js'
import { runStopRecordingScript } from '@/modules/Recordings/Services/stopRecordingScript.js'

@Controller('record')
export class RecordingScriptsController {
  @Get('/start', {
    tags: ['recordings'],
    summary: 'Start recording pipeline (RRULE, history, Ant Media)',
    response: {
      200: {
        type: 'object',
        additionalProperties: true,
        description: 'JSON body; `additionalProperties` required so the response serializer keeps all keys.',
      },
    },
  })
  async start(_request: FastifyRequest, reply: FastifyReply) {
    const payload = await runStartRecordingScript()
    return reply.send(payload)
  }

  @Get('/stop', {
    tags: ['recordings'],
    summary: 'Stop recording pipeline (history window, Ant Media)',
    response: {
      200: {
        type: 'object',
        additionalProperties: true,
        description: 'JSON body; `additionalProperties` required so the response serializer keeps all keys.',
      },
    },
  })
  async stop(_request: FastifyRequest, reply: FastifyReply) {
    const payload = await runStopRecordingScript()
    return reply.send(payload)
  }
}
