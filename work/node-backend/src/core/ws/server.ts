import websocket from '@fastify/websocket'
import { env } from '@/core/env.js'
import { startBus } from '@/core/redis/bus.js'
import { NodeRepository } from '@/modules/Nodes/NodeRepository.js'

const clients = new Set<any>()

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

    repo.listActive()
      .then((nodes) => {
        if (socket.readyState === 1) {
          socket.send(JSON.stringify({ event: 'snapshot', data: { nodes } }))
        }
      })
      .catch((err) => app.log.error(err, 'ws snapshot failed'))

    socket.on('close', () => clients.delete(socket))
  })

  await startBus(broadcast)
}
