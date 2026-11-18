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
// Les migrations tournent au démarrage de l'API, avant l'écoute, une seule fois
// chacune (table schema_migrations, voir shared/migrations.js). Elles doivent
// rester sans effet sur une base créée par init.sql : c'est vérifié en test.
//
// Une migration qui échoue est annulée en entier et l'API refuse de démarrer :
// mieux vaut un déploiement bloqué et visible qu'un schéma à moitié migré.

import { runOnce } from './migrations.js'
import { logger } from './logger.js'

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
        await client.query(`
          DELETE FROM bans b USING bans newer
          WHERE newer.username = b.username
            AND (COALESCE(newer.banned_at, '-infinity'), newer.id)
              > (COALESCE(b.banned_at,     '-infinity'), b.id);
          ALTER TABLE bans DROP CONSTRAINT IF EXISTS bans_pkey;
          ALTER TABLE bans DROP COLUMN id;
          ALTER TABLE bans ADD PRIMARY KEY (username);
        `)
      }
    },
  },
]

/** Applique, dans l'ordre, les migrations de schéma pas encore appliquées. */
export async function runSchemaMigrations(pool, migrations = SCHEMA_MIGRATIONS) {
  for (const { id, up } of migrations) {
    if (await runOnce(pool, id, up)) {
      logger.info({ migration: id }, '[DB] Migration de schéma appliquée')
    }
  }
}
