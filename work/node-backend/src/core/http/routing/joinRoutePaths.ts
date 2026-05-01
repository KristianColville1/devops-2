/** Build a single path from segments like `/api/v1`, `system`, `status`. */
export function joinRoutePaths(...parts: string[]) {
  const segs = parts
    .map((p) => p.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
  return '/' + segs.join('/')
}
