import type { Client } from '@libsql/client'
import { CCL_TABLE_SUFFIXES } from './schema/catalog.js'
import { createTableDdl } from './schema/ddl.js'
import { qualifyTable } from './qualify.js'

/** Creates all CCL tables (IF NOT EXISTS). */
export async function initCclSchema(client: Client): Promise<void> {
  for (const suffix of CCL_TABLE_SUFFIXES) {
    const qualified = qualifyTable(suffix)
    const ddl = createTableDdl(qualified, suffix)
    await client.execute(ddl)
  }
}
