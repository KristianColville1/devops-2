import jwt from 'jsonwebtoken'
import type { FastifyReply, FastifyRequest } from 'fastify'

function uiTokenSecret(): string {
  return process.env.SCHEDULE_MANAGER_UI_TOKEN?.trim() ?? ''
}

/** HttpOnly cookie carrying a short-lived JWT (same secret as `SCHEDULE_MANAGER_UI_TOKEN`). */
export const SESSION_COOKIE_NAME = 'sm_session'
export const SESSION_MAX_AGE_SECONDS = 3600

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader?.trim()) return {}
  const out: Record<string, string> = {}
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=')
    if (idx <= 0) continue
    const k = part.slice(0, idx).trim()
    const v = part.slice(idx + 1).trim()
    try {
      out[k] = decodeURIComponent(v)
    } catch {
      out[k] = v
    }
  }
  return out
}

export function sessionJwtFromRequest(request: FastifyRequest): string | undefined {
  return parseCookies(request.headers.cookie)[SESSION_COOKIE_NAME]
}

export function signUiSessionJwt(): string | null {
  const secret = uiTokenSecret()
  if (!secret) return null
  return jwt.sign({ sub: 'admin', typ: 'sm_ui' }, secret, {
    expiresIn: SESSION_MAX_AGE_SECONDS,
  })
}

export function verifyUiSessionJwt(token: string): boolean {
  const secret = uiTokenSecret()
  if (!secret) return false
  try {
    const decoded = jwt.verify(token, secret) as { typ?: string }
    return decoded.typ === 'sm_ui'
  } catch {
    return false
  }
}

/** Browser cookie session OR `Authorization: Bearer` (operators, scripts, webhooks). */
export function isAuthorizedOperator(request: FastifyRequest): boolean {
  const secret = uiTokenSecret()
  if (!secret) return false

  const h = request.headers.authorization
  if (h?.startsWith('Bearer ')) {
    const bearer = h.slice(7).trim()
    if (bearer === secret) return true
  }

  const raw = sessionJwtFromRequest(request)
  if (raw && verifyUiSessionJwt(raw)) return true

  return false
}

export function appendSessionSetCookie(reply: FastifyReply, jwtToken: string) {
  const secure = process.env.NODE_ENV === 'production'
  const flags = [
    `${SESSION_COOKIE_NAME}=${jwtToken}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    'SameSite=Lax',
  ]
  if (secure) flags.push('Secure')
  reply.header('Set-Cookie', flags.join('; '))
}

export function appendSessionClearCookie(reply: FastifyReply) {
  const secure = process.env.NODE_ENV === 'production'
  const flags = [`${SESSION_COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'Max-Age=0', 'SameSite=Lax']
  if (secure) flags.push('Secure')
  reply.header('Set-Cookie', flags.join('; '))
}
