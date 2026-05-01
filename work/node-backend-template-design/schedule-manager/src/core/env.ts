/**
 * Process env reads — values only; no health-catalog coupling here.
 */
export function env(key: string): string | undefined {
  const v = process.env[key]
  return v !== undefined && v !== '' ? v : undefined
}

export function envTruthy(key: string): boolean {
  const v = env(key)
  if (v === undefined) return false
  return ['1', 'true', 'yes', 'on'].includes(v.trim().toLowerCase())
}
