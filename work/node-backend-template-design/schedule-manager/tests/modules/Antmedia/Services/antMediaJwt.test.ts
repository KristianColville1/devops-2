/**
 * Unit tests: `@/modules/Antmedia/Services/antMediaJwt`
 * — JWT helpers only (no HTTP).
 */
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import { describe, test } from 'node:test'

import {
  generateOriginAmsJwt,
  generatePlaylistAmsJwt,
} from '@/modules/Antmedia/Services/antMediaJwt.js'

describe('@/modules/Antmedia/Services/antMediaJwt · unit', () => {
  test('generateOriginAmsJwt matches PHP payload shape (HS256)', () => {
    const secret = 'test-secret'
    const token = generateOriginAmsJwt(secret)
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as {
      sub: string
      iat: number
    }
    assert.equal(decoded.sub, 'token')
    assert.equal(decoded.iat, 1516239022)
  })

  test('generatePlaylistAmsJwt uses playlist secret independently', () => {
    const token = generatePlaylistAmsJwt('playlist-secret')
    jwt.verify(token, 'playlist-secret', { algorithms: ['HS256'] })
  })

  test('generateOriginAmsJwt rejects empty secret', () => {
    assert.throws(() => generateOriginAmsJwt(''), /ORIGIN_AMS_SECRET_KEY/)
  })
})
