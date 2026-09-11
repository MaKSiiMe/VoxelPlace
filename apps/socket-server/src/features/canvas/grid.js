import { logger } from '../../shared/logger.js'
const GRID_SIZE = parseInt(process.env.GRID_SIZE ?? '2048', 10)
const GRID_KEY = 'voxelplace:grid'
const PIXELS_KEY = 'voxelplace:pixels'

export function getPixelIndex(x, y) {
  return y * GRID_SIZE + x
}

/**
 * Charge la grille depuis Redis.
 * Retourne un Buffer de GRID_SIZE² octets (un octet par pixel = colorId).
 * Si le buffer est absent ou de taille incorrecte, tente de reconstruire
 * depuis voxelplace:pixels avant de créer une grille vide.
 */
export async function loadGrid(redis) {
  const buf = await redis.getBuffer(GRID_KEY)
  if (buf && buf.length === GRID_SIZE * GRID_SIZE) return buf

  if (buf) {
    logger.warn(`[loadGrid] Buffer taille incorrecte (${buf.length} au lieu de ${GRID_SIZE * GRID_SIZE}). Reconstruction depuis voxelplace:pixels…`)
  }

  const grid = Buffer.alloc(GRID_SIZE * GRID_SIZE, 0)

  // Reconstruit depuis le hash metadata si des pixels existent
  const all = await redis.hgetall(PIXELS_KEY)
  if (all) {
    let count = 0
    for (const raw of Object.values(all)) {
      try {
        const { x, y, colorId } = JSON.parse(raw)
        const index = getPixelIndex(x, y)
        if (index >= 0 && index < grid.length) {
          grid[index] = colorId & 0x0F
          count++
        }
      } catch { /* entrée corrompue, on l'ignore */ }
    }
    if (count > 0) logger.info(`[loadGrid] ${count} pixels restaurés depuis voxelplace:pixels.`)
  }

  await redis.set(GRID_KEY, grid)
  return grid
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
 * Remet le canvas entièrement à blanc.
 *
 * Écrit le buffer vide en une seule commande et supprime le hash de
 * métadonnées. Remplace une boucle de GRID_SIZE² setPixel (soit ~8,4 millions
 * de commandes Redis) par deux commandes.
 *
 * Les clients doivent être prévenus par un unique `canvas:reload` — surtout
 * pas par GRID_SIZE² émissions de `pixel:update`.
 */
export async function clearGrid(redis) {
  const empty = Buffer.alloc(GRID_SIZE * GRID_SIZE, 0)
  await redis.set(GRID_KEY, empty)
  await redis.del(PIXELS_KEY)
  return GRID_SIZE * GRID_SIZE
}

/**
 * Retire un pseudo des métadonnées de pixel, en conservant les couleurs.
 *
 * Appelé à la suppression d'un compte : les pixels restent sur le canvas mais
 * ne doivent plus désigner leur auteur. Le hash peut compter jusqu'à GRID_SIZE²
 * entrées : on le parcourt par curseur (HSCAN) plutôt que de tout charger d'un
 * bloc, pour ne pas bloquer Redis. Idempotent.
 *
 * @returns {Promise<number>} nombre de pixels anonymisés
 */
export async function anonymizePixelOwner(redis, username) {
  const target = username.toLowerCase()
  let cursor = '0'
  let changed = 0
  do {
    const [next, flat] = await redis.hscan(PIXELS_KEY, cursor, 'COUNT', 5000)
    cursor = next
    for (let i = 0; i < flat.length; i += 2) {
      let meta
      try { meta = JSON.parse(flat[i + 1]) } catch { continue }
      if (typeof meta.username !== 'string' || meta.username.toLowerCase() !== target) continue
      meta.username = null
      await redis.hset(PIXELS_KEY, flat[i], JSON.stringify(meta))
      changed++
    }
  } while (cursor !== '0')
  return changed
}

/**
 * Retourne les métadonnées d'un pixel (ou null si jamais modifié).
 */
export async function getPixelMeta(redis, x, y) {
  const raw = await redis.hget(PIXELS_KEY, `${x},${y}`)
  return raw ? JSON.parse(raw) : null
}

export { GRID_SIZE }
