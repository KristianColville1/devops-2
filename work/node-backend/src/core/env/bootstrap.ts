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
