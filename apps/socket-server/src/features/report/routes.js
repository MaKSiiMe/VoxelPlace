// ── Feature : Signalement ────────────────────────────────────────────────────
// POST /api/report              → signaler un pixel ou un joueur
// GET  /api/admin/reports       → liste des signalements (admin)
// PATCH /api/admin/reports/:id  → marquer comme traité (admin)

import jwt from 'jsonwebtoken'
import { isValidCoord, sanitizeUsername } from '../canvas/utils.js'
import { sanitizeMessage } from '../chat/message.js'
import { checkRateLimit } from '../auth/rate-limit.js'
import { requireAdmin } from '../auth/require-admin.js'
import { parsePositiveInt } from '../../shared/query.js'

// ── Validation pure (testable sans DB) ───────────────────────────────────────

const MAX_REASON_LENGTH = 256   // taille de la colonne reports.reason
const REPORTS_PER_MINUTE = 5

/**
 * Valide le corps d'un signalement.
 * Retourne null si invalide, sinon l'objet nettoyé.
 */
export function validateReport({ target_type, target_username, x, y, reason } = {}) {
  if (!['pixel', 'player'].includes(target_type)) return null

  // Les valeurs doivent tenir dans les colonnes : des coordonnées hors grille
  // ou décimales, un pseudo ou un motif trop long produisaient une erreur SQL,
  // renvoyée en 500.
  if (target_type === 'pixel' && (!isValidCoord(x) || !isValidCoord(y))) return null

  let username = null
  if (target_username !== undefined && target_username !== null) {
    if (typeof target_username !== 'string') return null
    username = sanitizeUsername(target_username) || null
  }
  if (target_type === 'player' && !username) return null

  return {
    target_type,
    target_username: username,
    x: target_type === 'pixel' ? x : null,
    y: target_type === 'pixel' ? y : null,
    reason: sanitizeMessage(reason, MAX_REASON_LENGTH),
  }
}

export async function reportRoutes(fastify, { pool, JWT_SECRET }) {

  function getUsername(req) {
    const auth = req.headers['authorization']
    if (!auth?.startsWith('Bearer ')) return null
    try {
      return jwt.verify(auth.slice(7), JWT_SECRET).username ?? null
    } catch { return null }
  }

  const isAdmin = (req, reply) => requireAdmin(req, reply, { jwtSecret: JWT_SECRET }) !== null

  // Soumettre un signalement
  // POST /api/report
  // Body : { target_type, target_username?, x?, y?, reason? }
  fastify.post('/api/report', async (req, reply) => {
    // Le signalement est ouvert aux visiteurs, et chaque requête écrit en base :
    // sans limite, un script remplissait la file de modération à volonté.
    const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown'
    if (!checkRateLimit(`report:${ip}`, REPORTS_PER_MINUTE)) {
      return reply.status(429).send({ error: 'Trop de signalements, réessaie dans une minute' })
    }

    const reporter = getUsername(req)  // null = anonyme OK
    const report = validateReport(req.body || {})

    if (!report) {
      return reply.status(400).send({ error: 'Données invalides (target_type, coordonnées ou username manquants)' })
    }

    await pool.query(
      `INSERT INTO reports (reporter, target_type, target_username, x, y, reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [reporter ?? null, report.target_type, report.target_username, report.x, report.y, report.reason]
    )

    reply.status(201).send({ ok: true })
  })

  // Liste des signalements (admin)
  // GET /api/admin/reports?status=pending&limit=50
  fastify.get('/api/admin/reports', async (req, reply) => {
    if (!isAdmin(req, reply)) return

    const status = ['pending', 'reviewed', 'all'].includes(req.query.status)
      ? req.query.status : 'pending'
    const limit = parsePositiveInt(req.query.limit, 50, 200)

    const where  = status === 'all' ? '' : 'WHERE status = $2'
    const params = status === 'all' ? [limit] : [limit, status]
    const { rows } = await pool.query(
      `SELECT * FROM reports ${where} ORDER BY created_at DESC LIMIT $1`,
      params
    )
    reply.send({ reports: rows, total: rows.length })
  })

  // Marquer un signalement comme traité (admin)
  // PATCH /api/admin/reports/:id
  fastify.patch('/api/admin/reports/:id', async (req, reply) => {
    if (!isAdmin(req, reply)) return

    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return reply.status(400).send({ error: 'Identifiant de signalement invalide' })
    }
    const reviewed_by = req.body?.reviewed_by ?? '[admin]'

    const { rowCount } = await pool.query(
      `UPDATE reports
       SET status = 'reviewed', reviewed_by = $1, reviewed_at = NOW()
       WHERE id = $2 AND status = 'pending'`,
      [reviewed_by, id]
    )

    if (rowCount === 0) return reply.status(404).send({ error: 'Signalement introuvable ou déjà traité' })
    reply.send({ ok: true, id })
  })
}
