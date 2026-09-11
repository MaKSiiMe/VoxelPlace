// ── Intention d'un clic sur le canvas ────────────────────────────────────────
//
// Le clic gauche sert à deux choses selon le mode (DESIGN.md) :
//   · mode Build (une couleur est sélectionnée) → poser un pixel
//   · mode Exploration (aucune couleur)          → inspecter le pixel
//
// Il ne doit rien faire pendant un déplacement de la vue : barre d'espace
// maintenue, ou glissement de la souris entre l'appui et le relâchement.

/** Au-delà de ce déplacement entre appui et relâchement, c'est un glissement, pas un clic. */
export const CLICK_TOLERANCE_PX = 4

interface Pointer {
  button:    number
  spaceHeld: boolean
  inBounds:  boolean
}

/**
 * La pose a lieu à l'appui, pour que le pixel apparaisse sans délai.
 *
 * La barre d'espace n'était pas vérifiée : commencer un déplacement de la vue
 * à l'espace en mode Build posait un pixel au point de départ.
 */
export function shouldPlace({ button, spaceHeld, inBounds, selectedColor }: Pointer & { selectedColor: number | null }) {
  return button === 0 && !spaceHeld && inBounds && selectedColor !== null
}

/**
 * L'inspection a lieu au relâchement, pour pouvoir écarter un glissement.
 * `selectedColorAtDown` est la couleur au moment de l'appui : un clic qui a
 * posé un pixel ne doit pas ouvrir l'inspecteur en plus.
 */
export function shouldInspect({ button, spaceHeld, inBounds, movedPx, selectedColorAtDown }:
  Pointer & { movedPx: number; selectedColorAtDown: number | null }) {
  return button === 0 && !spaceHeld && inBounds
      && selectedColorAtDown === null && movedPx <= CLICK_TOLERANCE_PX
}
