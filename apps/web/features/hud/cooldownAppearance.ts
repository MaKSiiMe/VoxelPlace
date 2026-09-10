import { ACCENT_RED, ACCENT_GREEN, BORDER_COLOR } from './theme'

function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
}

const RED   = hexToRgb(ACCENT_RED)
const GREEN = hexToRgb(ACCENT_GREEN)

export const IDLE_APPEARANCE = { color: BORDER_COLOR, blur: 2, active: false } as const

export interface CooldownAppearance {
  color:  string
  blur:   number
  /** Le cooldown est-il encore en cours ? Sert à arrêter la boucle d'animation. */
  active: boolean
}

/**
 * Apparence de la bordure du HUD à un instant donné : elle passe du rouge au
 * vert à mesure que le cooldown s'écoule, et son halo s'élargit.
 *
 * Fonction pure, sans React : l'animation écrit directement dans le SVG pour
 * ne pas re-rendre tout le HUD à chaque frame.
 */
export function cooldownAppearance(
  now: number,
  cooldownEnd: number | null,
  cooldownDuration: number,
): CooldownAppearance {
  if (!cooldownEnd || cooldownDuration <= 0) return IDLE_APPEARANCE

  const remaining = cooldownEnd - now
  if (remaining <= 0) return IDLE_APPEARANCE

  const p = Math.min(1, Math.max(0, 1 - remaining / cooldownDuration))
  const [r, g, b] = RED.map((c, i) => Math.round(c * (1 - p) + GREEN[i] * p))
  return { color: `rgb(${r},${g},${b})`, blur: 4 + p * 8, active: true }
}
