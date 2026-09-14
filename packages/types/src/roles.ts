export type UserRole = 'user' | 'superuser' | 'admin' | 'superadmin'

// Les valeurs vivent dans un .js séparé : le backend est du JavaScript sans
// étape de build et les importe directement (@voxelplace/types/roles), tandis
// que le front passe par ce fichier pour récupérer aussi le type UserRole.
//
// Le fichier ne doit surtout pas s'appeler roles.js : TypeScript résout
// './roles.js' vers './roles.ts', c'est-à-dire ce fichier lui-même, ce qui
// produit une « Circular definition of import alias » et fait échouer
// silencieusement le build de production.
export { ROLE_COOLDOWNS, STREAK_COOLDOWNS } from './roles.constants.js'
