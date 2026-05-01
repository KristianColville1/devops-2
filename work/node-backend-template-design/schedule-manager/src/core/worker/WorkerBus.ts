import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'

function resolveWorkerEntry() {
  const base = new URL('.', import.meta.url)
  const js = fileURLToPath(new URL('runner.js', base))
  const ts = fileURLToPath(new URL('runner.ts', base))
  if (existsSync(js)) {
    return { path: js, execArgv: [] }
  }
  if (existsSync(ts)) {
    return { path: ts, execArgv: ['--import', 'tsx'] }
  }
  throw new Error(
    `Worker runner not found next to WorkerBus (expected runner.js or runner.ts).
Build with npm run build, or run the API via tsx so runner.ts can load.`,
  )
}

export class WorkerBus {
  workers = []
  rr = 0
  pending = new Map()
  defaultTimeoutMs

  constructor(options) {
    const envN = Number(process.env.WORKER_POOL_SIZE)
    const fromEnv = Number.isFinite(envN) && envN > 0 ? envN : 2
    const size = Math.max(1, options?.poolSize ?? fromEnv)
    this.defaultTimeoutMs = options?.jobTimeoutMs ?? 300_000
    const { path: workerPath, execArgv } = resolveWorkerEntry()

    for (let i = 0; i < size; i++) {
      const w = new Worker(workerPath, {
        type: 'module',
        execArgv,
      } as any)
      w.on('message', (msg) => this.onWorkerMessage(msg))
      w.on('error', (err) => {
        for (const [, p] of this.pending) {
          p.reject(err instanceof Error ? err : new Error(String(err)))
        }
        this.pending.clear()
      })
      this.workers.push(w)
    }
  }

  onWorkerMessage(msg) {
    const pending = this.pending.get(msg.jobId)
    if (!pending) return
    if (pending.timeout) clearTimeout(pending.timeout)
    this.pending.delete(msg.jobId)
    if (msg.ok) pending.resolve(msg.result)
    else pending.reject(new Error(msg.error ?? 'worker_error'))
  }

  submit(kind, payload, options) {
    const jobId = randomUUID()
    const req = { jobId, kind, payload }
    const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(jobId)
        reject(new Error(`worker job timeout: ${kind} (${timeoutMs}ms)`))
      }, timeoutMs)

      this.pending.set(jobId, {
        resolve,
        reject,
        timeout,
      })

      const w = this.workers[this.rr % this.workers.length]
      this.rr += 1
      w.postMessage(req)
    })
  }

  async terminate() {
    for (const [, p] of this.pending) {
      if (p.timeout) clearTimeout(p.timeout)
      p.reject(new Error('WorkerBus shutting down'))
    }
    this.pending.clear()
    await Promise.all(this.workers.map((w) => w.terminate()))
  }
}

export function createWorkerBus(options) {
  return new WorkerBus(options)
}
