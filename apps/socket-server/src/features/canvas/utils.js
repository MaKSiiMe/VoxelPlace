// Fonctions utilitaires pures — testables indépendamment

import { GRID_SIZE } from './grid.js'

/**
 * Une coordonnée valide est un entier à l'intérieur de la grille.
 *
 * La borne suit GRID_SIZE plutôt qu'un 2047 en dur : les deux se
 * contrediraient dès que GRID_SIZE serait redéfini par l'environnement.
 * Cette fonction garde tout ce qui atteint SETRANGE — une coordonnée hors
 * bornes y devient un décalage arbitraire, et Redis agrandit alors le buffer
 * jusqu'à cet index.
 */
export function isValidCoord(v) {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < GRID_SIZE
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
  if (typeof colorId !== 'number' || !Number.isInteger(colorId) || colorId < 0 || colorId > 15) return null
  if (typeof username !== 'string') return null
  const cleanUsername = sanitizeUsername(username)
  if (cleanUsername.length === 0) return null
  return {
    x, y, colorId,
    username: cleanUsername,
    source: typeof source === 'string' ? source.replace(/[<>"'`]/g, '').slice(0, 64) : 'web',
  }
}
