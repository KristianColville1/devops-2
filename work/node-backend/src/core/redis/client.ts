import { Redis } from 'ioredis'
import { env } from '@/core/env.js'

let publisher: any = null
let subscriber: any = null

function create() {
  const client = new Redis(env('REDIS_URL') ?? 'redis://localhost:6379', {
    lazyConnect: true,
    maxRetriesPerRequest: null,
    retryStrategy: (times) => Math.min(times * 200, 5000),
  } as any)
  client.on('error', (err: any) => {
    if (err.code !== 'ECONNREFUSED') console.error('[redis]', err.message)
  })
  return client
}

export function getPublisher() {
  if (!publisher) publisher = create()
  return publisher
}

export function getSubscriber() {
  if (!subscriber) subscriber = create()
  return subscriber
}
