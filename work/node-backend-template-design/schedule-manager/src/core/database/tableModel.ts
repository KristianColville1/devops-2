import { qualifyTable } from './qualify.js'

/**
 * ChurchCamLive logical table: suffix (e.g. `ccl_stream_all_recordings`) + qualified name for LibSQL.
 */
export type CclTableModel = {
  readonly suffix: string
  /** Full SQLite identifier: `wp_` + logical `ccl_*` suffix. */
  qualifiedTable(): string
}

export function cclTable(suffix: string): CclTableModel {
  return {
    suffix,
    qualifiedTable() {
      return qualifyTable(suffix)
    },
  }
}
