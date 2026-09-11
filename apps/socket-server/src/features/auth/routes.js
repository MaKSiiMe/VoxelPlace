import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { unlockBaseNodes } from '../unlocks/engine.js'
import { checkRateLimit } from './rate-limit.js'
import { anonymizePixelOwner } from '../canvas/grid.js'
import { logger } from '../../shared/logger.js'

const SALT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS ?? '10', 10)

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

function checkCsrf(req, reply) {
  if (req.headers['x-requested-with'] !== 'XMLHttpRequest') {
    reply.status(403).send({ error: 'Requête non autorisée (CSRF)' })
    return false
  }
  return true
}

export async function authRoutes(fastify, { pool, redis, jwtSecret, onAccountDeleted }) {
  // POST /api/auth/register
  fastify.post('/api/auth/register', async (req, reply) => {
    if (!checkCsrf(req, reply)) return
    const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown'
    if (!checkRateLimit(ip)) {
      return reply.status(429).send({ error: 'Trop de tentatives, réessayez dans 1 minute' })
    }
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
      const SUPERUSER_PREFIXES = ['hbtn_', 'tm_', 'pt_']
      const isSuperuser = SUPERUSER_PREFIXES.some(p => clean.toLowerCase().startsWith(p))
      const role = isSuperuser ? 'superuser' : 'user'
      const result = await pool.query(
        'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role, created_at',
        [clean, passwordHash, role]
      )
      const user = result.rows[0]
      // Attendu, et non lancé en arrière-plan : ces INSERT continuaient sinon
      // après la réponse HTTP et pouvaient réinsérer des lignes user_unlocks
      // *après* une suppression de compte RGPD, laissant des données orphelines.
      // Le try/catch préserve l'intention d'origine : un échec ici ne doit pas
      // empêcher l'inscription d'aboutir.
      try {
        await unlockBaseNodes(pool, user.username)
      } catch (err) {
        logger.warn({ err: err.message }, 'auth:register — unlockBaseNodes')
      }
      const token = signToken({ id: user.id, username: user.username, role: user.role }, jwtSecret)
      reply.status(201).send({ token, username: user.username, role: user.role })
    } catch (err) {
      // Code 23505 = violation de contrainte UNIQUE (username déjà pris)
      if (err.code === '23505') {
        return reply.status(409).send({ error: 'Pseudo déjà utilisé' })
      }
      logger.error({ err: err }, 'auth:register')
      reply.status(500).send({ error: 'Erreur serveur' })
    }
  })

  // POST /api/auth/login
  fastify.post('/api/auth/login', async (req, reply) => {
    if (!checkCsrf(req, reply)) return
    const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown'
    if (!checkRateLimit(ip)) {
      return reply.status(429).send({ error: 'Trop de tentatives, réessayez dans 1 minute' })
    }
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

      // Promotion automatique hbtn_* / tm_* / pt_* → superuser (si créé avant la règle)
      const SUPERUSER_PREFIXES = ['hbtn_', 'tm_', 'pt_']
      const shouldPromote = SUPERUSER_PREFIXES.some(p => user.username.toLowerCase().startsWith(p))
      if (shouldPromote && user.role === 'user') {
        await pool.query('UPDATE users SET role = $1 WHERE id = $2', ['superuser', user.id])
        user.role = 'superuser'
      }

      const token = signToken({ id: user.id, username: user.username, role: user.role }, jwtSecret)
      reply.send({ token, username: user.username, role: user.role })
    } catch (err) {
      logger.error({ err: err }, 'auth:login')
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

      // Suppression en cascade, dans une transaction : le droit à l'effacement
      // doit être tout ou rien. En six requêtes indépendantes, une panne en
      // cours de route laissait un compte à demi supprimé, donc des données
      // personnelles subsistantes.
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query('DELETE FROM user_unlocks      WHERE LOWER(username) = LOWER($1)', [user.username])
        await client.query('DELETE FROM user_stats        WHERE LOWER(username) = LOWER($1)', [user.username])
        await client.query('DELETE FROM user_color_counts WHERE LOWER(username) = LOWER($1)', [user.username])
        await client.query('DELETE FROM pixel_messages    WHERE LOWER(username) = LOWER($1)', [user.username])
        await client.query('DELETE FROM reports           WHERE LOWER(reporter) = LOWER($1)', [user.username])
        // Les pixels restent sur le canvas, mais sans auteur. Ils conservaient
        // jusqu'ici le pseudo : le compte supprimé restait premier du
        // classement public, avec rang, nombre de pixels et dates d'activité.
        await client.query('UPDATE pixel_history SET username = NULL WHERE LOWER(username) = LOWER($1)', [user.username])
        await client.query('UPDATE shared_zones  SET created_by = NULL WHERE LOWER(created_by) = LOWER($1)', [user.username])
        await client.query('DELETE FROM users             WHERE id = $1', [payload.id])
        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
      }

      // Même chose côté Redis, où chaque pixel porte le pseudo de son auteur
      // (survol, /api/pixel/:x/:y). Hors transaction : PostgreSQL fait foi
      // pour le compte. Un échec ici est journalisé avec le pseudo, pour
      // qu'un administrateur puisse relancer anonymizePixelOwner, idempotente.
      if (redis) {
        try {
          await anonymizePixelOwner(redis, user.username)
        } catch (err) {
          logger.error({ err: err.message, username: user.username }, 'auth:delete-account — anonymisation Redis incomplète')
        }
      }

      // Révocation côté temps réel : cache de rôle, socket ouvert
      onAccountDeleted?.(user.username)

      reply.send({ ok: true, message: 'Compte et données personnelles supprimés' })
    } catch (err) {
      logger.error({ err: err }, 'auth:delete-account')
      reply.status(500).send({ error: 'Erreur serveur' })
    }
  })
}
