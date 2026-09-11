// ── Présence des joueurs connectés ───────────────────────────────────────────
// Tient deux tables partagées par les features temps réel :
//   connectedPlayers : socket.id → { username, source }   (compte des joueurs)
//   usernameToSocket : pseudo    → socket.id               (notifications ciblées)

/**
 * Enregistre un socket.
 *
 * Un visiteur sans identité prouvée est compté comme présent sur le web, mais
 * n'a pas de pseudo : il ne reçoit aucune notification ciblée et ne peut pas
 * écrire dans le chat (qui vérifie `username`).
 */
export function registerPresence(connectedPlayers, usernameToSocket, socketId, identity) {
  if (!identity) {
    connectedPlayers.set(socketId, { username: null, source: 'web' })
    return
  }
  connectedPlayers.set(socketId, identity)
  usernameToSocket.set(identity.username.toLowerCase(), socketId)
}

/**
 * Retire un socket.
 *
 * La correspondance pseudo → socket n'est effacée que si elle désigne encore
 * ce socket. Avec deux onglets ouverts, le second écrase la correspondance du
 * premier ; fermer le premier l'effaçait pourtant, et le second onglet — seul
 * encore ouvert — cessait de recevoir ses notifications.
 */
export function unregisterPresence(connectedPlayers, usernameToSocket, socketId) {
  const player = connectedPlayers.get(socketId)
  connectedPlayers.delete(socketId)
  if (!player?.username) return

  const key = player.username.toLowerCase()
  if (usernameToSocket.get(key) === socketId) usernameToSocket.delete(key)
}

/** Compte par plateforme, diffusé aux clients. */
export function presencePayload(connectedPlayers) {
  const byPlatform = {}
  for (const { source } of connectedPlayers.values()) {
    byPlatform[source] = (byPlatform[source] ?? 0) + 1
  }
  return { count: connectedPlayers.size, byPlatform }
}
