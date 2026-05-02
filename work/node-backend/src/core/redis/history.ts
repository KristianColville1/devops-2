import { env } from '@/core/env.js'
import { getPublisher } from './client.js'

const KEY = 'chat:messages'
const MAX = 100

export async function pushMessage(msg: object): Promise<void> {
  if (!env('REDIS_URL')) return
  const r = getPublisher()
  await r.lpush(KEY, JSON.stringify(msg))
  await r.ltrim(KEY, 0, MAX - 1)
}

export async function getHistory(): Promise<object[]> {
  if (!env('REDIS_URL')) return []
  const items = await getPublisher().lrange(KEY, 0, MAX - 1)
  return items.map((i) => JSON.parse(i)).reverse()
}
