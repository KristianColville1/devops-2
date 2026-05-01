import { createLibSqlClientFromProcessEnv } from '@/core/database/libsql.js'
import { dropAllCclTables } from '@/core/database/dropAllCclTables.js'
import { initCclSchema } from '@/core/database/initSchema.js'
import { qualifyTable } from '@/core/database/qualify.js'
import { CCL_TABLE_SUFFIXES } from '@/core/database/schema/catalog.js'
import { insertRows } from '@/core/database/insertRows.js'
import { encodeProxyJwt } from './proxyJwt.js'
import {
  fetchWordPressPing,
  fetchWordPressTableData,
} from './wordpressTableClient.js'

export type RebuildProgress = {
  phase: string
  suffix?: string
  detail?: string
}

export async function rebuildFromWordPress(
  onProgress?: (p: RebuildProgress) => void,
): Promise<{
  ok: boolean
  ping: unknown
  tables: {
    suffix: string
    ok: boolean
    count: number
    error?: string
    note?: string
  }[]
}> {
  const client = createLibSqlClientFromProcessEnv()
  const jwt = encodeProxyJwt()
  onProgress?.({ phase: 'ping' })
  const wpPing = await fetchWordPressPing(jwt)
  const ping = wpPing.body

  onProgress?.({ phase: 'drop_tables' })
  await dropAllCclTables(client)

  onProgress?.({ phase: 'create_schema' })
  await initCclSchema(client)

  const tables: {
    suffix: string
    ok: boolean
    count: number
    error?: string
    note?: string
  }[] = []

  for (const suffix of CCL_TABLE_SUFFIXES) {
    const jwtFresh = encodeProxyJwt()
    onProgress?.({ phase: 'fetch', suffix })
    const data = await fetchWordPressTableData(suffix, jwtFresh)

    if (!data.ok) {
      const err = String(data.error || 'wp_error')
      if (err === 'table_not_found') {
        tables.push({
          suffix,
          ok: true,
          count: 0,
          note: 'table_not_found',
        })
        onProgress?.({ phase: 'skip', suffix, detail: 'table_not_found' })
        continue
      }
      tables.push({
        suffix,
        ok: false,
        count: 0,
        error: data.message || err,
      })
      onProgress?.({ phase: 'fetch_failed', suffix, detail: err })
      continue
    }

    const rows = Array.isArray(data.rows) ? data.rows : []
    const qualified = qualifyTable(suffix)
    onProgress?.({ phase: 'insert', suffix, detail: String(rows.length) })

    try {
      await insertRows(client, qualified, rows)
      tables.push({ suffix, ok: true, count: rows.length })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      tables.push({ suffix, ok: false, count: 0, error: msg })
      onProgress?.({ phase: 'insert_failed', suffix, detail: msg })
    }
  }

  const ok = tables.every((t) => t.ok)
  return { ok, ping, tables }
}
