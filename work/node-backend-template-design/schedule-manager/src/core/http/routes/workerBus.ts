export async function registerWorkerBusRoutes(app, workerBus) {
  app.get('/api/v1/worker/ping', async () => {
    const result = await workerBus.submit('ping', {}, { timeoutMs: 10_000 })
    return { ok: true, worker: result }
  })
}
