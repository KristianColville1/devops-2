import jwt from 'jsonwebtoken'

/**
 * HS256 JWT for Ant Media Server REST — same payload shape as PHP (`LiveStreamingManager::generate_jwt`).
 */
export function generateOriginAmsJwt(secretKey: string): string {
  if (!secretKey) {
    throw new Error('ORIGIN_AMS_SECRET_KEY is not set')
  }
  const payload = { sub: 'token', iat: 1516239022 }
  return jwt.sign(payload, secretKey, { algorithm: 'HS256' })
}

/** Playlist REST uses its own secret (`PLAYLIST_AMS_SECRET_KEY`). */
export function generatePlaylistAmsJwt(secretKey: string): string {
  if (!secretKey) {
    throw new Error('PLAYLIST_AMS_SECRET_KEY is not set')
  }
  const payload = { sub: 'token', iat: 1516239022 }
  return jwt.sign(payload, secretKey, { algorithm: 'HS256' })
}
