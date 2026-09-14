// ── Moteur d'unlocks ─────────────────────────────────────────────────────────
// Gère : streak en heures, compteurs de couleurs, stats joueur, unlocks auto/manuels
//
// Le pseudo reçu ici doit déjà être sous sa casse canonique — celle de la table
// users. user_stats, user_color_counts et user_unlocks sont indexées dessus :
// « Alice » et « alice » y ouvriraient deux progressions distinctes. La
// normalisation a lieu en amont, dans placePixel, à partir du pseudo du jeton.

import { TREE, BASE_COLOR_NODES } from './tree.js'

// ── Migration colonnes (idempotent, pour déploiements existants) ─────────────
// Les tables sont créées par init.sql. Ces ALTER TABLE ajoutent les colonnes
// streak sur une DB déjà initialisée avec l'ancien schéma.

export async function initUnlockTables(pool) {
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role            VARCHAR(20) NOT NULL DEFAULT 'user'`)
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_hours    INT         NOT NULL DEFAULT 0`)
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_pixel_hour TIMESTAMP`)
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_pixel_at   TIMESTAMP`)
}

// ── Unlock initial à la création du compte ───────────────────────────────────

export async function unlockBaseNodes(pool, username) {
  for (const nodeId of BASE_COLOR_NODES) {
    await pool.query(
      'INSERT INTO user_unlocks (username, node_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [username, nodeId]
    )
  }
}

// ── Streak ───────────────────────────────────────────────────────────────────

async function updateStreak(pool, username, now) {
  const hourTrunc = new Date(Math.floor(now.getTime() / 3600000) * 3600000)

  const { rows } = await pool.query(
    'SELECT streak_hours, last_pixel_hour, last_pixel_at FROM users WHERE LOWER(username) = LOWER($1)',
    [username]
  )
  if (!rows[0]) return

  const { streak_hours, last_pixel_hour, last_pixel_at } = rows[0]

  // Reset si 24h d'inactivité
  const sinceLastPixel = last_pixel_at ? now - new Date(last_pixel_at) : Infinity
  if (sinceLastPixel > 24 * 3600 * 1000) {
    await pool.query(
      `UPDATE users
       SET streak_hours = 0, last_pixel_hour = $1, last_pixel_at = $2
       WHERE LOWER(username) = LOWER($3)`,
      [hourTrunc, now, username]
    )
    return
  }

  // Nouvelle heure → +1
  const isNewHour = !last_pixel_hour ||
    new Date(last_pixel_hour).getTime() !== hourTrunc.getTime()

  if (isNewHour) {
    await pool.query(
      `UPDATE users
       SET streak_hours = streak_hours + 1, last_pixel_hour = $1, last_pixel_at = $2
       WHERE LOWER(username) = LOWER($3)`,
      [hourTrunc, now, username]
    )
  } else {
    await pool.query(
      'UPDATE users SET last_pixel_at = $1 WHERE LOWER(username) = LOWER($2)',
      [now, username]
    )
  }
}

// ── Traitement d'un pixel posé ───────────────────────────────────────────────

export async function processPixelPlaced(pool, username, colorId, x, y) {
  const now      = new Date()
  const zoneKey  = `${Math.floor(x / 64)}:${Math.floor(y / 64)}`
  const dayKey   = now.toISOString().slice(0, 10)

  await Promise.all([
    // Compteur de couleur
    pool.query(`
      INSERT INTO user_color_counts (username, color_id, count)
      VALUES ($1, $2, 1)
      ON CONFLICT (username, color_id) DO UPDATE
        SET count = user_color_counts.count + 1
    `, [username, colorId]),

    // Stats globales + zones + jours
    pool.query(`
      INSERT INTO user_stats (username, pixels_placed, zones_visited, days_played)
      VALUES ($1, 1, $2::jsonb, $3::jsonb)
      ON CONFLICT (username) DO UPDATE SET
        pixels_placed = user_stats.pixels_placed + 1,
        zones_visited = (
          SELECT jsonb_agg(DISTINCT v)
          FROM jsonb_array_elements_text(user_stats.zones_visited || $2::jsonb) v
        ),
        days_played = (
          SELECT jsonb_agg(DISTINCT v)
          FROM jsonb_array_elements_text(user_stats.days_played || $3::jsonb) v
        )
    `, [username, JSON.stringify([zoneKey]), JSON.stringify([dayKey])]),
  ])

  await updateStreak(pool, username, now)
}

// ── Pixel perdu (écrasé par quelqu'un d'autre) ───────────────────────────────

export async function processPixelLost(pool, username) {
  await pool.query(`
    INSERT INTO user_stats (username, pixels_lost)
    VALUES ($1, 1)
    ON CONFLICT (username) DO UPDATE
      SET pixels_lost = user_stats.pixels_lost + 1
  `, [username])
}

// ── Pixel écrasé (j'ai écrasé quelqu'un d'autre) ────────────────────────────

export async function processPixelOverwritten(pool, username) {
  await pool.query(`
    INSERT INTO user_stats (username, pixels_overwritten)
    VALUES ($1, 1)
    ON CONFLICT (username) DO UPDATE
      SET pixels_overwritten = user_stats.pixels_overwritten + 1
  `, [username])
}

// ── Lecture des unlocks ──────────────────────────────────────────────────────

export async function getUnlocks(pool, username) {
  const { rows } = await pool.query(
    'SELECT node_id FROM user_unlocks WHERE username = $1',
    [username]
  )
  return new Set(rows.map(r => r.node_id))
}

// ── Métriques du joueur ──────────────────────────────────────────────────────
// Tout ce que les conditions consultent, lu en deux requêtes. Chaque condition
// faisait auparavant sa propre requête : une vingtaine par pixel posé.

export async function loadPlayerMetrics(pool, username) {
  const [colors, stats] = await Promise.all([
    pool.query('SELECT color_id, count FROM user_color_counts WHERE username = $1', [username]),
    pool.query(
      `SELECT pixels_placed, pixels_lost, pixels_overwritten,
              jsonb_array_length(days_played)   AS days_played,
              jsonb_array_length(zones_visited) AS zones_visited
       FROM user_stats WHERE username = $1`,
      [username]
    ),
  ])
  const row = stats.rows[0] ?? {}

  let rank = null   // promesse, partagée par les conditions qui la demandent
  return {
    colorCounts:       new Map(colors.rows.map(r => [r.color_id, r.count])),
    pixelsPlaced:      row.pixels_placed      ?? 0,
    pixelsLost:        row.pixels_lost        ?? 0,
    pixelsOverwritten: row.pixels_overwritten ?? 0,
    daysPlayed:        row.days_played        ?? 0,
    zonesVisited:      row.zones_visited      ?? 0,
    // Le rang parcourt tout pixel_history : calculé seulement si une condition le demande
    rank: () => {
      rank ??= pool.query(`
        SELECT rank FROM (
          SELECT username, RANK() OVER (ORDER BY COUNT(*) DESC) AS rank
          FROM pixel_history WHERE username IS NOT NULL
          GROUP BY username
        ) r WHERE LOWER(username) = LOWER($1)
      `, [username]).then(({ rows }) => rows[0] ? Number(rows[0].rank) : null)
      return rank
    },
  }
}

// ── Évaluation des conditions ────────────────────────────────────────────────

const atLeast = (current, target) => ({ met: current >= target, current, target })

/**
 * Évalue une condition. Renvoie { met } et, pour les conditions chiffrées,
 * la progression { current, target } — affichée telle quelle dans l'arbre.
 */
export async function evaluateCondition(cond, metrics, unlocked, tree = TREE) {
  switch (cond.type) {
    case 'color_count':        return atLeast(metrics.colorCounts.get(cond.colorId) ?? 0, cond.min)
    case 'pixels_placed':      return atLeast(metrics.pixelsPlaced, cond.min)
    case 'pixels_lost':        return atLeast(metrics.pixelsLost, cond.min)
    case 'pixels_overwritten': return atLeast(metrics.pixelsOverwritten, cond.min)
    case 'days_played':        return atLeast(metrics.daysPlayed, cond.min)
    case 'zones_visited':      return atLeast(metrics.zonesVisited, cond.min)

    case 'color_unlocked':     return { met: unlocked.has(`color:${cond.colorId}`) }
    case 'feature_unlocked':   return { met: unlocked.has(cond.nodeId) }

    case 'rank_top': {
      const rank = await metrics.rank()
      return { met: rank !== null && rank <= cond.max, current: rank, target: cond.max }
    }

    case 'all_features_unlocked': {
      const features = Object.keys(tree)
        .filter(k => tree[k].type === 'feature' && k !== 'feature:profile')
      return atLeast(features.filter(n => unlocked.has(n)).length, features.length)
    }

    case 'color_each_unlocked': {
      // 1 pixel de chaque couleur actuellement débloquée
      const colorIds = [...unlocked]
        .filter(nodeId => nodeId.startsWith('color:'))
        .map(nodeId => parseInt(nodeId.split(':')[1], 10))
      const used = colorIds.filter(id => (metrics.colorCounts.get(id) ?? 0) >= 1).length
      return atLeast(used, colorIds.length)
    }

    case 'color_level4_any': {
      const level4 = Object.keys(tree).filter(k => tree[k].type === 'color' && tree[k].level === 4)
      return { met: level4.some(id => unlocked.has(id)) }
    }

    default:
      // Condition inconnue : jamais remplie, plutôt qu'offerte par erreur
      return { met: false }
  }
}

async function checkConditions(conditions, metrics, unlocked, tree) {
  for (const cond of conditions) {
    if (!(await evaluateCondition(cond, metrics, unlocked, tree)).met) return false
  }
  return true
}

// ── Unlock automatique des features (appelé après chaque pixel:place) ────────

export async function checkFeatureUnlocks(pool, username, tree = TREE) {
  const [unlocked, metrics] = await Promise.all([
    getUnlocks(pool, username),
    loadPlayerMetrics(pool, username),
  ])
  const newUnlocks = []

  for (const [nodeId, node] of Object.entries(tree)) {
    if (node.type !== 'feature')  continue
    if (node.comingSoon)          continue  // rien à offrir : pas de notification creuse
    if (unlocked.has(nodeId))     continue
    if (node.streakCost > 0)      continue  // débloqué manuellement

    const met = await checkConditions(node.conditions, metrics, unlocked, tree)
    if (met) {
      await pool.query(
        'INSERT INTO user_unlocks (username, node_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [username, nodeId]
      )
      unlocked.add(nodeId)
      newUnlocks.push({ nodeId, name: node.name })
    }
  }

  return newUnlocks
}

// ── Vérifier si un nœud est débloquable ──────────────────────────────────────

export async function canUnlockNode(pool, username, nodeId, tree = TREE) {
  const node = Object.hasOwn(tree, nodeId) ? tree[nodeId] : null
  if (!node) return { ok: false, error: 'Nœud inconnu' }
  if (node.comingSoon) return { ok: false, error: 'Bientôt disponible' }

  const unlocked = await getUnlocks(pool, username)
  if (unlocked.has(nodeId)) return { ok: false, error: 'Déjà débloqué' }

  const metrics  = await loadPlayerMetrics(pool, username)
  const condsMet = await checkConditions(node.conditions, metrics, unlocked, tree)
  if (!condsMet) return { ok: false, error: 'Conditions non remplies' }

  if (node.streakCost > 0) {
    const { rows } = await pool.query(
      'SELECT streak_hours FROM users WHERE LOWER(username) = LOWER($1)', [username]
    )
    const balance = rows[0]?.streak_hours ?? 0
    if (balance < node.streakCost) {
      return { ok: false, error: `Streak insuffisant (${balance}h / ${node.streakCost}h)` }
    }
  }

  return { ok: true }
}

// ── Débloquer un nœud (dépense le streak si besoin) ──────────────────────────

export async function unlockNode(pool, username, nodeId, tree = TREE) {
  const check = await canUnlockNode(pool, username, nodeId, tree)
  if (!check.ok) return check

  const node = tree[nodeId]

  if (node.streakCost > 0) {
    const { rowCount } = await pool.query(
      `UPDATE users
       SET streak_hours = streak_hours - $1
       WHERE LOWER(username) = LOWER($2) AND streak_hours >= $1`,
      [node.streakCost, username]
    )
    if (rowCount === 0) return { ok: false, error: 'Streak insuffisant' }
  }

  await pool.query(
    'INSERT INTO user_unlocks (username, node_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [username, nodeId]
  )

  return { ok: true, nodeId, name: node.name }
}
