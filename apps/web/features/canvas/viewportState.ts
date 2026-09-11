// État du viewport partagé entre usePixiCanvas et l'interface.
// Hors Zustand : il est mis à jour à chaque frame par le ticker Pixi, et ne
// doit déclencher aucun rendu React.

export const viewportState = {
  spriteX: 0,
  spriteY: 0,
  scale:   4,
  screenW: 0,
  screenH: 0,
}

export const MIN_SCALE = 0.25
export const MAX_SCALE = 64

export interface ViewportControls {
  /** Centre la vue sur un pixel de la grille. */
  navigate: (gx: number, gy: number) => void
  /** Zoome d'un facteur, autour du centre de l'écran. */
  zoomBy:   (factor: number) => void
  /** Revient à la vue d'origine. */
  recenter: () => void
}

let controls: ViewportControls | null = null

export function registerViewportControls(c: ViewportControls) { controls = c }
export function unregisterViewportControls()                   { controls = null }

export function navigateToPixel(gx: number, gy: number) { controls?.navigate(gx, gy) }
export function zoomBy(factor: number)                  { controls?.zoomBy(factor) }
export function recenterView()                          { controls?.recenter() }

/** Calcule la nouvelle échelle et la position qui gardent le point (px, py) fixe à l'écran. */
export function zoomAround(
  { x, y, scale }: { x: number; y: number; scale: number },
  factor: number,
  px: number,
  py: number,
) {
  const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * factor))
  // Le sprite a une échelle Y négative (axe Y inversé) : la coordonnée locale
  // sous le point se calcule dans chaque axe avec son propre signe.
  const lx = (px - x) / scale
  const ly = (y - py) / scale
  return { scale: next, x: px - lx * next, y: py + ly * next }
}
