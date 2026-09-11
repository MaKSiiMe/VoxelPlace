// ── Règles communes aux messages de chat ─────────────────────────────────────

import { isValidCoord } from '../canvas/utils.js'

/**
 * Nettoie un message avant stockage et diffusion.
 *
 * Les messages étaient échappés en HTML ici (< → &lt;). C'est au rendu de
 * protéger l'affichage, pas au stockage : React échappe déjà le texte, et un
 * contenu pré-échappé s'afficherait littéralement « &lt; ». On retire en
 * revanche les caractères de contrôle, qu'aucun affichage ne sait traiter.
 *
 * @returns {string|null} le message nettoyé, ou null s'il ne reste rien
 */
export function sanitizeMessage(raw, maxLength) {
  if (typeof raw !== 'string') return null
  const clean = raw
    .replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '')   // contrôle, sauf tabulation et saut de ligne
    .trim()
    .slice(0, maxLength)
  return clean.length > 0 ? clean : null
}

/** Coordonnées de pixel valides : entiers dans la grille. */
export function isValidPixelTarget(x, y) {
  return isValidCoord(x) && isValidCoord(y)
}

/**
 * Anti-spam : au plus un message par intervalle, par clé.
 *
 * Les tables d'horodatage n'étaient jamais purgées et grossissaient d'une
 * entrée par joueur ayant parlé depuis le démarrage du serveur.
 */
export function createThrottle(intervalMs, now = Date.now) {
  const last = new Map()

  const timer = setInterval(() => {
    const cutoff = now() - intervalMs
    for (const [key, ts] of last) if (ts < cutoff) last.delete(key)
  }, Math.max(intervalMs * 10, 60_000))
  timer.unref?.()

  return {
    /** true si la clé peut émettre maintenant (et consomme son créneau). */
    allow(key) {
      const t = now()
      if (t - (last.get(key) ?? -Infinity) < intervalMs) return false
      last.set(key, t)
      return true
    },
    size: () => last.size,
    stop: () => clearInterval(timer),
  }
}
