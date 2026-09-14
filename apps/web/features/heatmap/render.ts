// ── Rendu de la heatmap ──────────────────────────────────────────────────────
// Fonctions pures : le moteur Pixi ne fait que les appliquer.

/**
 * Dégradé séquentiel à une teinte (ambre), du discret à l'intense : l'intensité
 * se lit à la clarté et à l'opacité, sur un voile qui assombrit la toile.
 * Échelle logarithmique : une case très disputée écraserait sinon tout le reste.
 */
export function heatRGBA(counts: Uint16Array, max: number): Uint8Array {
  const rgba = new Uint8Array(counts.length * 4)
  if (max <= 0) return rgba
  const denom = Math.log1p(max)
  for (let i = 0; i < counts.length; i++) {
    const c = counts[i]
    if (c === 0) continue
    const t = Math.log1p(c) / denom            // ]0, 1]
    const o = i * 4
    rgba[o]     = 255
    rgba[o + 1] = Math.round(120 + 110 * t)    // ambre sombre → jaune clair
    rgba[o + 2] = Math.round(30 + 110 * t)
    rgba[o + 3] = Math.round(40 + 205 * t)     // jamais invisible, jamais opaque ; plancher bas pour des bords doux
  }
  return rgba
}

/** Échelle de 0 à 1 pour la légende. */
export const HEAT_GRADIENT = 'linear-gradient(to right, rgb(255 120 30 / .35), rgb(255 230 140 / .96))'

/**
 * Position et échelle du calque, recopiées du sprite de la grille à chaque image.
 * Une case de heatmap couvre `cell` pixels de grille : même origine, échelle
 * multipliée — y compris le signe négatif de l'axe Y, pour que la ligne de
 * cases n° k recouvre exactement les lignes de grille k × cell.
 */
export function heatOverlayTransform(grid: { x: number; y: number; scaleX: number; scaleY: number }, cell: number) {
  return { x: grid.x, y: grid.y, scaleX: grid.scaleX * cell, scaleY: grid.scaleY * cell }
}
