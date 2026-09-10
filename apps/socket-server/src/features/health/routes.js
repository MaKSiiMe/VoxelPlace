// ── Feature : Santé ──────────────────────────────────────────────────────────
// GET /health → distingue « process vivant » de « dépendances joignables ».
// Cible du HEALTHCHECK Docker : une API qui répond mais dont Redis est tombé
// doit être signalée comme dégradée, pas comme saine.

export async function healthRoutes(fastify, { redis, pool }) {
  fastify.get('/health', async (_req, reply) => {
    const [redisCheck, pgCheck] = await Promise.allSettled([
      redis.ping(),
      pool.query('SELECT 1'),
    ])
    const deps = {
      redis:    redisCheck.status === 'fulfilled' ? 'ok' : 'down',
      postgres: pgCheck.status    === 'fulfilled' ? 'ok' : 'down',
    }
    const healthy = Object.values(deps).every(v => v === 'ok')
    reply.status(healthy ? 200 : 503).send({
      status:   healthy ? 'ok' : 'degraded',
      uptime_s: Math.round(process.uptime()),
      deps,
    })
  })
}
