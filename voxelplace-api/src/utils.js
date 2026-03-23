// Fonctions utilitaires pures — testables indépendamment

export function isValidCoord(v) {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 63
}

export function sanitizeUsername(raw) {
  return raw
    .replace(/[<>"'`]/g, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim()
    .slice(0, 32)
}

export function validatePixel(data) {
  const { x, y, colorId, username, source } = data || {}
  if (!isValidCoord(x) || !isValidCoord(y)) return null
  if (typeof colorId !== 'number' || !Number.isInteger(colorId) || colorId < 0 || colorId > 7) return null
  if (typeof username !== 'string') return null
  const cleanUsername = sanitizeUsername(username)
  if (cleanUsername.length === 0) return null
  return {
    x, y, colorId,
    username: cleanUsername,
    source: typeof source === 'string' ? source.replace(/[<>"'`]/g, '').slice(0, 64) : 'web',
  }
}
