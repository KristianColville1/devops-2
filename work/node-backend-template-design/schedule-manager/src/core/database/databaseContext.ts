import type { Client } from '@libsql/client'
import { Database } from './Database.js'
import { createLibSqlClientFromProcessEnv } from './libsql.js'

/**
 * One LibSQL client + {@link Database} for the process lifetime.
 * {@link connectDatabaseFromEnv} runs once at startup (single `SELECT 1` to fail fast).
 * {@link getDatabase} is what repositories use — no per-query health checks.
 */
let context: Database | null = null
let ownedClient: Client | null = null

/** Create client from env, verify reachability, register {@link getDatabase}. */
export async function connectDatabaseFromEnv(): Promise<void> {
  const client = createLibSqlClientFromProcessEnv()
  await client.execute('SELECT 1')
  ownedClient = client
  setDatabaseContext(new Database(client))
}

export function setDatabaseContext(db: Database): void {
  context = db
}

/** @internal */
export function clearDatabaseContext(): void {
  context = null
}

/** Close the LibSQL client opened by {@link connectDatabaseFromEnv}; clears context. */
export async function disconnectDatabase(): Promise<void> {
  clearDatabaseContext()
  const c = ownedClient
  ownedClient = null
  await Promise.resolve((c as { close?: () => unknown } | null)?.close?.())
}

export function getDatabase(): Database {
  if (!context) {
    throw new Error('Database not connected. Call connectDatabaseFromEnv() at startup.')
  }
  return context
}
