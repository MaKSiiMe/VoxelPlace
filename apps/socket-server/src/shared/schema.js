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
