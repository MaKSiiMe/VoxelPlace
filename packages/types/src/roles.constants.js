export const SUPERUSER_PREFIXES = ['hbtn_', 'tm_', 'pt_']

/** Cooldown en ms par rôle (0 = aucune limite). Seul `user` est limité. */
export const ROLE_COOLDOWNS = {
  user:        60_000,
  superuser:        0,
  admin:            0,
  superadmin:       0,
}
