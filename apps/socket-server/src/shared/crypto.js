import { timingSafeEqual } from 'node:crypto'

/**
 * Comparaison de chaînes à temps constant.
 *
 * Une comparaison `===` classique s'arrête au premier caractère divergent :
 * le temps de réponse renseigne alors sur le préfixe correct du secret. Utilisé
 * pour tout ce qui compare un secret fourni par le client (mot de passe admin).
 */
export function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) {
    // Compare quand même, pour ne pas court-circuiter sur la seule longueur
    timingSafeEqual(bufA, bufA)
    return false
  }
  return timingSafeEqual(bufA, bufB)
}
