import type { Client } from '@libsql/client'

function quoteIdent(c: string) {
  return `"${c.replace(/"/g, '""')}"`
}

function normalizeCell(v: unknown) {
  if (v === null || v === undefined) return null
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'number' || typeof v === 'bigint') return v
  return String(v)
}

/** Stable union of keys across rows (WordPress may omit null columns). */
export function unionColumns(rows: Record<string, unknown>[]): string[] {
  const s = new Set<string>()
  for (const r of rows) {
    for (const k of Object.keys(r)) s.add(k)
  }
  return [...s].sort()
}

/** Chunked INSERT for LibSQL; IDs come from WordPress rows. */
export async function insertRows(
  client: Client,
  qualifiedTable: string,
  rows: Record<string, unknown>[],
  chunkSize = 80,
): Promise<void> {
  if (rows.length === 0) return

  const cols = unionColumns(rows)
  const qi = cols.map(quoteIdent).join(', ')
  const table = quoteIdent(qualifiedTable)

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const placeholders = chunk
      .map(() => `(${cols.map(() => '?').join(',')})`)
      .join(',')
    const sql = `INSERT INTO ${table} (${qi}) VALUES ${placeholders}`
    const args = chunk.flatMap((r) => cols.map((c) => normalizeCell(r[c])))
    await client.execute({ sql, args })
  }
}
