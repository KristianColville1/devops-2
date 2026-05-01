/**
 * Unit tests: `@/core/jwt/proxyWordPressJwt`
 * — setup: env vars per test (no server, no DB).
 */
import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert'
import jwt from 'jsonwebtoken'

describe('@/core/jwt/proxyWordPressJwt · unit', () => {
  beforeEach(() => {
    process.env.PROXY_JWT_SECRET = 'test-secret-at-least-32-chars-long!!!!'
    delete process.env.PROXY_JWT_TTL_SECONDS
  })

  it('encodes and verifies HS256 JWT for WordPress sync', async () => {
    const { encodeProxyJwt, verifyProxyJwt, PROXY_JWT_SUBJECT } =
      await import('@/core/jwt/proxyWordPressJwt.js')
    const token = encodeProxyJwt(120)
    const decoded = verifyProxyJwt(token)
    assert.strictEqual(decoded.sub, PROXY_JWT_SUBJECT)
    assert.ok(decoded.exp && decoded.iat && decoded.exp > decoded.iat)
  })

  it('matches token shape WordPress accepts (HS256)', async () => {
    const { encodeProxyJwt } = await import('@/core/jwt/proxyWordPressJwt.js')
    const token = encodeProxyJwt(300)
    const secret = process.env.PROXY_JWT_SECRET!
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as {
      sub: string
    }
    assert.strictEqual(decoded.sub, 'ccl-php-backend')
  })
})
