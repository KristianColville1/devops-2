import type { Client } from '@libsql/client'
import { qualifyTable } from './qualify.js'

export function quoteIdent(name: string) {
  return `"${String(name).replace(/"/g, '""')}"`
}

function normalizeCell(v: unknown) {
  if (v === null || v === undefined) return null
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'number' || typeof v === 'bigint') return v
  return String(v)
}

/**
 * LibSQL counterpart to WordPress `CCLPLUGINCore\Database\Database` —
 * logical table suffix (no prefix), qualifies as `wp_*` for LibSQL.
 */
export class Database {
  client: Client

  constructor(client: Client) {
    this.client = client
  }

  qualify(tableSuffix: string) {
    return qualifyTable(tableSuffix)
  }

  /** SELECT * from the qualified `wp_*` table plus optional WHERE fragment (include leading WHERE). */
  async fetchAll(tableSuffix: string, whereSql = '', args: any[] = []) {
    const q = quoteIdent(this.qualify(tableSuffix))
    const sql = [`SELECT * FROM ${q}`, whereSql].filter(Boolean).join(' ')
    const r = await this.client.execute({ sql, args: args || [] })
    return r.rows || []
  }

  /** Single row by primary key `id`. */
  async fetchOneById(tableSuffix: string, id: unknown) {
    const rows = await this.fetchAll(tableSuffix, 'WHERE id = ?', [id])
    return rows[0] ?? null
  }

  /** First row matching a custom WHERE fragment (include leading WHERE). */
  async fetchOneByCustom(tableSuffix: string, whereSql: string, args: any[] = []) {
    const rows = await this.fetchAll(tableSuffix, whereSql, args)
    return rows[0] ?? null
  }

  /** INSERT returning last-insert id when LibSQL reports it. */
  async insert(tableSuffix: string, data: Record<string, any>) {
    const keys = Object.keys(data)
    if (keys.length === 0) {
      throw new Error('Database.insert: empty data')
    }
    const q = quoteIdent(this.qualify(tableSuffix))
    const cols = keys.map((k) => quoteIdent(k)).join(', ')
    const ph = keys.map(() => '?').join(', ')
    const sql = `INSERT INTO ${q} (${cols}) VALUES (${ph})`
    const args = keys.map((k) => normalizeCell(data[k]))
    const r = await this.client.execute({ sql, args })
    const lid = r.lastInsertRowid
    if (lid !== undefined && lid !== null) return Number(lid)
    const chk = await this.client.execute({
      sql: 'SELECT last_insert_rowid() AS id',
      args: [],
    })
    const row = chk.rows[0] as any
    return row ? Number(row.id) : null
  }

  /** UPDATE by equality match on every key in `whereObj`. */
  async update(tableSuffix: string, data: Record<string, any>, whereObj: Record<string, any>) {
    const wkeys = Object.keys(whereObj)
    const dkeys = Object.keys(data)
    if (wkeys.length === 0) throw new Error('Database.update: empty where')
    const q = quoteIdent(this.qualify(tableSuffix))
    const setClause = dkeys.map((k) => `${quoteIdent(k)} = ?`).join(', ')
    const whereClause = wkeys.map((k) => `${quoteIdent(k)} = ?`).join(' AND ')
    const sql = `UPDATE ${q} SET ${setClause} WHERE ${whereClause}`
    const args = [
      ...dkeys.map((k) => normalizeCell(data[k])),
      ...wkeys.map((k) => normalizeCell(whereObj[k])),
    ]
    const r = await this.client.execute({ sql, args })
    return r.rowsAffected !== undefined ? Number(r.rowsAffected) : 0
  }

  /** DELETE by equality match on every key in `whereObj`. */
  async delete(tableSuffix: string, whereObj: Record<string, any>) {
    const wkeys = Object.keys(whereObj)
    if (wkeys.length === 0) throw new Error('Database.delete: empty where')
    const q = quoteIdent(this.qualify(tableSuffix))
    const whereClause = wkeys.map((k) => `${quoteIdent(k)} = ?`).join(' AND ')
    const sql = `DELETE FROM ${q} WHERE ${whereClause}`
    const args = wkeys.map((k) => normalizeCell(whereObj[k]))
    const r = await this.client.execute({ sql, args })
    return r.rowsAffected !== undefined ? Number(r.rowsAffected) : 0
  }

  /** Raw execute returning row array (caller builds qualified SQL). */
  async query(sql: string, args: any[] = []) {
    const r = await this.client.execute({ sql, args: args || [] })
    return r.rows || []
  }
}
