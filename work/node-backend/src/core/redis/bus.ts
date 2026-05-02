import { env } from '@/core/env.js'
import { getSubscriber } from './client.js'

const CHANNELS = ['infra:events', 'infra:heartbeats', 'infra:requests']

export async function startBus(broadcast: (msg: string) => void): Promise<void> {
  if (!env('REDIS_URL')) return

  const sub = getSubscriber()
  await sub.subscribe(...CHANNELS)
  sub.on('message', (_channel, message) => broadcast(message))
}
