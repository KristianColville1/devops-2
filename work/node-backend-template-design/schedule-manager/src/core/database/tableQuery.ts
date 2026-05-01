import type { Client } from '@libsql/client'
import type { CclTableModel } from './tableModel.js'

function quoteIdent(sqlName: string): string {
  return `"${sqlName.replace(/"/g, '""')}"`
}

/** Full table scan — fine for your ~20MB dataset; narrow in repositories later. */
export async function selectAllRows(client: Client, table: CclTableModel) {
  const q = quoteIdent(table.qualifiedTable())
  const res = await client.execute({ sql: `SELECT * FROM ${q}` })
  return res.rows
}
