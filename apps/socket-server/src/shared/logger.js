// ── Journalisation ───────────────────────────────────────────────────────────
// Une instance Pino unique, partagée par Fastify et par tout le reste du
// serveur (handlers Socket.io compris).
//
// Le serveur n'écrivait que des console.log : ni horodatage, ni niveau, ni
// moyen de relier une erreur à une requête ou à un joueur. En cas d'incident en
// production, il n'y avait rien à lire — le crash au démarrage de l'API est
// resté invisible pendant des semaines faute de trace exploitable.

import pino from 'pino'

const isProduction = process.env.NODE_ENV === 'production'

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),

  // En production : une ligne JSON par événement, exploitable par un
  // collecteur. En développement : lisible directement dans le terminal.
  ...(isProduction ? {} : {
    transport: {
      target:  'pino/file',
      options: { destination: 1 },   // stdout
    },
  }),

  // Ne jamais laisser un secret atterrir dans les journaux
  redact: {
    paths: [
      'password', '*.password',
      'req.headers.authorization',
      'req.headers.cookie',
      'token', '*.token',
    ],
    censor: '[masqué]',
  },

  base: { service: 'voxelplace-api' },
})

/** Journal dédié à un sous-système, pour filtrer par domaine. */
export function childLogger(name) {
  return logger.child({ module: name })
}
