// ── Lecture des paramètres de requête ────────────────────────────────────────
// parseInt('abc') vaut NaN, qui ne lève rien et se propage : dans un calcul
// d'index il produit une zone vide, dans un « LIMIT $1 » il fait échouer la
// requête SQL. Ces helpers refusent explicitement ce qui n'est pas un entier.

/**
 * Entier strict, ou NaN si la valeur est présente mais invalide.
 * Une valeur absente retombe sur `fallback`.
 */
export function parseIntStrict(raw, fallback) {
  if (raw === undefined || raw === null || raw === '') return fallback
  const n = Number(raw)
  return Number.isInteger(n) ? n : NaN
}

/**
 * Entier strictement positif et borné. Toute valeur invalide retombe
 * silencieusement sur `fallback` — adapté aux paramètres de confort
 * (limit, pagination) où une erreur 400 serait disproportionnée.
 */
export function parsePositiveInt(raw, fallback, max) {
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) return fallback
  return Math.min(n, max)
}

/**
 * Rectangle de la grille, ramené à l'intérieur des bornes.
 * Renvoie null si un paramètre est présent mais n'est pas un entier, pour que
 * l'appelant réponde 400 au lieu de servir une zone vide.
 */
export function parseZone(query, gridSize) {
  const rx = parseIntStrict(query.x, 0)
  const ry = parseIntStrict(query.y, 0)
  const rw = parseIntStrict(query.w, 64)
  const rh = parseIntStrict(query.h, 64)
  if ([rx, ry, rw, rh].some(Number.isNaN)) return null

  const x = Math.min(Math.max(0, rx), gridSize - 1)
  const y = Math.min(Math.max(0, ry), gridSize - 1)
  const w = Math.min(gridSize - x, Math.max(1, rw))
  const h = Math.min(gridSize - y, Math.max(1, rh))
  return { x, y, w, h }
}
