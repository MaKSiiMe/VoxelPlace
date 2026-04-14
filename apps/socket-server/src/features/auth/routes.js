import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { unlockBaseNodes } from '../unlocks/engine.js'

const SALT_ROUNDS = 10

// ── Fonctions pures (testables) ──────────────────────────────────────────────

export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash)
}

export function signToken(payload, secret) {
  return jwt.sign(payload, secret, { expiresIn: '7d' })
}

export function verifyToken(token, secret) {
  try {
    return jwt.verify(token, secret)
  } catch {
    return null
  }
}

// ── Plugin Fastify ────────────────────────────────────────────────────────────
// Utilise PostgreSQL (pool pg) pour la persistance des comptes utilisateurs.
// Redis reste exclusivement réservé à la grille de pixels et au temps réel.

export async function authRoutes(fastify, { pool, jwtSecret }) {
  // POST /api/auth/register
  fastify.post('/api/auth/register', async (req, reply) => {
    const { username, password } = req.body || {}
    if (!username || typeof username !== 'string' || !password || typeof password !== 'string') {
      return reply.status(400).send({ error: 'username et password requis' })
    }
    const clean = username.trim()
    if (clean.length < 2 || clean.length > 32) {
      return reply.status(400).send({ error: 'Pseudo : 2 à 32 caractères' })
    }
    if (password.length < 6) {
      return reply.status(400).send({ error: 'Mot de passe : 6 caractères minimum' })
    }

    try {
      const passwordHash = await hashPassword(password)
      // Les pseudos hbtn_* sont automatiquement superuser (beta testeurs)
      const role = clean.toLowerCase().startsWith('hbtn_') ? 'superuser' : 'user'
      const result = await pool.query(
        'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role, created_at',
        [clean, passwordHash, role]
      )
      const user = result.rows[0]
      // Non-bloquant — ne doit pas empêcher la connexion si la table n'existe pas encore
      unlockBaseNodes(pool, user.username).catch(err => console.warn('[auth:register] unlockBaseNodes:', err.message))
      const token = signToken({ id: user.id, username: user.username, role: user.role }, jwtSecret)
      reply.status(201).send({ token, username: user.username, role: user.role })
    } catch (err) {
      // Code 23505 = violation de contrainte UNIQUE (username déjà pris)
      if (err.code === '23505') {
        return reply.status(409).send({ error: 'Pseudo déjà utilisé' })
      }
      console.error('[auth:register]', err)
      reply.status(500).send({ error: 'Erreur serveur' })
    }
  })

  // POST /api/auth/login
  fastify.post('/api/auth/login', async (req, reply) => {
    const { username, password } = req.body || {}
    if (!username || !password) {
      return reply.status(400).send({ error: 'username et password requis' })
    }

    try {
      // Requête préparée — insensible à la casse sur le username
      const result = await pool.query(
        'SELECT id, username, role, password_hash FROM users WHERE LOWER(username) = LOWER($1)',
        [username.trim()]
      )
      const user = result.rows[0]
      if (!user) {
        return reply.status(401).send({ error: 'Identifiants incorrects' })
      }
      const valid = await verifyPassword(password, user.password_hash)
      if (!valid) {
        return reply.status(401).send({ error: 'Identifiants incorrects' })
      }

      // Promotion automatique hbtn_* → superuser (si créé avant la règle)
      if (user.username.toLowerCase().startsWith('hbtn_') && user.role === 'user') {
        await pool.query('UPDATE users SET role = $1 WHERE id = $2', ['superuser', user.id])
        user.role = 'superuser'
      }

      const token = signToken({ id: user.id, username: user.username, role: user.role }, jwtSecret)
      reply.send({ token, username: user.username, role: user.role })
    } catch (err) {
      console.error('[auth:login]', err)
      reply.status(500).send({ error: 'Erreur serveur' })
    }
  })

  // DELETE /api/auth/account — droit à l'effacement (RGPD)
  // Supprime le compte et toutes les données personnelles du joueur.
  // Le mot de passe est requis pour confirmer l'intention.
  fastify.delete('/api/auth/account', async (req, reply) => {
    const auth = req.headers['authorization']
    if (!auth?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Token requis' })
    }

    const payload = verifyToken(auth.slice(7), jwtSecret)
    if (!payload) {
      return reply.status(401).send({ error: 'Token invalide' })
    }

    const { password } = req.body || {}
    if (!password) {
      return reply.status(400).send({ error: 'Mot de passe requis pour confirmer la suppression' })
    }

    try {
      const result = await pool.query(
        'SELECT id, username, password_hash FROM users WHERE id = $1',
        [payload.id]
      )
      const user = result.rows[0]
      if (!user) {
        return reply.status(404).send({ error: 'Compte introuvable' })
      }

      const valid = await verifyPassword(password, user.password_hash)
      if (!valid) {
        return reply.status(401).send({ error: 'Mot de passe incorrect' })
      }

      // Suppression en cascade de toutes les données personnelles
      await pool.query('DELETE FROM user_unlocks    WHERE LOWER(username) = LOWER($1)', [user.username])
      await pool.query('DELETE FROM user_stats      WHERE LOWER(username) = LOWER($1)', [user.username])
      await pool.query('DELETE FROM user_color_counts WHERE LOWER(username) = LOWER($1)', [user.username])
      await pool.query('DELETE FROM pixel_messages  WHERE LOWER(username) = LOWER($1)', [user.username])
      await pool.query('DELETE FROM reports         WHERE LOWER(reporter)  = LOWER($1)', [user.username])
      await pool.query('DELETE FROM users           WHERE id = $1', [payload.id])

      // Note : pixel_history est conservé (données anonymisées — intérêt légitime gameplay)
      // Les pixels posés restent sur le canvas mais sans lien au compte supprimé.

      reply.send({ ok: true, message: 'Compte et données personnelles supprimés' })
    } catch (err) {
      console.error('[auth:delete-account]', err)
      reply.status(500).send({ error: 'Erreur serveur' })
    }
  })
}
