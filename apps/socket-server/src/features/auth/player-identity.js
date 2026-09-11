// ── Identité d'un joueur connecté ────────────────────────────────────────────
// Détermine sous quel pseudo et quelle plateforme un socket est enregistré.
//
// player:join acceptait le pseudo envoyé par le client, sans le confronter à
// quoi que ce soit. Un visiteur pouvait se présenter sous le nom d'un autre :
// parler en son nom dans le chat, recevoir ses notifications (pixel écrasé,
// déblocages), et — la table pseudo → socket étant écrasée au passage — faire
// que le bannissement de la victime déconnecte l'imposteur au lieu d'elle.

import { sanitizeUsername } from '../canvas/utils.js'

/** Plateformes servies par un pont de jeu, et non par le client web. */
export const BRIDGE_SOURCES = new Set(['minecraft', 'roblox', 'hytale'])

/**
 * @param {{username?: string, source?: string}} declared  ce qu'annonce le client
 * @param {{verifiedUsername?: string, isBridge?: boolean}} proven  ce qu'a prouvé le handshake
 * @returns {{username: string, source: string} | null}  null : rien à enregistrer
 */
export function resolvePlayerIdentity(declared = {}, proven = {}) {
  // Un pont authentifié agit pour le compte de joueurs d'un autre jeu : c'est
  // lui qui connaît leur identité, on reprend donc celle qu'il déclare.
  if (proven.isBridge) {
    if (typeof declared.username !== 'string') return null
    const username = sanitizeUsername(declared.username)
    if (!username) return null
    const source = BRIDGE_SOURCES.has(declared.source) ? declared.source : 'minecraft'
    return { username, source }
  }

  // Un joueur web est celui que désigne son jeton, quoi qu'il annonce.
  if (proven.verifiedUsername) {
    return { username: proven.verifiedUsername, source: 'web' }
  }

  // Visiteur sans preuve : lecture seule, aucune identité à enregistrer.
  return null
}
