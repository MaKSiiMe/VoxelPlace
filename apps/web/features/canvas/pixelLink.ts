import { toDisplayCoords, toGridCoords, type Point } from './coords'

// Lien direct vers un pixel : « /?x=-12&y=40 ». Les paramètres sont dans le
// repère affiché au joueur (celui des coordonnées du HUD), pour qu'un lien
// partagé désigne ce que chacun lit à l'écran.

/** URL relative qui ouvre la toile centrée sur un pixel de la grille. */
export function pixelLink(gx: number, gy: number, gridSize = 2048): string {
  const { x, y } = toDisplayCoords(gx, gy, gridSize)
  return `/?x=${x}&y=${y}`
}

/** Pixel de la grille désigné par une chaîne de requête, ou null. */
export function parsePixelLink(search: string, gridSize = 2048): Point | null {
  const params = new URLSearchParams(search)
  const rawX = params.get('x'), rawY = params.get('y')
  if (rawX === null || rawY === null || rawX.trim() === '' || rawY.trim() === '') return null
  const dx = Number(rawX), dy = Number(rawY)
  if (!Number.isInteger(dx) || !Number.isInteger(dy)) return null
  const grid = toGridCoords(dx, dy, gridSize)
  if (grid.x < 0 || grid.x >= gridSize || grid.y < 0 || grid.y >= gridSize) return null
  return grid
}
