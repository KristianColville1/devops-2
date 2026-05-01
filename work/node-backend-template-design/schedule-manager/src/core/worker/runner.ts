import { parentPort } from 'node:worker_threads'

if (!parentPort) {
  throw new Error('worker runner must run inside a Worker')
}

parentPort.on('message', async (msg) => {
  const port = parentPort
  if (!port) return

  const reply = (r) => port.postMessage(r)

  try {
    let result
    switch (msg.kind) {
      case 'ping':
        result = { pong: true, at: new Date().toISOString() }
        break
      default:
        throw new Error(`unknown worker job kind: ${msg.kind}`)
    }
    reply({ jobId: msg.jobId, ok: true, result })
  } catch (e) {
    reply({
      jobId: msg.jobId,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    })
  }
})
