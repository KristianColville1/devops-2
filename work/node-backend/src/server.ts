import './core/env/bootstrap.js'
import 'reflect-metadata'
import { buildApp } from '@/core/http/index.js'

const port = Number(process.env.PORT) || 3000
const host = process.env.HOST ?? '0.0.0.0'

async function main() {
  const app = await buildApp()
  try {
    await app.listen({ port, host })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

void main()
