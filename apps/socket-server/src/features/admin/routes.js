// ── Feature : Admin ──────────────────────────────────────────────────────────
// POST /api/admin/login                   → JWT avec role superadmin
// PATCH /api/admin/users/:username/role   → changer le rôle d'un utilisateur (superadmin)
// GET  /api/admin/dashboard               → stats globales
// POST /api/admin/ban/:username           → bannir
// DELETE /api/admin/ban/:username         → débannir
// GET  /api/admin/bans                    → liste des bannis
// GET  /api/admin/logs                    → logs de modération
// GET  /api/moderation/logs               → logs publics
// POST /api/admin/pixel/clear             → remettre un pixel à blanc
// DELETE /api/admin/canvas                → vider le canvas (superadmin only)

import jwt from 'jsonwebtoken'

const ADMIN_ROLES = ['admin', 'superadmin']

export async function adminRoutes(fastify, { pool, io, usernameToSocket, JWT_SECRET, redis, setPixel, GRID_SIZE }) {

  // POST /api/admin/login — retourne un JWT avec role:superadmin
  fastify.post('/api/admin/login', async (req, reply) => {
    const { password } = req.body || {}
    const expected = process.env.ADMIN_PASSWORD
    if (!expected || password !== expected) {
      return reply.status(401).send({ error: 'Mot de passe incorrect' })
    }
    const token = jwt.sign({ role: 'superadmin' }, JWT_SECRET, { expiresIn: '7d' })
    reply.send({ token, role: 'superadmin' })
  })

  // Middleware — vérifie signature JWT + role admin/superadmin
  function requireAdmin(req, reply, requireSuperAdmin = false) {
    const auth = req.headers['authorization']
    if (!auth?.startsWith('Bearer ')) {
      reply.status(401).send({ error: 'Token requis' }); return null
    }
    try {
      const payload = jwt.verify(auth.slice(7), JWT_SECRET)
      const role = payload.role ?? ''
      if (requireSuperAdmin && role !== 'superadmin') {
        reply.status(403).send({ error: 'Accès réservé au superadmin' }); return null
      }
      if (!ADMIN_ROLES.includes(role)) {
        reply.status(403).send({ error: 'Accès refusé' }); return null
      }
      return payload
    } catch {
      reply.status(401).send({ error: 'Token invalide' }); return null
    }
  }

  // POST /api/admin/promote-hbtn — passe tous les hbtn_* en superuser (superadmin only)
  fastify.post('/api/admin/promote-hbtn', async (req, reply) => {
    if (!requireAdmin(req, reply, true)) return

    const { rowCount } = await pool.query(
      `UPDATE users SET role = 'superuser'
       WHERE LOWER(username) LIKE 'hbtn_%' AND role = 'user'`
    )
    console.log(`[Admin] ${rowCount} comptes hbtn_* promus superuser`)
    reply.send({ ok: true, promoted: rowCount })
  })

  // PATCH /api/admin/users/:username/role — changer le rôle (superadmin uniquement)
  fastify.patch('/api/admin/users/:username/role', async (req, reply) => {
    if (!requireAdmin(req, reply, true)) return

    const { username } = req.params
    const { role } = req.body || {}
    const VALID_ROLES = ['user', 'superuser', 'admin', 'superadmin']
    if (!VALID_ROLES.includes(role)) {
      return reply.status(400).send({ error: `Rôle invalide. Valeurs : ${VALID_ROLES.join(', ')}` })
    }

    const { rowCount } = await pool.query(
      'UPDATE users SET role = $1 WHERE LOWER(username) = LOWER($2)',
      [role, username]
    )
    if (rowCount === 0) return reply.status(404).send({ error: 'Utilisateur introuvable' })

    console.log(`[Admin] ${username} → role:${role}`)
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
    ])

    reply.send({
      global: {
        ...globalStats.rows[0],
        pixels_today:          pixelsToday.rows[0]?.count ?? 0,
        unique_players_today:  uniquePlayersToday.rows[0]?.count ?? 0,
        connected_now:         io.sockets.sockets.size,
        bans_total:            recentBans.rows.length,
      },
      by_platform:    platformStats.rows,
      hourly_24h:     hourlyActivity.rows,
      top_players:    topPlayers.rows,
      recent_bans:    recentBans.rows,
    })
  })

  // Supprimer un pixel (REST) — log dans moderation_logs
  // POST /api/admin/pixel/clear  body: { x, y, admin? }
  fastify.post('/api/admin/pixel/clear', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const { x, y, admin: adminName } = req.body || {}
    if (typeof x !== 'number' || typeof y !== 'number') {
      return reply.status(400).send({ error: 'x et y requis' })
    }

    const pixel = { x, y, colorId: 0, username: '[admin]', source: 'moderation' }
    await setPixel(redis, pixel)
    io.emit('pixel:update', pixel)

    await pool.query(
      `INSERT INTO moderation_logs (action, admin, metadata)
       VALUES ('clear_pixel', $1, $2)`,
      [adminName ?? '[admin]', { x, y }]
    )

    reply.send({ ok: true, x, y })
  })

  // Vider tout le canvas (REST) — superadmin uniquement
  // DELETE /api/admin/canvas
  fastify.delete('/api/admin/canvas', async (req, reply) => {
    if (!requireAdmin(req, reply, true)) return

    const admin = req.headers['x-admin-name'] ?? '[admin]'
    const total = GRID_SIZE * GRID_SIZE

    for (let i = 0; i < total; i++) {
      const x = i % GRID_SIZE
      const y = Math.floor(i / GRID_SIZE)
      const pixel = { x, y, colorId: 0, username: '[admin]', source: 'moderation' }
      await setPixel(redis, pixel)
      io.emit('pixel:update', pixel)
    }

    await pool.query(
      `INSERT INTO moderation_logs (action, admin) VALUES ('clear_all', $1)`,
      [admin]
    )

    reply.send({ ok: true, cleared: total })
  })

  // Restaure le canvas Redis depuis pixel_history PostgreSQL
  // POST /api/admin/restore-canvas  (superadmin uniquement)
  fastify.post('/api/admin/restore-canvas', async (req, reply) => {
    if (!requireAdmin(req, reply, true)) return

    const { rows } = await pool.query(`
      SELECT DISTINCT ON (x, y) x, y, color_id AS "colorId", username, source, placed_at AS "placedAt"
      FROM pixel_history
      ORDER BY x, y, placed_at DESC
    `)

    const pipe = redis.pipeline()
    for (const row of rows) {
      const { x, y, colorId, username, source, placedAt } = row
      if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) continue
      await redis.setrange('voxelplace:grid', y * GRID_SIZE + x, Buffer.from([colorId & 0x0F]))
      pipe.hset('voxelplace:pixels', `${x},${y}`, JSON.stringify({ x, y, colorId, username, source, updatedAt: new Date(placedAt).getTime() }))
    }
    await pipe.exec()

    // Notifie tous les clients de recharger le canvas
    io.emit('canvas:reload')

    console.log(`[Admin] Canvas restauré depuis PostgreSQL — ${rows.length} pixels`)
    reply.send({ ok: true, restored: rows.length })
  })

  // Bannir un joueur
  // POST /api/admin/ban/:username
  // Body : { reason?, expires_in_days? }
  fastify.post('/api/admin/ban/:username', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const { username } = req.params
    const { reason, expires_in_days, banned_by } = req.body || {}

    const expires_at = expires_in_days
      ? new Date(Date.now() + parseInt(expires_in_days, 10) * 86400000)
      : null

    await pool.query(
      `INSERT INTO bans (username, reason, banned_by, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (username) DO UPDATE
         SET reason = $2, banned_by = $3, banned_at = NOW(), expires_at = $4`,
      [username, reason ?? null, banned_by ?? '[admin]', expires_at]
    )

    await pool.query(
      `INSERT INTO moderation_logs (action, target, admin, reason, metadata)
       VALUES ('ban', $1, $2, $3, $4)`,
      [username, banned_by ?? '[admin]', reason ?? null, expires_at ? { expires_at } : null]
    )

    // Déconnecte le joueur s'il est connecté
    const socketId = usernameToSocket.get(username.toLowerCase())
    if (socketId) {
      io.to(socketId).emit('banned', { reason: reason ?? 'Banni par un administrateur' })
      io.sockets.sockets.get(socketId)?.disconnect(true)
    }

    console.log(`[Admin] ${username} banni`)
    reply.status(201).send({ ok: true, username, expires_at })
  })

  // Débannir un joueur
  // DELETE /api/admin/ban/:username
  fastify.delete('/api/admin/ban/:username', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const { username } = req.params
    const { rowCount } = await pool.query(
      'DELETE FROM bans WHERE username = $1',
      [username]
    )

    if (rowCount === 0) return reply.status(404).send({ error: 'Joueur non banni' })

    const admin = req.headers['x-admin-name'] ?? '[admin]'
    await pool.query(
      `INSERT INTO moderation_logs (action, target, admin) VALUES ('unban', $1, $2)`,
      [username, admin]
    )

    console.log(`[Admin] ${username} débanni`)
    reply.send({ ok: true, username })
  })

  // Liste des joueurs bannis
  // GET /api/admin/bans
  fastify.get('/api/admin/bans', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const { rows } = await pool.query(
      'SELECT * FROM bans ORDER BY banned_at DESC'
    )
    reply.send({ bans: rows })
  })

  // Logs de modération complets (admin) — inclut unban, clear_pixel, etc.
  // GET /api/admin/logs?limit=100&action=ban
  fastify.get('/api/admin/logs', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const limit  = Math.min(parseInt(req.query.limit ?? '100', 10), 500)
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
    const limit = Math.min(parseInt(req.query.limit ?? '50', 10), 200)

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
