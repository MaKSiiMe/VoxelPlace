import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

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
      // Requête préparée — protège contre les injections SQL
      const result = await pool.query(
        'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at',
        [clean, passwordHash]
      )
      const user = result.rows[0]
      const token = signToken({ id: user.id, username: user.username }, jwtSecret)
      reply.status(201).send({ token, username: user.username })
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
        'SELECT id, username, password_hash FROM users WHERE LOWER(username) = LOWER($1)',
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
      const token = signToken({ id: user.id, username: user.username }, jwtSecret)
      reply.send({ token, username: user.username })
    } catch (err) {
      console.error('[auth:login]', err)
      reply.status(500).send({ error: 'Erreur serveur' })
    }
  })
}
