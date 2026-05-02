import websocket from '@fastify/websocket'
import { env } from '@/core/env.js'
import { startBus } from '@/core/redis/bus.js'
import { getHistory } from '@/core/redis/history.js'
import { NodeRepository } from '@/modules/Nodes/NodeRepository.js'

const clients = new Set<any>()

export function wsConnectionCount(): number {
  return clients.size
}

function broadcast(msg: string): void {
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg)
  }
}

export async function registerWsServer(app: any): Promise<void> {
  await app.register(websocket)

  const token = env('DASHBOARD_TOKEN')
  const repo = new NodeRepository()

  app.get('/ws', { websocket: true }, (socket: any, request: any) => {
    const qs = new URLSearchParams(request.url.split('?')[1] ?? '')

    if (token && qs.get('token') !== token) {
      socket.close(4001, 'Unauthorized')
      return
    }

    clients.add(socket)

    Promise.all([repo.listActive(), getHistory()])
      .then(([nodes, messages]) => {
        if (socket.readyState === 1) {
          socket.send(JSON.stringify({ event: 'snapshot', data: { nodes, messages } }))
        }
      })
      .catch((err) => app.log.error(err, 'ws snapshot failed'))

    socket.on('close', () => clients.delete(socket))
  })

  await startBus(broadcast)
}
