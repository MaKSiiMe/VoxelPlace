// ── Actions de modération partagées ──────────────────────────────────────────
// Utilisées par la route REST et par l'événement socket admin:clear, qui
// divergeaient : aucun des deux n'écrivait l'effacement dans pixel_history.

import { setPixel, getPixelMeta } from '../canvas/grid.js'

/**
 * Remet un pixel à blanc au nom d'un modérateur.
 *
 * L'effacement est inscrit dans pixel_history : sans cela, une restauration du
 * canvas depuis l'historique faisait réapparaître le pixel modéré. La ligne
 * n'a pas de pseudo (source « moderation ») : elle ne compte dans aucun
 * classement ni aucune progression.
 *
 * @returns {Promise<{previousOwner: string|null}>}
 */
export async function clearPixelAsModerator({ redis, pool, io }, x, y, moderator) {
  const previous = await getPixelMeta(redis, x, y)
  const pixel    = { x, y, colorId: 0, username: '[admin]', source: 'moderation' }

  await setPixel(redis, pixel)
  io.emit('pixel:update', pixel)

  const previousOwner = previous?.username && previous.username !== '[admin]' ? previous.username : null
  await pool.query(
    `INSERT INTO pixel_history (x, y, color_id, username, source) VALUES ($1, $2, 0, NULL, 'moderation')`,
    [x, y]
  )
  await pool.query(
    `INSERT INTO moderation_logs (action, target, admin, metadata) VALUES ('clear_pixel', $1, $2, $3)`,
    [previousOwner, moderator, { x, y }]
  )
  return { previousOwner }
}
