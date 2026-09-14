/** Cooldown en ms par rôle (0 = aucune limite). Seul `user` est limité. */
export const ROLE_COOLDOWNS = {
  user:        60_000,
  superuser:        0,
  admin:            0,
  superadmin:       0,
}

/**
 * Réduction du cooldown d'un joueur ordinaire selon son streak — ses heures de
 * jeu consécutives. Du plus exigeant au moins exigeant : le premier palier
 * atteint s'applique. Partagé entre le serveur, qui l'applique, et l'aide du
 * jeu, qui l'affiche : l'aide annonçait jusqu'ici des valeurs inventées.
 */
export const STREAK_COOLDOWNS = [
  { minHours: 20, ms: 20_000 },
  { minHours: 10, ms: 30_000 },
  { minHours: 5,  ms: 45_000 },
]
