// ── Pose d'un pixel : la décision ────────────────────────────────────────────
// Contient toute la règle métier — validation, identité, cooldown, ban,
// écriture — sans rien émettre. Les diffusions Socket.io restent au handler.
//
// Cette séparation existe pour que le cœur du jeu soit testable sans monter un
// serveur temps réel : c'est le chemin le plus critique de l'application et il
// n'était couvert par aucun test.

import { setPixel, getPixelMeta } from './grid.js'
import { validatePixel } from './utils.js'
import { incrementStats } from '../analytics/stats.js'
import { BRIDGE_SOURCES } from '../auth/player-identity.js'
import { logger } from '../../shared/logger.js'


/**
 * @returns {Promise<{ok: true, pixel, prevMeta, cooldownMs} | {ok: false, error, cooldown?}>}
 */
export async function placePixel({ redis, pool, cooldown }, data, { verifiedUsername, isBridge = false } = {}) {
  const pixel = validatePixel(data)
  if (!pixel) return { ok: false, error: 'Données invalides' }

  // Le statut de pont se prouve au handshake (voir socket-auth.js), jamais
  // dans le message. Se déclarer « minecraft » ne suffit plus : c'est ce qui
  // permettait de poser sans compte, sans cooldown et sous n'importe quel nom.
  const claimsBridge = BRIDGE_SOURCES.has(pixel.source)
  if (claimsBridge && !isBridge) {
    return { ok: false, error: 'Pont de jeu non authentifié' }
  }
  if (isBridge && !claimsBridge) {
    return { ok: false, error: 'Source invalide pour un pont de jeu' }
  }

  // Un client web doit prouver son identité, et ne peut poser qu'en son nom.
  if (!isBridge) {
    // Toute source non-pont est ramenée à « web » : la valeur alimente les
    // compteurs par plateforme, et une source libre y créerait des champs
    // arbitraires.
    pixel.source = 'web'

    if (!verifiedUsername) {
      return { ok: false, error: 'Connexion requise pour placer des pixels' }
    }
    if (verifiedUsername.toLowerCase() !== pixel.username.toLowerCase()) {
      return { ok: false, error: 'Identité non autorisée' }
    }
    // Un JWT reste valide sept jours : sans cette vérification, un compte
    // supprimé continuait de poser des pixels sous son ancien pseudo, recréant
    // l'historique qu'on venait d'effacer. getUser est mis en cache.
    const { exists } = await cooldown.getUser(verifiedUsername)
    if (!exists) {
      return { ok: false, error: 'Ce compte n\'existe plus.' }
    }

    // Le nom du jeton fait autorité : c'est celui enregistré en base. Le client
    // peut envoyer « alice » pour le compte « Alice » — la comparaison ci-dessus
    // l'accepte, mais laisser passer cette casse créerait une seconde ligne de
    // progression (user_stats, user_color_counts sont indexées sur le pseudo).
    pixel.username = verifiedUsername
  }

  // Les ponts de jeu appliquent leur propre rythme (un bloc posé à la main).
  const { wait, cooldownMs } = isBridge
    ? { wait: 0, cooldownMs: 0 }
    : await cooldown.check(pixel.username)

  if (wait > 0) {
    return { ok: false, error: `Trop vite ! Attends ${Math.ceil(wait / 1000)}s.`, cooldown: wait }
  }

  if (await isBanned(pool, pixel.username)) {
    return { ok: false, error: 'Vous êtes banni.' }
  }

  // Propriétaire précédent, lu avant écrasement — sert aux notifications,
  // aux statistiques de conflit et à la réinitialisation du fil de discussion.
  const prevMeta = await getPixelMeta(redis, pixel.x, pixel.y)

  await setPixel(redis, pixel)
  await incrementStats(redis, pixel.source)

  // Historique : volontairement non attendu, pour ne pas retarder l'affichage
  // du pixel. Une écriture perdue coûte une ligne d'historique, pas le pixel.
  pool.query(
    'INSERT INTO pixel_history (x, y, color_id, username, source) VALUES ($1, $2, $3, $4, $5)',
    [pixel.x, pixel.y, pixel.colorId, pixel.username, pixel.source]
  ).catch(err => logger.error({ err: err.message }, 'pixel_history'))

  return { ok: true, pixel, prevMeta, cooldownMs }
}

async function isBanned(pool, username) {
  try {
    const { rows } = await pool.query(
      `SELECT 1 FROM bans WHERE LOWER(username) = LOWER($1)
       AND (expires_at IS NULL OR expires_at > NOW())`,
      [username]
    )
    return rows.length > 0
  } catch (err) {
    // Base injoignable : on laisse passer plutôt que de bloquer tout le jeu.
    logger.error({ err: err.message }, 'bans')
    return false
  }
}

/** Le pixel a-t-il changé de propriétaire ? */
export function changedOwner(prevMeta, pixel) {
  return Boolean(prevMeta?.username)
    && prevMeta.username.toLowerCase() !== pixel.username.toLowerCase()
}
