import { createClient, type Client } from '@libsql/client'
import { env } from '@/core/env.js'

export type LibSqlConnectOptions = {
  url: string
  authToken: string
}

/**
 * New LibSQL client (remote or local URL per @libsql/client docs).
 * Long-lived wiring: {@link connectDatabaseFromEnv} in `databaseContext.ts`.
 */
export function createLibSqlClient(options: LibSqlConnectOptions): Client {
  return createClient({ url: options.url, authToken: options.authToken })
}

/**
 * Reads `BUNNY_DATABASE_URL` + `BUNNY_DATABASE_AUTH_TOKEN`. Throws only when called and vars are missing.
 */
export function createLibSqlClientFromProcessEnv(): Client {
  const url = env('BUNNY_DATABASE_URL')
  const authToken = env('BUNNY_DATABASE_AUTH_TOKEN')
  if (!url || !authToken) {
    throw new Error(
      'LibSQL: set BUNNY_DATABASE_URL and BUNNY_DATABASE_AUTH_TOKEN in the environment.',
    )
  }
  return createLibSqlClient({ url, authToken })
}
