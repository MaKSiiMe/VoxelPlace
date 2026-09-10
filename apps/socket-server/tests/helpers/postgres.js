// ── PostgreSQL de test ───────────────────────────────────────────────────────
// Deux modes, dans cet ordre :
//
// 1. TEST_DATABASE_URL est défini → on l'utilise (service container en CI).
// 2. Sinon, on démarre un cluster PostgreSQL temporaire avec les binaires
//    locaux. Aucun privilège root n'est nécessaire : initdb et pg_ctl
//    fonctionnent en tant qu'utilisateur ordinaire.
//
// Le but est de tester sur un vrai PostgreSQL, à la même version qu'en
// production. Un émulateur en mémoire ne sait pas exécuter les requêtes
// analytiques du projet (fenêtrage LAG, date_trunc, INTERVAL) : il ferait
// échouer des tests pour des raisons qui n'existent pas en production.

import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const INIT_SQL = fileURLToPath(new URL('../../db/init.sql', import.meta.url))

/** Localise un répertoire bin PostgreSQL contenant initdb et pg_ctl. */
function findPostgresBin() {
  const candidates = []
  const versionsDir = '/usr/lib/postgresql'
  if (existsSync(versionsDir)) {
    // Version la plus élevée d'abord
    for (const v of readdirSync(versionsDir).sort((a, b) => parseInt(b) - parseInt(a))) {
      candidates.push(join(versionsDir, v, 'bin'))
    }
  }
  candidates.push('/usr/local/pgsql/bin', '/usr/bin', '/opt/homebrew/bin')
  return candidates.find(dir => existsSync(join(dir, 'initdb')) && existsSync(join(dir, 'pg_ctl'))) ?? null
}

function run(bin, args, label) {
  const res = spawnSync(bin, args, { encoding: 'utf8' })
  if (res.status !== 0) {
    throw new Error(`${label} a échoué (code ${res.status}) :\n${res.stderr || res.stdout}`)
  }
  return res
}

/**
 * Démarre une base de test et retourne { pool, cleanup, skipped }.
 *
 * `skipped: true` signale qu'aucun PostgreSQL n'est disponible — les tests
 * doivent alors se déclarer ignorés plutôt que d'échouer, pour que la suite
 * reste exécutable sur une machine sans PostgreSQL installé.
 */
export async function startTestDatabase() {
  const schema = readFileSync(INIT_SQL, 'utf8')

  if (process.env.TEST_DATABASE_URL) {
    const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL })
    await pool.query(schema)
    return { pool, skipped: false, cleanup: async () => { await pool.end() } }
  }

  const bin = findPostgresBin()
  if (!bin) return { pool: null, skipped: true, cleanup: async () => {} }

  // Chemin court : les sockets Unix PostgreSQL sont limités à 107 octets. On
  // les désactive et on passe par TCP, mais le répertoire de données reste
  // court par prudence.
  const dataDir = mkdtempSync(join(tmpdir(), 'vp-pg-'))
  const port    = 50000 + Math.floor(Math.random() * 10000)
  const user    = 'voxelplace'

  run(join(bin, 'initdb'), ['-D', dataDir, '-U', user, '--auth=trust', '-E', 'UTF8'], 'initdb')
  run(join(bin, 'pg_ctl'), [
    '-D', dataDir,
    '-o', `-p ${port} -c listen_addresses=127.0.0.1 -c unix_socket_directories='' -c fsync=off`,
    '-l', join(dataDir, 'server.log'),
    '-w', 'start',
  ], 'pg_ctl start')

  const url  = `postgresql://${user}@127.0.0.1:${port}/postgres`
  const pool = new pg.Pool({ connectionString: url })
  await pool.query(schema)

  return {
    pool,
    skipped: false,
    cleanup: async () => {
      await pool.end()
      try { run(join(bin, 'pg_ctl'), ['-D', dataDir, '-m', 'immediate', '-w', 'stop'], 'pg_ctl stop') } catch { /* déjà arrêté */ }
      rmSync(dataDir, { recursive: true, force: true })
    },
  }
}

/** Vide toutes les tables entre deux tests, sans retoucher au schéma. */
export async function truncateAll(pool) {
  await pool.query(`
    TRUNCATE users, pixel_history, shared_zones, bans, moderation_logs,
             reports, user_stats, user_color_counts, user_unlocks, pixel_messages
    RESTART IDENTITY CASCADE
  `)
}
