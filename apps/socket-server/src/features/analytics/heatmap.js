// ── Heatmap : densité des poses ──────────────────────────────────────────────
// La route renvoyait une ligne JSON par case jamais touchée, sans limite : sa
// taille croissait avec l'historique (5,7 Mo pour 200 000 poses). Les poses
// sont désormais regroupées en cases de HEATMAP_CELL pixels : la réponse a
// une taille fixe, quel que soit l'historique.

import { GRID_SIZE } from '../canvas/grid.js'

export const HEATMAP_CELL = 8
export const HEATMAP_SIZE = GRID_SIZE / HEATMAP_CELL   // 256 × 256 cases

/**
 * Lignes { bx, by, count } → compteurs par case, bornés à 65 535.
 * @returns {{ counts: Uint16Array, max: number, total: number }}
 */
export function binHeatmap(rows) {
  const counts = new Uint16Array(HEATMAP_SIZE * HEATMAP_SIZE)
  let max = 0, total = 0
  for (const { bx, by, count } of rows) {
    if (bx < 0 || bx >= HEATMAP_SIZE || by < 0 || by >= HEATMAP_SIZE) continue
    const n = Math.min(Number(count), 65535)
    counts[by * HEATMAP_SIZE + bx] = n
    if (n > max) max = n
    total += Number(count)
  }
  return { counts, max, total }
}

/** Tableau d'octets petit-boutiste, indépendant de l'architecture du serveur. */
export function encodeCounts(counts) {
  const buf = Buffer.alloc(counts.length * 2)
  for (let i = 0; i < counts.length; i++) buf.writeUInt16LE(counts[i], i * 2)
  return buf.toString('base64')
}
