// Module-level viewport state partagé entre usePixiCanvas et Minimap
// Pas de Zustand — mis à jour à chaque frame par le ticker Pixi sans déclencher de re-renders

export const viewportState = {
  spriteX: 0,
  spriteY: 0,
  scale:   4,
  screenW: 0,
  screenH: 0,
}

type NavigateFn = (gx: number, gy: number) => void
let _navigateFn: NavigateFn | null = null

export function registerNavigate(fn: NavigateFn)   { _navigateFn = fn }
export function unregisterNavigate()                { _navigateFn = null }
export function navigateToPixel(gx: number, gy: number) { _navigateFn?.(gx, gy) }
