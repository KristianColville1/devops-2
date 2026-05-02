import { randomUUID } from 'node:crypto'
import { Controller, Post } from '@/core/http/routing/decorators.js'
import { BaseController } from '@/core/http/BaseController.js'
import { env } from '@/core/env.js'
import { getPublisher } from '@/core/redis/client.js'
import { pushMessage } from '@/core/redis/history.js'

@Controller('chat')
export class ChatController extends BaseController {
  @Post('/')
  async send(request: any) {
    const { username, text, clientId } = request.body as any

    const msg = {
      id: randomUUID(),
      clientId: clientId ?? null,
      username: String(username ?? 'anon').slice(0, 32),
      text: String(text ?? '').slice(0, 500),
      timestamp: Date.now(),
    }

    await pushMessage(msg)

    if (env('REDIS_URL')) {
      getPublisher()
        .publish('chat:global', JSON.stringify({ event: 'chat:message', data: msg }))
        .catch(() => {})
    }

    return { ok: true, message: msg }
  }
}
