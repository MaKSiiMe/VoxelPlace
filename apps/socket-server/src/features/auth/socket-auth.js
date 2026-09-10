// ── Authentification Socket.io ───────────────────────────────────────────────
// Middleware de handshake : vérifie le JWT s'il est présent et attache le
// username vérifié à socket.data. Les visiteurs sans token sont acceptés —
// ils ont accès à la grille en lecture seule (pixel:place les refusera).

import { verifyToken } from './routes.js'

/**
 * Construit le middleware de handshake Socket.io.
 *
 * Toute erreur est absorbée : Socket.io n'entoure pas l'exécution des
 * middlewares d'un try/catch, donc une exception qui s'échappe d'ici tue le
 * process entier. Un token illisible doit dégrader la connexion en lecture
 * seule, jamais faire tomber le serveur.
 */
export function createSocketAuth(jwtSecret) {
  return function socketAuth(socket, next) {
    try {
      const token = socket.handshake.auth?.token
      if (token) {
        const payload = verifyToken(token, jwtSecret)
        if (payload) {
          socket.data.verifiedUsername = payload.username
          socket.data.verifiedRole     = payload.role
        }
      }
    } catch (err) {
      console.error('[socket:auth]', err.message)
    }
    next()
  }
}
