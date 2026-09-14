// ── Réponse HTTP commune aux routes GIF ──────────────────────────────────────

import { checkRateLimit } from '../../features/auth/rate-limit.js'
import { renderTimelapseGif, GifBusyError } from './render.js'
import { logger } from '../logger.js'

const GIFS_PER_MINUTE = 5

/**
 * Rend et envoie un timelapse GIF, ou l'erreur adaptée.
 * @returns {Promise<void>}
 */
export async function sendTimelapseGif(req, reply, { rows, zone, scale, fps, filename }) {
  if (rows.length === 0) {
    return reply.status(404).send({ error: 'Aucun pixel à animer' })
  }
  try {
    const { buffer } = await renderTimelapseGif(rows, zone, { scale, fps })
    reply
      .header('Content-Type', 'image/gif')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .header('Content-Length', buffer.length)
      .send(buffer)
  } catch (err) {
    if (err instanceof GifBusyError) {
      return reply.status(503).header('Retry-After', '5').send({ error: err.message })
    }
    logger.error({ err: err.message }, 'gif')
    reply.status(500).send({ error: 'Impossible de générer le GIF' })
  }
}

/** Limite par IP, vérifiée avant toute requête SQL. Répond 429 et renvoie false si dépassée. */
export function allowGif(req, reply) {
  const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown'
  if (checkRateLimit(`gif:${ip}`, GIFS_PER_MINUTE)) return true
  reply.status(429).send({ error: 'Trop de GIF demandés, réessaie dans une minute' })
  return false
}
