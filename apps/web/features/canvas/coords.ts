// ── Repères de coordonnées ───────────────────────────────────────────────────
//
// Le serveur indexe la grille depuis le coin haut-gauche : (0, 0) … (2047, 2047),
// y croissant vers le bas. Le HUD affiche un repère centré sur le milieu du
// canvas, y croissant vers le haut. Tout texte montré au joueur doit utiliser
// le repère du HUD, sinon une notification désignerait un autre pixel que
// celui qu'il voit sous son curseur.
//
// Ce repère est l'invariant le plus fragile du projet côté rendu : plusieurs
// commits de l'historique en corrigent le calcul. Le garder en un seul endroit.

export interface Point { x: number; y: number }

/** Coordonnées de grille (serveur) → coordonnées affichées au joueur. */
export function toDisplayCoords(gx: number, gy: number, gridSize = 2048): Point {
  const half = gridSize / 2
  return { x: gx - half, y: half - gy }
}

/** Coordonnées affichées au joueur → coordonnées de grille (serveur). */
export function toGridCoords(dx: number, dy: number, gridSize = 2048): Point {
  const half = gridSize / 2
  return { x: dx + half, y: half - dy }
}

/** Libellé court, identique à celui de la notch : « X: -12  Y: 40 ». */
export function formatDisplayCoords(gx: number, gy: number, gridSize = 2048): string {
  const { x, y } = toDisplayCoords(gx, gy, gridSize)
  return `X: ${x}  Y: ${y}`
}
