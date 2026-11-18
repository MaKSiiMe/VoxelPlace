// ── Politique du mot de passe d'administration ───────────────────────────────
// ADMIN_PASSWORD ouvre un JWT superadmin valable 7 jours (voir routes.js) : c'est
// le secret le plus puissant du serveur. Une valeur d'exemple ou trop courte
// doit empêcher le démarrage plutôt que d'ouvrir le tableau de bord à qui la devine.

export const ADMIN_PASSWORD_MIN_LENGTH = 16

// Valeurs d'exemple livrées dans les .env.example et le README d'origine
const DEFAULT_VALUES = new Set(['changeme'])

/**
 * Retourne la raison du refus, ou null si la valeur est acceptable.
 * Le message ne contient jamais la valeur elle-même.
 */
export function adminPasswordProblem(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return 'ADMIN_PASSWORD manquant'
  }
  if (DEFAULT_VALUES.has(value.trim().toLowerCase())) {
    return 'ADMIN_PASSWORD vaut encore la valeur d\'exemple « changeme »'
  }
  if (value.length < ADMIN_PASSWORD_MIN_LENGTH) {
    return `ADMIN_PASSWORD trop court (${ADMIN_PASSWORD_MIN_LENGTH} caractères minimum)`
  }
  return null
}
