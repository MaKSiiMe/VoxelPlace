// ── Feature : Admin ──────────────────────────────────────────────────────────
// POST /api/admin/login                   → JWT avec role superadmin
// PATCH /api/admin/users/:username/role   → changer le rôle d'un utilisateur (superadmin)
// GET  /api/admin/dashboard               → stats globales
// POST /api/admin/ban/:username           → bannir
// DELETE /api/admin/ban/:username         → débannir
// GET  /api/admin/bans                    → liste des bannis
// GET  /api/admin/users?q=                → recherche de comptes (sans q : l'équipe)
// GET  /api/admin/logs                    → logs de modération
// GET  /api/moderation/logs               → logs publics
// POST /api/admin/pixel/clear             → remettre un pixel à blanc
// DELETE /api/admin/canvas                → vider le canvas (superadmin only)
// POST /api/admin/restore-canvas          → reconstruire le canvas depuis pixel_history (superadmin only)
//
// Le modérateur inscrit dans les journaux est toujours celui du jeton
// (voir moderatorName) : aucun nom fourni par la requête n'est lu.

import jwt from 'jsonwebtoken'
import { checkRateLimit } from '../auth/rate-limit.js'
import { clearGrid } from '../canvas/grid.js'
import { isValidCoord, sanitizeUsername } from '../canvas/utils.js'
import { sanitizeMessage } from '../chat/message.js'
import { parsePositiveInt } from '../../shared/query.js'
import { requireAdmin as checkAdmin, moderatorName } from '../auth/require-admin.js'
import { clearPixelAsModerator } from './moderation.js'
import { constantTimeEqual } from '../../shared/crypto.js'
import { logger } from '../../shared/logger.js'

const VALID_ROLES  = ['user', 'superuser', 'admin', 'superadmin']
const MAX_BAN_DAYS = 3650

export async function adminRoutes(fastify, { pool, io, usernameToSocket, JWT_SECRET, redis, GRID_SIZE, onRoleChanged }) {

  // POST /api/admin/login — retourne un JWT avec role:superadmin
  fastify.post('/api/admin/login', async (req, reply) => {
    // Ce mot de passe ouvre un JWT superadmin valable 7 jours : il doit être
    // au moins aussi protégé que /api/auth/login, et comparé à temps constant.
    const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown'
    if (!checkRateLimit(`admin:${ip}`, 5)) {
      return reply.status(429).send({ error: 'Trop de tentatives, réessayez dans 1 minute' })
    }
    const { password } = req.body || {}
    const expected = process.env.ADMIN_PASSWORD
    if (!expected || !constantTimeEqual(password, expected)) {
      return reply.status(401).send({ error: 'Mot de passe incorrect' })
    }
    const token = jwt.sign({ role: 'superadmin' }, JWT_SECRET, { expiresIn: '7d' })
    reply.send({ token, role: 'superadmin' })
  })

  // Implémentation partagée — voir features/auth/require-admin.js
  const requireAdmin = (req, reply, superAdminOnly = false) =>
    checkAdmin(req, reply, { jwtSecret: JWT_SECRET, superAdminOnly })

  // PATCH /api/admin/users/:username/role — changer le rôle (superadmin uniquement)
  fastify.patch('/api/admin/users/:username/role', async (req, reply) => {
    const moderator = requireAdmin(req, reply, true)
    if (!moderator) return

    const { username } = req.params
    const { role } = req.body || {}
    if (!VALID_ROLES.includes(role)) {
      return reply.status(400).send({ error: `Rôle invalide. Valeurs : ${VALID_ROLES.join(', ')}` })
    }

    const { rows, rowCount } = await pool.query(
      'UPDATE users SET role = $1 WHERE LOWER(username) = LOWER($2) RETURNING username',
      [role, username]
    )
    if (rowCount === 0) return reply.status(404).send({ error: 'Utilisateur introuvable' })

    // Accorder un rôle donne des pouvoirs : l'action doit laisser une trace
    await pool.query(
      `INSERT INTO moderation_logs (action, target, admin, metadata) VALUES ('role', $1, $2, $3)`,
      [rows[0].username, moderatorName(moderator), { role }]
    )

    // Le rôle fixe le cooldown et l'accès aux 16 couleurs : les caches du jeu
    // l'appliqueraient sinon jusqu'à deux minutes plus tard.
    onRoleChanged?.(username)
    logger.info(`[Admin] ${username} → role:${role}`)
    reply.send({ ok: true, username, role })
  })

  // Dashboard admin — stats globales + activité par plateforme
  // GET /api/admin/dashboard
  fastify.get('/api/admin/dashboard', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const [
      globalStats,
      platformStats,
      hourlyActivity,
      topPlayers,
      recentBans,
      pixelsToday,
      uniquePlayersToday,
      activeBans,
    ] = await Promise.all([

      // Stats globales
      pool.query(`
        SELECT
          COUNT(*)::int                     AS total_pixels,
          COUNT(DISTINCT username)::int     AS unique_players,
          COUNT(DISTINCT (x, y))::int       AS unique_cells,
          MAX(placed_at)                    AS last_activity,
          MIN(placed_at)                    AS first_activity
        FROM pixel_history
        WHERE username IS NOT NULL
      `),

      // Pixels par plateforme (tous les temps)
      pool.query(`
        SELECT source, COUNT(*)::int AS pixels
        FROM pixel_history
        WHERE source IS NOT NULL
        GROUP BY source
        ORDER BY pixels DESC
      `),

      // Activité par heure sur les dernières 24h
      pool.query(`
        SELECT
          date_trunc('hour', placed_at) AS hour,
          COUNT(*)::int                 AS pixels,
          COUNT(DISTINCT username)::int AS active_players
        FROM pixel_history
        WHERE placed_at > NOW() - INTERVAL '24 hours'
        GROUP BY hour
        ORDER BY hour ASC
      `),

      // Top 10 joueurs (tous les temps)
      pool.query(`
        SELECT username, COUNT(*)::int AS pixels, source
        FROM pixel_history
        WHERE username IS NOT NULL
        GROUP BY username, source
        ORDER BY pixels DESC
        LIMIT 10
      `),

      // 10 derniers bans
      pool.query(`
        SELECT username, reason, banned_by, banned_at, expires_at
        FROM bans
        ORDER BY banned_at DESC
        LIMIT 10
      `),

      // Pixels posés aujourd'hui
      pool.query(`
        SELECT COUNT(*)::int AS count
        FROM pixel_history
        WHERE placed_at >= CURRENT_DATE
      `),

      // Joueurs uniques actifs aujourd'hui
      pool.query(`
        SELECT COUNT(DISTINCT username)::int AS count
        FROM pixel_history
        WHERE placed_at >= CURRENT_DATE
          AND username IS NOT NULL
      `),

      // Bannissements en cours — le compteur valait jusqu'ici la longueur de
      // la liste des 10 derniers, donc jamais plus de 10
      pool.query(`
        SELECT COUNT(*)::int AS count FROM bans
        WHERE expires_at IS NULL OR expires_at > NOW()
      `),
    ])

    reply.send({
      global: {
        ...globalStats.rows[0],
        pixels_today:          pixelsToday.rows[0]?.count ?? 0,
        unique_players_today:  uniquePlayersToday.rows[0]?.count ?? 0,
        connected_now:         io.sockets.sockets.size,
        bans_total:            activeBans.rows[0]?.count ?? 0,
      },
      by_platform:    platformStats.rows,
      hourly_24h:     hourlyActivity.rows,
      top_players:    topPlayers.rows,
      recent_bans:    recentBans.rows,
    })
  })

  // Supprimer un pixel (REST) — log dans moderation_logs
  // POST /api/admin/pixel/clear  body: { x, y }
  fastify.post('/api/admin/pixel/clear', async (req, reply) => {
    const moderator = requireAdmin(req, reply)
    if (!moderator) return

    const { x, y } = req.body || {}
    // isValidCoord, pas un simple typeof : une coordonnée hors grille devient
    // un décalage arbitraire dans SETRANGE, et Redis agrandit le buffer
    // jusque-là — de quoi épuiser la mémoire depuis une seule requête.
    if (!isValidCoord(x) || !isValidCoord(y)) {
      return reply.status(400).send({ error: 'x et y doivent être des entiers dans la grille' })
    }

    const { previousOwner } = await clearPixelAsModerator({ redis, pool, io }, x, y, moderatorName(moderator))
    reply.send({ ok: true, x, y, previousOwner })
  })

  // Vider tout le canvas (REST) — superadmin uniquement
  // DELETE /api/admin/canvas
  fastify.delete('/api/admin/canvas', async (req, reply) => {
    const moderator = requireAdmin(req, reply, true)
    if (!moderator) return

    // Deux commandes Redis, pas GRID_SIZE² — voir clearGrid()
    const total = await clearGrid(redis)
    // Un seul signal : les clients redemandent la grille d'eux-mêmes
    io.emit('canvas:reload')

    await pool.query(
      `INSERT INTO moderation_logs (action, admin) VALUES ('clear_all', $1)`,
      [moderatorName(moderator)]
    )

    reply.send({ ok: true, cleared: total })
  })

  // Restaure le canvas Redis depuis pixel_history PostgreSQL
  // POST /api/admin/restore-canvas  (superadmin uniquement)
  fastify.post('/api/admin/restore-canvas', async (req, reply) => {
    const moderator = requireAdmin(req, reply, true)
    if (!moderator) return

    const { rows } = await pool.query(`
      SELECT DISTINCT ON (x, y) x, y, color_id AS "colorId", username, source, placed_at AS "placedAt"
      FROM pixel_history
      ORDER BY x, y, placed_at DESC
    `)

    // Construit le buffer complet (même approche que restore-canvas.js)
    const grid = Buffer.alloc(GRID_SIZE * GRID_SIZE, 0)
    const pipe = redis.pipeline()
    for (const row of rows) {
      const { x, y, colorId, username, source, placedAt } = row
      if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) continue
      grid[y * GRID_SIZE + x] = colorId & 0x0F
      pipe.hset('voxelplace:pixels', `${x},${y}`, JSON.stringify({ x, y, colorId, username, source, updatedAt: new Date(placedAt).getTime() }))
    }
    await redis.set('voxelplace:grid', grid)
    await pipe.exec()

    // Notifie tous les clients de recharger le canvas
    io.emit('canvas:reload')

    await pool.query(
      `INSERT INTO moderation_logs (action, admin, metadata) VALUES ('restore_canvas', $1, $2)`,
      [moderatorName(moderator), { restored: rows.length }]
    )
    logger.info(`[Admin] Canvas restauré depuis PostgreSQL — ${rows.length} pixels`)
    reply.send({ ok: true, restored: rows.length })
  })

  // Bannir un joueur
  // POST /api/admin/ban/:username
  // Body : { reason?, expires_in_days? }  — sans durée, le bannissement est définitif
  fastify.post('/api/admin/ban/:username', async (req, reply) => {
    const moderator = requireAdmin(req, reply)
    if (!moderator) return

    const requested = sanitizeUsername(String(req.params.username ?? ''))
    if (!requested) return reply.status(400).send({ error: 'Pseudo invalide' })

    const { reason, expires_in_days } = req.body || {}
    let expires_at = null
    if (expires_in_days !== undefined && expires_in_days !== null && expires_in_days !== '') {
      // parseInt laissait passer « abc » : NaN devenait une date invalide et
      // l'insertion échouait en 500, sans bannir personne.
      const days = Number(expires_in_days)
      if (!Number.isInteger(days) || days < 1 || days > MAX_BAN_DAYS) {
        return reply.status(400).send({ error: `Durée invalide : un nombre entier de jours entre 1 et ${MAX_BAN_DAYS}, ou rien pour un bannissement définitif` })
      }
      expires_at = new Date(Date.now() + days * 86400000)
    }
    const cleanReason = sanitizeMessage(reason, 256)
    const bannedBy    = moderatorName(moderator)

    // Pseudo canonique quand le compte existe : un bannissement de « alice »
    // doit apparaître sous « Alice », comme le reste de sa modération.
    const account  = await pool.query('SELECT username FROM users WHERE LOWER(username) = LOWER($1)', [requested])
    const username = account.rows[0]?.username ?? requested

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      // La clé primaire est sensible à la casse : un bannissement antérieur
      // sous une autre casse ferait doublon au lieu d'être remplacé.
      await client.query('DELETE FROM bans WHERE LOWER(username) = LOWER($1) AND username <> $1', [username])
      await client.query(
        `INSERT INTO bans (username, reason, banned_by, expires_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (username) DO UPDATE
           SET reason = $2, banned_by = $3, banned_at = NOW(), expires_at = $4`,
        [username, cleanReason, bannedBy, expires_at]
      )
      await client.query(
        `INSERT INTO moderation_logs (action, target, admin, reason, metadata)
         VALUES ('ban', $1, $2, $3, $4)`,
        [username, bannedBy, cleanReason, expires_at ? { expires_at } : null]
      )
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {})
      throw err
    } finally {
      client.release()
    }

    // Déconnecte le joueur s'il est connecté
    const socketId = usernameToSocket.get(username.toLowerCase())
    if (socketId) {
      io.to(socketId).emit('banned', { reason: cleanReason ?? 'Banni par un administrateur' })
      io.sockets.sockets.get(socketId)?.disconnect(true)
    }

    logger.info(`[Admin] ${username} banni par ${bannedBy}`)
    reply.status(201).send({ ok: true, username, expires_at })
  })

  // Débannir un joueur
  // DELETE /api/admin/ban/:username
  fastify.delete('/api/admin/ban/:username', async (req, reply) => {
    const moderator = requireAdmin(req, reply)
    if (!moderator) return

    const { username } = req.params
    // LOWER(...) comme à la vérification du ban : sans cela, bannir « Alice »
    // puis débannir « alice » renvoie 404 et laisse le joueur bloqué.
    const { rowCount } = await pool.query(
      'DELETE FROM bans WHERE LOWER(username) = LOWER($1)',
      [username]
    )

    if (rowCount === 0) return reply.status(404).send({ error: 'Joueur non banni' })

    await pool.query(
      `INSERT INTO moderation_logs (action, target, admin) VALUES ('unban', $1, $2)`,
      [username, moderatorName(moderator)]
    )

    logger.info(`[Admin] ${username} débanni`)
    reply.send({ ok: true, username })
  })

  // Liste des joueurs bannis
  // GET /api/admin/bans
  fastify.get('/api/admin/bans', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const { rows } = await pool.query(`
      SELECT *, (expires_at IS NULL OR expires_at > NOW()) AS active
      FROM bans ORDER BY banned_at DESC
    `)
    reply.send({ bans: rows })
  })

  // Recherche de comptes — sans critère, liste l'équipe (rôles au-dessus de user)
  // GET /api/admin/users?q=ali&limit=20
  fastify.get('/api/admin/users', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const q     = typeof req.query.q === 'string' ? sanitizeUsername(req.query.q) : ''
    const limit = parsePositiveInt(req.query.limit, 20, 100)
    // Les jokers de LIKE saisis tels quels (« % », « _ ») ne doivent rien élargir
    const pattern = q.replace(/[\\%_]/g, (c) => `\\${c}`) + '%'

    const { rows } = await pool.query(`
      SELECT u.username, u.role, u.created_at,
             (b.username IS NOT NULL) AS banned,
             b.reason     AS ban_reason,
             b.expires_at AS ban_expires_at
      FROM users u
      LEFT JOIN bans b ON LOWER(b.username) = LOWER(u.username)
        AND (b.expires_at IS NULL OR b.expires_at > NOW())
      WHERE ${q ? `LOWER(u.username) LIKE LOWER($1) ESCAPE '\\'` : `u.role <> 'user' AND $1::text IS NOT NULL`}
      ORDER BY ${q ? 'LENGTH(u.username), u.username' : 'u.role, u.username'}
      LIMIT $2
    `, [pattern, limit])
    reply.send({ users: rows })
  })

  // Logs de modération complets (admin) — inclut unban, clear_pixel, etc.
  // GET /api/admin/logs?limit=100&action=ban
  fastify.get('/api/admin/logs', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const limit  = parsePositiveInt(req.query.limit, 100, 500)
    const action = req.query.action ?? null
    const params = action ? [action, limit] : [limit]
    const where  = action ? `WHERE action = $1` : ''
    const limitP = action ? '$2' : '$1'

    const { rows } = await pool.query(
      `SELECT * FROM moderation_logs ${where} ORDER BY created_at DESC LIMIT ${limitP}`,
      params
    )
    reply.send({ logs: rows, total: rows.length })
  })

  // Logs publics — uniquement les bans, sans l'admin ni la raison interne
  // GET /api/moderation/logs?limit=50
  fastify.get('/api/moderation/logs', async (req, reply) => {
    const limit = parsePositiveInt(req.query.limit, 50, 200)

    const { rows } = await pool.query(
      `SELECT action, target, reason, created_at
       FROM moderation_logs
       WHERE action IN ('ban', 'unban')
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    )
    reply.send({ logs: rows })
  })

}
