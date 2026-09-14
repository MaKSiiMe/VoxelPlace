// ── Migrations de la progression ─────────────────────────────────────────────

import { runOnce } from '../../shared/migrations.js'
import { BRIDGE_SOURCES } from '../auth/player-identity.js'
import { BASE_COLOR_NODES } from './tree.js'
import { logger } from '../../shared/logger.js'

/**
 * Accorde à chaque compte les couleurs de base et toutes celles qu'il a déjà
 * posées au moins une fois. Idempotente.
 *
 * Préalable au verrouillage des couleurs : les joueurs d'avant ce verrouillage
 * posaient librement les 16 couleurs, et ne doivent pas en perdre.
 *
 * La source est pixel_history, complète depuis le premier pixel, et non
 * user_color_counts, qui ne compte que depuis l'arrivée du moteur de
 * progression. Sont ignorés :
 * - les pseudos NULL, laissés par les comptes effacés ;
 * - les pixels venus d'un pont de jeu : un joueur Minecraft n'a pas de compte,
 *   et son pseudo peut coïncider avec celui d'un compte web sans que ce soit
 *   la même personne.
 * La jointure sur users rend au pseudo sa casse canonique, sur laquelle
 * user_unlocks est indexée.
 */
export async function grantPlayedColors(db) {
  const base = await db.query(`
    INSERT INTO user_unlocks (username, node_id)
    SELECT u.username, node.id
    FROM users u CROSS JOIN unnest($1::text[]) AS node(id)
    ON CONFLICT DO NOTHING
  `, [BASE_COLOR_NODES])

  const played = await db.query(`
    INSERT INTO user_unlocks (username, node_id)
    SELECT u.username, 'color:' || h.color_id
    FROM (
      SELECT DISTINCT LOWER(username) AS login, color_id
      FROM pixel_history
      WHERE username IS NOT NULL
        AND (source IS NULL OR source <> ALL($1::text[]))
    ) h
    JOIN users u ON LOWER(u.username) = h.login
    WHERE h.color_id BETWEEN 0 AND 15
    ON CONFLICT DO NOTHING
  `, [[...BRIDGE_SOURCES]])

  return { base: base.rowCount, played: played.rowCount }
}

export async function runUnlockMigrations(pool) {
  let granted
  const applied = await runOnce(pool, '2026-09-grant-played-colors', async (client) => {
    granted = await grantPlayedColors(client)
  })
  if (applied) {
    logger.info(granted, '[Progression] Couleurs déjà posées accordées aux comptes existants')
  }
}
