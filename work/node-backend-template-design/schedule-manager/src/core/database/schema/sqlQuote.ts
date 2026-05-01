/** SQLite double-quoted identifier. */
export function quoteSqlIdent(ident: string): string {
  return `"${ident.replace(/"/g, '""')}"`
}
