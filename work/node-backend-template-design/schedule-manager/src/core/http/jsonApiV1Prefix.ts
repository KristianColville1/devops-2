/**
 * Public JSON API prefix for this service revision (`…/api/v1/…`).
 * Fixed in source—not env—so a deploy flag cannot silently remap every route.
 * If we introduce `/api/v2/`, add a second constant and wire only new handlers to it.
 */
export const JSON_API_V1_PREFIX = '/api/v1'
