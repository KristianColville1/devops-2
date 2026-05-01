import { PassThrough } from 'node:stream'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { JSON_API_V1_PREFIX } from '@/core/http/jsonApiV1Prefix.js'
import { env } from '@/core/env.js'
import { joinRoutePaths } from '@/core/http/routing/joinRoutePaths.js'
import { rebuildFromWordPress } from '@/modules/Sync/Services/rebuildFromWordPress.js'

/** When SYNC_REBUILD_TOKEN is set, require Bearer, X-Sync-Token, or ?token= (for EventSource). */
export async function syncRebuildAuth(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const token = env('SYNC_REBUILD_TOKEN')
  if (!token) return
  const q = request.query as Record<string, string | undefined>
  const auth =
    request.headers.authorization?.replace(/^Bearer\s+/i, '') ||
    (request.headers['x-sync-token'] as string | undefined) ||
    q?.token
  if (auth !== token) {
    return reply.code(401).send({ ok: false, error: 'unauthorized' })
  }
}

export async function registerSyncRebuildRoutes(app: FastifyInstance) {
  app.post(
    joinRoutePaths(JSON_API_V1_PREFIX, 'sync', 'rebuild-from-wordpress'),
    {
      preHandler: syncRebuildAuth,
    },
    async (request, reply) => {
      try {
        const logLines: string[] = []
        const result = await rebuildFromWordPress((p) => {
          const msg = [p.phase, p.suffix, p.detail].filter(Boolean).join(' ')
          request.log.info({ syncRebuild: true }, msg)
          logLines.push(msg)
        })
        return reply.send({ ...result, log: logLines })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        request.log.error(e)
        return reply.code(500).send({ ok: false, error: msg })
      }
    },
  )

  app.get(
    joinRoutePaths(JSON_API_V1_PREFIX, 'sync', 'rebuild-from-wordpress/stream'),
    {
      preHandler: syncRebuildAuth,
    },
    async (request, reply) => {
      const stream = new PassThrough()
      reply
        .header('Content-Type', 'text/event-stream; charset=utf-8')
        .header('Cache-Control', 'no-cache, no-transform')
        .header('Connection', 'keep-alive')
        .header('X-Accel-Buffering', 'no')
        .send(stream)

      const send = (obj: Record<string, unknown>) => {
        stream.write(`data: ${JSON.stringify(obj)}\n\n`)
      }

      try {
        send({ type: 'start', at: new Date().toISOString() })
        const result = await rebuildFromWordPress((p) => {
          const msg = [p.phase, p.suffix, p.detail].filter(Boolean).join(' ')
          request.log.info({ syncRebuild: true }, msg)
          send({ type: 'progress', ...p, line: msg })
        })
        const logLines = result.tables.map((t) =>
          [t.suffix, t.ok ? String(t.count) : t.error || 'fail', t.note || '']
            .filter(Boolean)
            .join(' '),
        )
        send({
          type: 'done',
          ok: result.ok,
          ping: result.ping,
          tables: result.tables,
          log: logLines,
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        request.log.error(e)
        send({ type: 'error', message: msg })
      } finally {
        stream.end()
      }
    },
  )
}
