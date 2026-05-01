/**
 * Site-local wall clock as `Y-m-d H:i:s`. Requires `TZ` and `CCL_SITE_TIMEZONE` to match
 * (see `core/env/bootstrap.ts`, default `Europe/Dublin`).
 */
export class SiteClock {
  private constructor() {}

  private static timeZone() {
    const z = process.env.CCL_SITE_TIMEZONE
    return z !== undefined && String(z).trim() !== '' ? String(z).trim() : 'Europe/Dublin'
  }

  /** Current instant as `Y-m-d H:i:s` in the configured IANA timezone. */
  static mysqlNow() {
    return SiteClock.formatMysql(new Date())
  }

  /** Now plus wall-clock minutes (not RRULE). */
  static plusMinutes(minutes: number) {
    const d = new Date()
    d.setMinutes(d.getMinutes() + minutes)
    return SiteClock.formatMysql(d)
  }

  /** Now minus wall-clock minutes. */
  static minusMinutes(minutes: number) {
    const d = new Date()
    d.setMinutes(d.getMinutes() - minutes)
    return SiteClock.formatMysql(d)
  }

  /** Timestamp string from `hours` ago (rolling window helpers). */
  static mysqlHoursAgo(hours: number) {
    const d = new Date()
    d.setHours(d.getHours() - hours)
    return SiteClock.formatMysql(d)
  }

  /** Calendar-day based: midnight-relative subtraction of `days`. */
  static mysqlDaysBefore(days: number) {
    const d = new Date()
    d.setDate(d.getDate() - days)
    return SiteClock.formatMysql(d)
  }

  /** Convenience for “N weeks” purge-style filters. */
  static mysqlWeeksBefore(weeks: number) {
    return SiteClock.mysqlDaysBefore(weeks * 7)
  }

  /**
   * Parse `Y-m-d H:i:s` as wall time in {@link SiteClock.timeZone} (same zone as `formatMysql`;
   * relies on `process.env.TZ` — set in bootstrap).
   */
  static mysqlWallToDate(mysql: string) {
    const [d, t] = mysql.trim().split(/\s+/)
    const [y, mo, da] = d.split('-').map(Number)
    const [h, mi, s] = (t || '00:00:00').split(':').map(Number)
    return new Date(y, mo - 1, da, h, mi, s ?? 0)
  }

  /** Hour 0–23 from {@link mysqlNow} string (site-local wall clock). */
  static siteHourFromMysqlClock() {
    const s = SiteClock.mysqlNow()
    return Number.parseInt(s.slice(11, 13), 10)
  }

  /** Format any JS Date into mysql-shaped local/site string. */
  static formatMysql(d: Date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: SiteClock.timeZone(),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(d)
    const pick = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
    const y = pick('year')
    const mo = pick('month')
    const da = pick('day')
    let h = pick('hour')
    let mi = pick('minute')
    let s = pick('second')
    if (/^\d$/.test(h)) h = `0${h}`
    if (/^\d$/.test(mi)) mi = `0${mi}`
    if (/^\d$/.test(s)) s = `0${s}`
    return `${y}-${mo}-${da} ${h}:${mi}:${s}`
  }
}
