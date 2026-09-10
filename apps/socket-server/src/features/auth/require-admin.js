// ── Contrôle d'accès administrateur ──────────────────────────────────────────
// Implémentation unique, partagée par toutes les routes d'administration.
//
// Elle existe parce qu'il y en avait deux. La seconde, dans la feature
// signalement, décodait le payload du jeton en base64 *sans vérifier la
// signature* et se contentait d'y lire un champ `isAdmin` :
//
//   Authorization: Bearer x.eyJpc0FkbWluIjp0cnVlfQ.x
//
// suffisait à passer pour administrateur. Elle lisait de surcroît un champ que
// personne n'émet — les jetons portent `role` — de sorte que la route était à
// la fois ouverte aux inconnus et fermée aux vrais administrateurs.

import jwt from 'jsonwebtoken'

export const ADMIN_ROLES = ['admin', 'superadmin']

/**
 * Vérifie la signature du jeton et le rôle qu'il porte.
 * Répond lui-même (401/403) et renvoie null en cas de refus.
 *
 * @returns {object|null} le payload vérifié, ou null si l'accès est refusé
 */
export function requireAdmin(req, reply, { jwtSecret, superAdminOnly = false }) {
  const auth = req.headers['authorization']
  if (!auth?.startsWith('Bearer ')) {
    reply.status(401).send({ error: 'Token requis' })
    return null
  }
  try {
    const payload = jwt.verify(auth.slice(7), jwtSecret)
    const role = payload.role ?? ''
    if (superAdminOnly && role !== 'superadmin') {
      reply.status(403).send({ error: 'Accès réservé au superadmin' })
      return null
    }
    if (!ADMIN_ROLES.includes(role)) {
      reply.status(403).send({ error: 'Accès refusé' })
      return null
    }
    return payload
  } catch {
    reply.status(401).send({ error: 'Token invalide' })
    return null
  }
}
