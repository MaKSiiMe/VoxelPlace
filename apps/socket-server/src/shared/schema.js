// ── Migrations de schéma ─────────────────────────────────────────────────────
// init.sql décrit le schéma d'une base neuve, mais PostgreSQL ne l'exécute qu'à
// la création du volume. Une base existante ne voit donc jamais une colonne ou
// une contrainte ajoutée ensuite : le code l'attend, la base l'ignore, et la
// route tombe en 500 (« column "status" does not exist » sur la file des
// signalements, en novembre 2026).
//
// Chaque évolution du schéma s'écrit donc deux fois :
//   1. dans init.sql, pour les bases neuves ;
//   2. ici, en migration, pour les bases existantes.
// Les migrations tournent au démarrage de l'API, avant l'écoute. Garanties :
//   - une seule fois chacune : la table schema_migrations les enregistre ;
//   - une transaction par migration, enregistrement compris : PostgreSQL annule
//     aussi le DDL, donc un échec ne laisse ni demi-schéma ni migration notée ;
//   - un démarrage à la fois : un verrou consultatif de session
//     (pg_advisory_lock) fait attendre une seconde instance jusqu'à ce que la
//     première ait fini. Le verrou tombe avec la connexion si le process meurt.
// Elles doivent rester sans effet sur une base créée par init.sql : c'est
// vérifié en test, et la CI part d'une base vide.
//
// Une migration qui échoue est annulée en entier et l'API refuse de démarrer :
// mieux vaut un déploiement bloqué et visible qu'un schéma à moitié migré.

import { ensureMigrationsTable } from './migrations.js'
import { logger } from './logger.js'

const LOCK_NAME = 'voxelplace:schema-migrations'

export class SchemaMigrationError extends Error {}

/** Type d'une colonne, tel que PostgreSQL le nomme (information_schema). */
async function columnType(client, table, column) {
  const { rows } = await client.query(`
    SELECT data_type FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = $1 AND column_name = $2
  `, [table, column])
  return rows[0]?.data_type
}

/**
 * timestamptz → timestamp, en heure UTC. Le code écrit NOW() dans des colonnes
 * TIMESTAMP : la valeur stockée est l'heure UTC (fuseau de la base). On garde
 * cette convention, sans dépendre du fuseau de la session qui migre. Une
 * colonne déjà en timestamp n'est pas touchée.
 */
async function toUtcTimestamp(client, table, column) {
  if (await columnType(client, table, column) !== 'timestamp with time zone') return
  await client.query(
    `ALTER TABLE ${table} ALTER COLUMN ${column} TYPE TIMESTAMP USING ${column} AT TIME ZONE 'UTC'`
  )
}

/** Nombre de lignes de `table` qui vérifient `condition`. */
async function countWhere(client, table, condition) {
  const { rows } = await client.query(`SELECT count(*)::int AS n FROM ${table} WHERE ${condition}`)
  return rows[0].n
}

export const SCHEMA_MIGRATIONS = [
  {
    // Bases créées avant le schéma actuel de la modération (prod jusqu'en
    // novembre 2026) : reports sans statut, bans indexée sur un id.
    id: '2026-11-align-moderation-schema',
    async up(client) {
      // Signalements : statut de traitement et signalements anonymes
      await client.query(`
        ALTER TABLE reports ADD COLUMN IF NOT EXISTS status      VARCHAR(10) NOT NULL DEFAULT 'pending';
        ALTER TABLE reports ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(32);
        ALTER TABLE reports ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;
        ALTER TABLE reports ALTER COLUMN reporter DROP NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_reports_status ON reports (status);
        CREATE INDEX IF NOT EXISTS idx_pixel_messages_xy ON pixel_messages (x, y);
      `)

      // Bannissements : la route fait ON CONFLICT (username), qui exige une
      // contrainte unique sur username. Les anciennes bases avaient une clé
      // primaire sur un id. Un doublon exact serait remplacé par la route :
      // on garde de même le bannissement le plus récent.
      const { rowCount: legacyBans } = await client.query(`
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'bans' AND column_name = 'id'
      `)
      if (legacyBans > 0) {
        // Traitement explicite des doublons, journalisé ligne par ligne : la
        // nouvelle clé primaire les refuserait et la migration échouerait.
        const { rows: dropped } = await client.query(`
          DELETE FROM bans b USING bans newer
          WHERE newer.username = b.username
            AND (COALESCE(newer.banned_at, '-infinity'), newer.id)
              > (COALESCE(b.banned_at,     '-infinity'), b.id)
          RETURNING b.username, b.reason, b.banned_by, b.banned_at, b.expires_at
        `)
        for (const ban of dropped) {
          logger.warn({ ban }, '[DB] Bannissement en doublon supprimé (le plus récent est conservé)')
        }
        await client.query(`
          ALTER TABLE bans DROP CONSTRAINT IF EXISTS bans_pkey;
          ALTER TABLE bans DROP COLUMN id;
          ALTER TABLE bans ADD PRIMARY KEY (username);
        `)
      }
    },
  },
  {
    // Les quatre autres tables créées par l'ancien schéma : text au lieu de
    // varchar(n), timestamptz au lieu de timestamp, NOT NULL manquants. Rien
    // n'y cassait, mais la prod était le seul schéma que les tests ne voyaient
    // pas, et un compteur NULL avale ses incréments en silence (NULL + 1).
    id: '2026-11-align-remaining-tables',
    async up(client) {
      // 1. Données qu'aucune règle sûre ne peut corriger : on refuse, avec le
      //    décompte, plutôt que de tronquer un pseudo ou d'inventer une date.
      const blocking = {
        'moderation_logs : action NULL ou > 16 caractères':  ['moderation_logs', 'action IS NULL OR length(action) > 16'],
        'moderation_logs : target > 32 caractères':          ['moderation_logs', 'length(target) > 32'],
        'moderation_logs : admin NULL ou > 32 caractères':   ['moderation_logs', 'admin IS NULL OR length(admin) > 32'],
        'moderation_logs : reason > 256 caractères':         ['moderation_logs', 'length(reason) > 256'],
        'moderation_logs : created_at NULL':                 ['moderation_logs', 'created_at IS NULL'],
        'user_stats : username > 32 caractères':             ['user_stats',        'length(username) > 32'],
        'user_color_counts : username > 32 caractères':      ['user_color_counts', 'length(username) > 32'],
        'user_color_counts : color_id hors smallint':        ['user_color_counts', 'color_id NOT BETWEEN -32768 AND 32767'],
        'user_unlocks : username > 32 caractères':           ['user_unlocks', 'length(username) > 32'],
        'user_unlocks : node_id > 64 caractères':            ['user_unlocks', 'length(node_id) > 64'],
        'user_unlocks : unlocked_at NULL':                   ['user_unlocks', 'unlocked_at IS NULL'],
      }
      const problems = []
      for (const [label, [table, condition]] of Object.entries(blocking)) {
        const n = await countWhere(client, table, condition)
        if (n > 0) problems.push(`${label} (${n} ligne${n > 1 ? 's' : ''})`)
      }
      if (problems.length > 0) {
        throw new Error(`données incompatibles avec init.sql, à corriger à la main : ${problems.join(' ; ')}`)
      }

      // 2. NULL qui a un sens évident : un compteur absent vaut 0, une liste
      //    absente est vide (ce sont les valeurs par défaut des colonnes).
      const filled = await client.query(`
        UPDATE user_stats SET
          pixels_placed      = COALESCE(pixels_placed, 0),
          pixels_lost        = COALESCE(pixels_lost, 0),
          pixels_overwritten = COALESCE(pixels_overwritten, 0),
          zones_visited      = COALESCE(zones_visited, '[]'),
          days_played        = COALESCE(days_played, '[]')
        WHERE pixels_placed IS NULL OR pixels_lost IS NULL OR pixels_overwritten IS NULL
           OR zones_visited IS NULL OR days_played IS NULL
      `)
      const counts = await client.query('UPDATE user_color_counts SET count = 0 WHERE count IS NULL')
      if (filled.rowCount + counts.rowCount > 0) {
        logger.warn({ user_stats: filled.rowCount, user_color_counts: counts.rowCount },
          '[DB] Compteurs NULL remis à leur valeur par défaut (0 ou [])')
      }

      // 3. Types et contraintes d'init.sql. Sur une base créée par init.sql,
      //    chaque instruction est sans effet.
      await toUtcTimestamp(client, 'moderation_logs', 'created_at')
      await toUtcTimestamp(client, 'user_unlocks', 'unlocked_at')
      await client.query(`
        ALTER TABLE moderation_logs
          ALTER COLUMN action     TYPE VARCHAR(16),
          ALTER COLUMN target     TYPE VARCHAR(32),
          ALTER COLUMN admin      TYPE VARCHAR(32),
          ALTER COLUMN admin      SET NOT NULL,
          ALTER COLUMN reason     TYPE VARCHAR(256),
          ALTER COLUMN created_at SET DEFAULT NOW(),
          ALTER COLUMN created_at SET NOT NULL;
        ALTER TABLE user_stats
          ALTER COLUMN username           TYPE VARCHAR(32),
          ALTER COLUMN pixels_placed      SET NOT NULL,
          ALTER COLUMN pixels_lost        SET NOT NULL,
          ALTER COLUMN pixels_overwritten SET NOT NULL,
          ALTER COLUMN zones_visited      SET NOT NULL,
          ALTER COLUMN days_played        SET NOT NULL;
        ALTER TABLE user_color_counts
          ALTER COLUMN username TYPE VARCHAR(32),
          ALTER COLUMN color_id TYPE SMALLINT,
          ALTER COLUMN count    SET NOT NULL;
        ALTER TABLE user_unlocks
          ALTER COLUMN username    TYPE VARCHAR(32),
          ALTER COLUMN node_id     TYPE VARCHAR(64),
          ALTER COLUMN unlocked_at SET DEFAULT NOW(),
          ALTER COLUMN unlocked_at SET NOT NULL;
      `)
    },
  },
]

/**
 * Applique, dans l'ordre, les migrations de schéma pas encore appliquées.
 * S'arrête à la première qui échoue et lève une SchemaMigrationError : les
 * suivantes dépendent peut-être d'elle.
 */
export async function runSchemaMigrations(pool, migrations = SCHEMA_MIGRATIONS) {
  // Une seule connexion pour tout : le verrou consultatif appartient à la session
  const client = await pool.connect()
  let broken = false
  try {
    await client.query('SELECT pg_advisory_lock(hashtext($1))', [LOCK_NAME])
    await ensureMigrationsTable(client)

    for (const { id, up } of migrations) {
      const done = await client.query('SELECT 1 FROM schema_migrations WHERE id = $1', [id])
      if (done.rowCount > 0) continue

      try {
        await client.query('BEGIN')
        await up(client)
        await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [id])
        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK').catch(() => { broken = true })
        const message = `Migration de schéma « ${id} » en échec, annulée : base inchangée, API arrêtée. Cause : ${err.message}`
        logger.fatal({ migration: id, err }, `[DB] ${message}`)
        throw new SchemaMigrationError(message, { cause: err })
      }
      logger.info({ migration: id }, '[DB] Migration de schéma appliquée')
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(hashtext($1))', [LOCK_NAME]).catch(() => { broken = true })
    // Connexion douteuse : on la détruit plutôt que de la rendre au pool
    client.release(broken)
  }
}
