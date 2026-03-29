const GRID_SIZE = 2048
const GRID_KEY = 'voxelplace:grid'
const PIXELS_KEY = 'voxelplace:pixels'

export function getPixelIndex(x, y) {
  return y * GRID_SIZE + x
}

/**
 * Charge la grille depuis Redis.
 * Retourne un Buffer de 4096 octets (un octet par pixel = colorId).
 */
export async function loadGrid(redis) {
  const buf = await redis.getBuffer(GRID_KEY)
  if (buf && buf.length === GRID_SIZE * GRID_SIZE) return buf

  // Initialise la grille vide (colorId 0 = blanc)
  const empty = Buffer.alloc(GRID_SIZE * GRID_SIZE, 0)
  await redis.set(GRID_KEY, empty)
  return empty
}

/**
 * Persiste un pixel dans Redis :
 * - Met à jour le byte dans le buffer principal
 * - Stocke les métadonnées dans le HASH voxelplace:pixels
 */
export async function setPixel(redis, { x, y, colorId, username, source }) {
  const index = getPixelIndex(x, y)

  // Mise à jour atomique du byte dans le buffer
  await redis.setrange(GRID_KEY, index, Buffer.from([colorId]))

  // Métadonnées complètes
  const meta = JSON.stringify({ x, y, colorId, username, source, updatedAt: Date.now() })
  await redis.hset(PIXELS_KEY, `${x},${y}`, meta)

  return { x, y, colorId, username, source }
}

/**
 * Retourne les métadonnées d'un pixel (ou null si jamais modifié).
 */
export async function getPixelMeta(redis, x, y) {
  const raw = await redis.hget(PIXELS_KEY, `${x},${y}`)
  return raw ? JSON.parse(raw) : null
}

export { GRID_SIZE }
