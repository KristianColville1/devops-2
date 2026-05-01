import { sleep } from '@/core/http/shared.js'

/** One chained drain so batches never overlap and Ant Media sees spaced PUTs. */
let drain = Promise.resolve()

export function enqueueRecordingStatusBatch(
  delayMs: number,
  status: string,
  streamIds: string[],
  put: (status: string, streamId: string) => Promise<unknown>,
): void {
  if (!streamIds.length) return
  drain = drain
    .then(async () => {
      for (let i = 0; i < streamIds.length; i++) {
        try {
          await put(status, streamIds[i])
        } catch {}
        if (i < streamIds.length - 1) await sleep(delayMs)
      }
    })
    .catch(() => {})
}
