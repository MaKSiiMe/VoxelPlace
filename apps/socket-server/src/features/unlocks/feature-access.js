// ── Accès aux fonctionnalités de l'arbre ─────────────────────────────────────
// Une fonctionnalité débloquable est vérifiée par le serveur, pas seulement
// masquée par l'interface : sinon un appel direct suffirait à s'en servir.
// Les rôles de confiance y ont accès d'office, comme aux 16 couleurs (voir
// color-access.js) — un modérateur doit pouvoir repérer une zone vandalisée.

import jwt from 'jsonwebtoken'
import { ALL_COLORS_ROLES } from './color-access.js'

/**
 * Vérifie que la requête vient d'un compte ayant débloqué `nodeId`.
 * Répond lui-même 401 ou 403 et renvoie null en cas de refus.
 *
 * @returns {Promise<{username: string, role: string}|null>} le compte autorisé
 */
export async function requireFeature(req, reply, { pool, jwtSecret, nodeId }) {
  const auth = req.headers['authorization']
  let username = null
  if (auth?.startsWith('Bearer ')) {
    try { username = jwt.verify(auth.slice(7), jwtSecret).username ?? null } catch { /* jeton invalide */ }
  }
  if (!username) {
    reply.status(401).send({ error: 'Connexion requise' })
    return null
  }

  const { rows } = await pool.query(`
    SELECT u.role, (uu.node_id IS NOT NULL) AS unlocked
    FROM users u
    LEFT JOIN user_unlocks uu ON uu.username = u.username AND uu.node_id = $2
    WHERE LOWER(u.username) = LOWER($1)
  `, [username, nodeId])

  const account = rows[0]
  if (account && (account.unlocked || ALL_COLORS_ROLES.has(account.role))) return { username, role: account.role }

  reply.status(403).send({ error: 'Fonctionnalité à débloquer dans ta progression', nodeId })
  return null
}

/** L'équipe (superuser, admin, superadmin) : accès d'office, y compris aux données des autres joueurs. */
export const isStaff = (role) => ALL_COLORS_ROLES.has(role)
