import { tablePrefix } from './tablePrefix.js'

/** Logical suffix only, e.g. `ccl_stream_all_recordings` → `wp_ccl_stream_all_recordings`. */
export function qualifyTable(suffix: string): string {
  const pre = tablePrefix()
  if (!suffix || suffix.startsWith(pre)) return suffix
  return `${pre}${suffix}`
}
