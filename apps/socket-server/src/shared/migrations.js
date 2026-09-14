// ── Migrations de données à exécution unique ─────────────────────────────────
// init.sql décrit le schéma, mais ne s'exécute qu'à la création du volume
// PostgreSQL. Une transformation des données existantes (accorder des droits
// d'après l'historique, par exemple) doit donc tourner au démarrage de l'API,
// et une seule fois : rejouée à chaque redémarrage, elle continuerait
// d'accorder ce qu'elle ne devait accorder qu'à la date de son déploiement.

export async function ensureMigrationsTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id         VARCHAR(100) PRIMARY KEY,
      applied_at TIMESTAMP    NOT NULL DEFAULT NOW()
    )
  `)
}

/**
 * Exécute `migrate(client)` si la migration `id` n'a jamais été appliquée.
 *
 * L'identifiant est inséré dans la même transaction que la migration : deux
 * instances démarrées ensemble ne l'appliquent pas deux fois (la seconde
 * attend le verrou de la clé primaire, puis constate le conflit), et une
 * migration qui échoue n'est pas marquée comme faite.
 *
 * @returns {Promise<boolean>} true si la migration vient d'être appliquée
 */
export async function runOnce(pool, id, migrate) {
  await ensureMigrationsTable(pool)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rowCount } = await client.query(
      'INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING', [id]
    )
    if (rowCount === 0) {
      await client.query('ROLLBACK')
      return false
    }
    await migrate(client)
    await client.query('COMMIT')
    return true
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}
