import { quoteSqlIdent } from '@/core/database/schema/sqlQuote.js'

function escapeSqlString(s: string): string {
  return `'${s.replace(/'/g, "''")}'`
}

/** Column line in a CREATE TABLE — use factories {@link int}, {@link text}, {@link real}. */
export type SqliteColumnDef = {
  render(): string
}

export class IntColumn implements SqliteColumnDef {
  private pk = false
  private autoinc = false
  private nn = false
  private uniq = false
  private def: string | undefined

  constructor(
    private readonly name: string,
    private readonly nameQuoted = false,
  ) {}

  primaryKey(): this {
    this.pk = true
    return this
  }

  autoIncrement(): this {
    this.autoinc = true
    return this
  }

  notNull(): this {
    this.nn = true
    return this
  }

  unique(): this {
    this.uniq = true
    return this
  }

  /** Integer literal, e.g. `0`, `1`. */
  defaultNumber(n: number): this {
    this.def = String(n)
    return this
  }

  /** Raw SQL after `DEFAULT`, e.g. `(datetime('now'))`. */
  defaultExpr(expr: string): this {
    this.def = expr
    return this
  }

  render(): string {
    const n = this.nameQuoted ? quoteSqlIdent(this.name) : this.name
    let s = `${n} INTEGER`
    if (this.pk) s += ' PRIMARY KEY'
    if (this.autoinc) s += ' AUTOINCREMENT'
    if (this.nn) s += ' NOT NULL'
    if (this.def !== undefined) s += ` DEFAULT ${this.def}`
    if (this.uniq) s += ' UNIQUE'
    return s
  }
}

export class TextColumn implements SqliteColumnDef {
  private nn = false
  private def: string | undefined

  constructor(
    private readonly name: string,
    private readonly nameQuoted = false,
  ) {}

  notNull(): this {
    this.nn = true
    return this
  }

  defaultText(value: string): this {
    this.def = escapeSqlString(value)
    return this
  }

  defaultExpr(expr: string): this {
    this.def = expr
    return this
  }

  render(): string {
    const n = this.nameQuoted ? quoteSqlIdent(this.name) : this.name
    let s = `${n} TEXT`
    if (this.nn) s += ' NOT NULL'
    if (this.def !== undefined) s += ` DEFAULT ${this.def}`
    return s
  }
}

export class RealColumn implements SqliteColumnDef {
  private nn = false
  private def: string | undefined

  constructor(private readonly name: string) {}

  notNull(): this {
    this.nn = true
    return this
  }

  defaultNumber(n: number): this {
    this.def = String(n)
    return this
  }

  render(): string {
    let s = `${this.name} REAL`
    if (this.nn) s += ' NOT NULL'
    if (this.def !== undefined) s += ` DEFAULT ${this.def}`
    return s
  }
}

export function int(name: string, opts?: { quote?: boolean }): IntColumn {
  return new IntColumn(name, opts?.quote ?? false)
}

export function text(name: string, opts?: { quote?: boolean }): TextColumn {
  return new TextColumn(name, opts?.quote ?? false)
}

export function real(name: string): RealColumn {
  return new RealColumn(name)
}

/**
 * Fluent SQLite table DDL: compose columns as objects, emit `CREATE TABLE IF NOT EXISTS` once.
 */
export class SqliteTableDefinition {
  private readonly segments: string[] = []

  add(column: SqliteColumnDef | string): this {
    if (typeof column === 'string') this.segments.push(column)
    else this.segments.push(column.render())
    return this
  }

  /** Composite UNIQUE ( … ). */
  unique(...columnNames: string[]): this {
    const inner = columnNames.map((c) => quoteSqlIdent(c)).join(', ')
    this.segments.push(`UNIQUE (${inner})`)
    return this
  }

  toCreateTableSql(qualifiedName: string): string {
    const q = quoteSqlIdent(qualifiedName)
    return `CREATE TABLE IF NOT EXISTS ${q} (\n  ${this.segments.join(',\n  ')}\n)`
  }
}
