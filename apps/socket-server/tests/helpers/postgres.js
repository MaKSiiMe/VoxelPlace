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
import { randomBytes } from 'node:crypto'
import { createServer } from 'node:net'
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const INIT_SQL = fileURLToPath(new URL('../../db/init.sql', import.meta.url))

/** Demande au système un port TCP libre sur la boucle locale. */
function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })
}

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
    // node:test exécute les fichiers en parallèle, chacun dans son process.
    // Sur un serveur partagé, ils se videraient mutuellement leurs tables via
    // truncateAll : chaque fichier reçoit donc sa propre base.
    const dbName = `vp_test_${randomBytes(6).toString('hex')}`
    const admin  = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL })
    await admin.query(`CREATE DATABASE ${dbName}`)
    await admin.end()

    const url = new URL(process.env.TEST_DATABASE_URL)
    url.pathname = `/${dbName}`
    const pool = new pg.Pool({ connectionString: url.toString() })
    await pool.query(schema)

    return {
      pool,
      skipped: false,
      cleanup: async () => {
        await pool.end()
        const cleaner = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL })
        await cleaner.query(`DROP DATABASE IF EXISTS ${dbName}`)
        await cleaner.end()
      },
    }
  }

  const bin = findPostgresBin()
  if (!bin) return { pool: null, skipped: true, cleanup: async () => {} }

  // Chemin court : les sockets Unix PostgreSQL sont limités à 107 octets. On
  // les désactive et on passe par TCP, mais le répertoire de données reste
  // court par prudence.
  const dataDir = mkdtempSync(join(tmpdir(), 'vp-pg-'))
  const user    = 'voxelplace'

  run(join(bin, 'initdb'), ['-D', dataDir, '-U', user, '--auth=trust', '-E', 'UTF8'], 'initdb')

  // Le port était tiré au hasard : les fichiers de test démarrant leur cluster
  // en parallèle, deux d'entre eux tombaient parfois sur le même. Le second
  // échouait à démarrer et tous ses tests étaient annulés — rapportés comme
  // « cancelled », pas comme « fail », ce qui rendait l'incident facile à
  // manquer. On demande désormais un port libre au système, et on réessaie
  // avec un autre si un processus s'en empare entre-temps.
  let port
  for (let attempt = 1; ; attempt++) {
    port = await findFreePort()
    try {
      run(join(bin, 'pg_ctl'), [
        '-D', dataDir,
        '-o', `-p ${port} -c listen_addresses=127.0.0.1 -c unix_socket_directories='' -c fsync=off`,
        '-l', join(dataDir, 'server.log'),
        '-w', 'start',
      ], 'pg_ctl start')
      break
    } catch (err) {
      if (attempt >= 3) throw err
    }
  }

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

/**
 * Attend que le pool n'ait plus aucune requête en vol.
 *
 * Le code de production écrit volontairement sans `await` — l'insertion dans
 * pixel_history ne doit pas retarder l'affichage du pixel. En test, une de ces
 * écritures peut atterrir *après* le TRUNCATE du test suivant et y laisser une
 * ligne fantôme : de quoi faire échouer, de loin en loin, un test qui vérifie
 * qu'une table est vide.
 */
async function waitForIdlePool(pool, timeout = 10_000) {
  // waitingCount compte aussi les requêtes en file, qui n'ont pas encore
  // obtenu de connexion : elles écriront plus tard, elles aussi.
  const busy = () => pool.totalCount - pool.idleCount + pool.waitingCount > 0
  const deadline = Date.now() + timeout
  while (busy()) {
    if (Date.now() > deadline) {
      // Tronquer malgré tout produirait un échec lointain et trompeur dans un
      // autre test. Mieux vaut échouer ici, là où se trouve la vraie cause.
      throw new Error(`le pool PostgreSQL ne s'est pas vidé en ${timeout} ms`)
    }
    await new Promise(r => setTimeout(r, 5))
  }
  // Un tour de boucle supplémentaire : une requête peut avoir été rendue au
  // pool sans que sa promesse ait encore été résolue.
  await new Promise(r => setImmediate(r))
}

/** Vide toutes les tables entre deux tests, sans retoucher au schéma. */
export async function truncateAll(pool) {
  await waitForIdlePool(pool)
  await pool.query(`
    TRUNCATE users, pixel_history, shared_zones, bans, moderation_logs,
             reports, user_stats, user_color_counts, user_unlocks, pixel_messages
    RESTART IDENTITY CASCADE
  `)
}
