import { config } from 'dotenv'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Load `.env` then `.env.local` from `process.cwd()` (non-destructive: does not override
 * variables already set — Docker/Kubernetes env wins).
 */
export function loadEnv(): void {
  const root = process.cwd()
  for (const name of ['.env', '.env.local']) {
    const path = resolve(root, name)
    if (existsSync(path)) {
      config({ path, override: false })
    }
  }
}

loadEnv()

/**
 * Wall-clock helpers ({@link SiteClock.formatMysql}, {@link SiteClock.mysqlWallToDate}) must agree:
 * `mysqlWallToDate` uses the JS local timezone (`TZ`), while `formatMysql` uses `CCL_SITE_TIMEZONE`
 * via Intl. Pin both to the same IANA zone (default Europe/Dublin; daylight-saving aware).
 */
function alignProcessTimezoneWithSite(): void {
  const raw = process.env.CCL_SITE_TIMEZONE
  const zone =
    raw !== undefined && String(raw).trim() !== '' ? String(raw).trim() : 'Europe/Dublin'
  process.env.TZ = zone
  process.env.CCL_SITE_TIMEZONE = zone
}

alignProcessTimezoneWithSite()
