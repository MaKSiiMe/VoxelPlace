import pg from 'pg'

const { Pool } = pg

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

pool.on('error', (err) => {
  console.error('[DB] Erreur inattendue sur le pool PostgreSQL :', err.message)
})

// Attend que PostgreSQL soit prêt (utile au démarrage du container)
export async function connectWithRetry(retries = 10, delayMs = 2000) {
  for (let i = 1; i <= retries; i++) {
    try {
      await pool.query('SELECT 1')
      console.log('[DB] PostgreSQL connecté')
      return
    } catch (err) {
      console.log(`[DB] Tentative ${i}/${retries} — ${err.message}`)
      if (i === retries) throw new Error('[DB] Impossible de se connecter à PostgreSQL')
      await new Promise(r => setTimeout(r, delayMs))
    }
  }
}
