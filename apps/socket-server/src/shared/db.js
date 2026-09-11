import pg from 'pg'
import { logger } from './logger.js'

const { Pool } = pg

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

pool.on('error', (err) => {
  logger.error({ err: err.message }, 'Erreur inattendue sur le pool PostgreSQL')
})

// Attend que PostgreSQL soit prêt (utile au démarrage du container)
export async function connectWithRetry(retries = 10, delayMs = 2000) {
  for (let i = 1; i <= retries; i++) {
    try {
      await pool.query('SELECT 1')
      logger.info('[DB] PostgreSQL connecté')
      return
    } catch (err) {
      logger.info(`[DB] Tentative ${i}/${retries} — ${err.message}`)
      if (i === retries) throw new Error('[DB] Impossible de se connecter à PostgreSQL')
      await new Promise(r => setTimeout(r, delayMs))
    }
  }
}
