import type { Client } from '@libsql/client'
import { CCL_TABLE_SUFFIXES } from './schema/catalog.js'
import { qualifyTable } from './qualify.js'

/** Drops every known CCL table. Safe when rebuilding from WordPress. */
export async function dropAllCclTables(client: Client): Promise<void> {
  for (const suffix of CCL_TABLE_SUFFIXES) {
    const qualified = qualifyTable(suffix)
    await client.execute(`DROP TABLE IF EXISTS "${qualified}"`)
  }
}
