// ── Moteur d'unlocks ─────────────────────────────────────────────────────────
// Gère : streak en heures, compteurs de couleurs, stats joueur, unlocks auto/manuels

import { TREE, BASE_COLOR_NODES, BASE_FEATURE_NODES } from './tree.js'

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
  const nodes = [...BASE_COLOR_NODES, ...BASE_FEATURE_NODES]
  for (const nodeId of nodes) {
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

// ── Vérification des conditions ──────────────────────────────────────────────

async function checkConditions(pool, username, conditions, unlocked) {
  for (const cond of conditions) {
    switch (cond.type) {

      case 'color_count': {
        const { rows } = await pool.query(
          'SELECT count FROM user_color_counts WHERE username = $1 AND color_id = $2',
          [username, cond.colorId]
        )
        if (!rows[0] || rows[0].count < cond.min) return false
        break
      }

      case 'color_unlocked':
        if (!unlocked.has(`color:${cond.colorId}`)) return false
        break

      case 'feature_unlocked':
        if (!unlocked.has(cond.nodeId)) return false
        break

      case 'pixels_placed': {
        const { rows } = await pool.query(
          'SELECT pixels_placed FROM user_stats WHERE username = $1', [username]
        )
        if (!rows[0] || rows[0].pixels_placed < cond.min) return false
        break
      }

      case 'pixels_lost': {
        const { rows } = await pool.query(
          'SELECT pixels_lost FROM user_stats WHERE username = $1', [username]
        )
        if (!rows[0] || rows[0].pixels_lost < cond.min) return false
        break
      }

      case 'pixels_overwritten': {
        const { rows } = await pool.query(
          'SELECT pixels_overwritten FROM user_stats WHERE username = $1', [username]
        )
        if (!rows[0] || rows[0].pixels_overwritten < cond.min) return false
        break
      }

      case 'days_played': {
        const { rows } = await pool.query(
          `SELECT jsonb_array_length(days_played) AS count
           FROM user_stats WHERE username = $1`, [username]
        )
        if (!rows[0] || rows[0].count < cond.min) return false
        break
      }

      case 'zones_visited': {
        const { rows } = await pool.query(
          `SELECT jsonb_array_length(zones_visited) AS count
           FROM user_stats WHERE username = $1`, [username]
        )
        if (!rows[0] || rows[0].count < cond.min) return false
        break
      }

      case 'rank_top': {
        const { rows } = await pool.query(`
          SELECT rank FROM (
            SELECT username, RANK() OVER (ORDER BY COUNT(*) DESC) AS rank
            FROM pixel_history WHERE username IS NOT NULL
            GROUP BY username
          ) r WHERE LOWER(username) = LOWER($1)
        `, [username])
        if (!rows[0] || rows[0].rank > cond.max) return false
        break
      }

      case 'all_features_unlocked': {
        const featureNodes = Object.keys(TREE)
          .filter(k => TREE[k].type === 'feature' && k !== 'feature:profile')
        if (!featureNodes.every(n => unlocked.has(n))) return false
        break
      }

      case 'color_each_unlocked': {
        // 1px de chaque couleur actuellement débloquée
        for (const nodeId of unlocked) {
          if (!nodeId.startsWith('color:')) continue
          const colorId = parseInt(nodeId.split(':')[1])
          const { rows } = await pool.query(
            'SELECT count FROM user_color_counts WHERE username = $1 AND color_id = $2',
            [username, colorId]
          )
          if (!rows[0] || rows[0].count < 1) return false
        }
        break
      }

      case 'color_level4_any': {
        const level4Ids = Object.values(TREE)
          .filter(n => n.type === 'color' && n.level === 4)
          .map(n => `color:${n.colorId}`)
        if (!level4Ids.some(id => unlocked.has(id))) return false
        break
      }
    }
  }
  return true
}

// ── Unlock automatique des features (appelé après chaque pixel:place) ────────

export async function checkFeatureUnlocks(pool, username) {
  const unlocked   = await getUnlocks(pool, username)
  const newUnlocks = []

  for (const [nodeId, node] of Object.entries(TREE)) {
    if (node.type !== 'feature')  continue
    if (unlocked.has(nodeId))     continue
    if (node.streakCost > 0)      continue  // débloqué manuellement

    const met = await checkConditions(pool, username, node.conditions, unlocked)
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

export async function canUnlockNode(pool, username, nodeId) {
  const node = TREE[nodeId]
  if (!node) return { ok: false, error: 'Nœud inconnu' }

  const unlocked = await getUnlocks(pool, username)
  if (unlocked.has(nodeId)) return { ok: false, error: 'Déjà débloqué' }

  const condsMet = await checkConditions(pool, username, node.conditions, unlocked)
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

export async function unlockNode(pool, username, nodeId) {
  const check = await canUnlockNode(pool, username, nodeId)
  if (!check.ok) return check

  const node = TREE[nodeId]

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
