import '../env/bootstrap.js'
import { createLibSqlClientFromProcessEnv } from './libsql.js'
import { initCclSchema } from './initSchema.js'

async function main() {
  const client = createLibSqlClientFromProcessEnv()
  await initCclSchema(client)
  console.log('CCL schema ensured (CREATE IF NOT EXISTS).')
}

void main().catch((e) => {
  console.error(e)
  process.exit(1)
})
