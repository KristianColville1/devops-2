import jwt from 'jsonwebtoken'
import { env } from '@/core/env.js'

/** Same `sub` as PHP `ProxyJwt` — WordPress only verifies HS256 signature. */
export const PROXY_JWT_SUBJECT = 'ccl-php-backend'

export function requireProxyJwtSecret(): string {
  const secret = env('PROXY_JWT_SECRET')
  if (!secret) {
    throw new Error('PROXY_JWT_SECRET is not set.')
  }
  return secret
}

/** Mint JWT for outbound calls to WordPress `ccl_sync/v1/*`. */
export function encodeProxyJwt(ttlSeconds?: number): string {
  const secret = requireProxyJwtSecret()
  const ttl =
    ttlSeconds ?? Number(env('PROXY_JWT_TTL_SECONDS') || '28800')
  if (!Number.isFinite(ttl) || ttl < 60) {
    throw new Error('PROXY_JWT_TTL_SECONDS must be at least 60.')
  }
  const now = Math.floor(Date.now() / 1000)
  return jwt.sign(
    {
      sub: PROXY_JWT_SUBJECT,
      iat: now,
      exp: now + ttl,
    },
    secret,
    { algorithm: 'HS256' },
  )
}

/** Verify inbound proxy JWT (same secret as WordPress / Node outbound). */
export function verifyProxyJwt(token: string): jwt.JwtPayload {
  const secret = requireProxyJwtSecret()
  const decoded = jwt.verify(token, secret, {
    algorithms: ['HS256'],
  })
  if (typeof decoded === 'string') {
    throw new Error('Unexpected JWT payload')
  }
  return decoded
}
