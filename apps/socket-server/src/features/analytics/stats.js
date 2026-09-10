// Compteurs de pixels par plateforme, tenus dans un hash Redis.
// Partagé par la route REST et par les émissions Socket.io.

export const STATS_KEY = 'voxelplace:stats:pixels'

export async function getStats(redis) {
  const raw = await redis.hgetall(STATS_KEY)
  if (!raw) return { total: 0, byPlatform: {} }
  const { total = '0', ...rest } = raw
  const byPlatform = Object.fromEntries(
    Object.entries(rest).map(([k, v]) => [k, parseInt(v, 10)])
  )
  return { total: parseInt(total, 10), byPlatform }
}

/** Incrémente le total et le compteur de la plateforme d'origine. */
export async function incrementStats(redis, source) {
  await redis.hincrby(STATS_KEY, source, 1)
  await redis.hincrby(STATS_KEY, 'total', 1)
}
