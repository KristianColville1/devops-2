import { hostname, loadavg, cpus, networkInterfaces } from 'node:os'
import { env } from '@/core/env.js'
import { getPublisher } from '@/core/redis/client.js'
import { NodeRepository } from './NodeRepository.js'
import { wsConnectionCount } from '@/core/ws/server.js'

const HEARTBEAT_MS = 30_000

function getPrivateIp() {
  for (const addrs of Object.values(networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address
    }
  }
  return '127.0.0.1'
}

function cpuPct() {
  return Math.round(Math.min((loadavg()[0] / cpus().length) * 100, 100))
}

function memPct() {
  const m = process.memoryUsage()
  return Math.round((m.heapUsed / m.heapTotal) * 100)
}

function publish(channel: string, event: string, data: unknown) {
  if (!env('REDIS_URL')) return
  getPublisher()
    .publish(channel, JSON.stringify({ event, data }))
    .catch((err) => console.error('[redis]', err.message))
}

export async function startNodeLifecycle(app: any) {
  const repo = new NodeRepository()
  const instanceId = env('EC2_INSTANCE_ID') ?? hostname()
  const now = Date.now()

  const node = {
    instanceId,
    hostname: hostname(),
    az: env('EC2_AZ') ?? 'local',
    privateIp: env('EC2_PRIVATE_IP') ?? getPrivateIp(),
    registeredAt: now,
    lastSeen: now,
    cpuPct: cpuPct(),
    memoryPct: memPct(),
    wsConnections: 0,
    status: 'active' as const,
    expiresAt: Math.floor(now / 1000) + 300,
  }

  await repo.register(node)
  publish('infra:events', 'node:registered', node)
  app.log.info({ instanceId }, 'node registered')

  const timer = setInterval(async () => {
    const stats = { cpuPct: cpuPct(), memoryPct: memPct(), wsConnections: wsConnectionCount() }
    try {
      await repo.heartbeat(instanceId, stats)
      publish('infra:heartbeats', 'node:heartbeat', { instanceId, ...stats })
    } catch (err) {
      app.log.error(err, 'heartbeat failed')
    }
  }, HEARTBEAT_MS)

  const shutdown = async () => {
    clearInterval(timer)
    try {
      await repo.deregister(instanceId)
      publish('infra:events', 'node:deregistered', { instanceId })
      app.log.info({ instanceId }, 'node deregistered')
    } catch {}
    await app.close()
    process.exit(0)
  }

  process.once('SIGTERM', shutdown)
  process.once('SIGINT', shutdown)
}
