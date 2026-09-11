// ── Authentification Socket.io ───────────────────────────────────────────────
// Middleware de handshake. Deux identités possibles :
//
//   · un joueur web, prouvé par son JWT        → socket.data.verifiedUsername
//   · un pont de jeu (plugin Minecraft), prouvé
//     par un secret partagé                    → socket.data.isBridge
//
// Les visiteurs sans preuve sont acceptés en lecture seule.
//
// Le pont était auparavant reconnu sur la seule déclaration du client
// (`source: 'minecraft'` dans le message). N'importe quel navigateur pouvait
// donc poser des pixels sans compte, sans cooldown et sous un pseudo arbitraire.
// L'identité de pont se prouve désormais au handshake, jamais dans un message.

import { verifyToken } from './routes.js'
import { constantTimeEqual } from '../../shared/crypto.js'
import { logger } from '../../shared/logger.js'

/**
 * @param {object} options
 * @param {string} options.jwtSecret    secret de signature des JWT joueurs
 * @param {string} [options.bridgeToken] secret partagé avec les ponts de jeu ;
 *                                       absent, aucun socket ne peut s'en réclamer
 */
export function createSocketAuth({ jwtSecret, bridgeToken }) {
  return function socketAuth(socket, next) {
    // Toute erreur est absorbée : Socket.io n'entoure pas l'exécution des
    // middlewares d'un try/catch, et une exception qui s'échappe d'ici tue le
    // process. Une preuve illisible dégrade la connexion en lecture seule.
    try {
      const auth = socket.handshake.auth ?? {}

      if (auth.token) {
        const payload = verifyToken(auth.token, jwtSecret)
        if (payload) {
          socket.data.verifiedUsername = payload.username
          socket.data.verifiedRole     = payload.role
        }
      }

      if (auth.bridgeToken && bridgeToken && constantTimeEqual(auth.bridgeToken, bridgeToken)) {
        socket.data.isBridge = true
      }
    } catch (err) {
      logger.error({ err: err.message }, 'socket:auth')
    }
    next()
  }
}
