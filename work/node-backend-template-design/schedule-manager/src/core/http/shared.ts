/** Join a base URL with path segments; trims duplicate slashes. */
export function joinUrl(base: string, ...segments: string[]) {
  let u = base.replace(/\/+$/, '')
  for (const s of segments) {
    const seg = String(s).replace(/^\/+|\/+$/g, '')
    if (seg) u += '/' + seg
  }
  return u
}

/** `setTimeout` wrapped in a Promise. */
export function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

/** HTTP status and response body text (typical small REST payloads). */
export async function responseStatusBody(res: Response) {
  const body = await res.text()
  return { status: res.status, body }
}
