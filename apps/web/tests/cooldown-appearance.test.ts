import { describe, test, expect } from 'vitest'
import { cooldownAppearance, IDLE_APPEARANCE } from '../features/hud/cooldownAppearance'
import { ACCENT_RED, ACCENT_GREEN, BORDER_COLOR } from '../features/hud/theme'

const rgb = (hex: string) =>
  `rgb(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)})`

describe('cooldownAppearance', () => {
  test('reste au repos sans cooldown', () => {
    expect(cooldownAppearance(1000, null, 0)).toEqual(IDLE_APPEARANCE)
    expect(IDLE_APPEARANCE.color).toBe(BORDER_COLOR)
  })

  test('commence rouge au tout début du cooldown', () => {
    const look = cooldownAppearance(0, 60_000, 60_000)
    expect(look.color).toBe(rgb(ACCENT_RED))
    expect(look.blur).toBe(4)
    expect(look.active).toBe(true)
  })

  test('tend vers le vert à mesure que le cooldown s\'écoule', () => {
    const look = cooldownAppearance(59_999, 60_000, 60_000)
    expect(look.color).toBe(rgb(ACCENT_GREEN))
    expect(look.blur).toBeGreaterThan(11.9)
  })

  test('passe par une couleur intermédiaire à mi-parcours', () => {
    const look = cooldownAppearance(30_000, 60_000, 60_000)
    expect(look.color).not.toBe(rgb(ACCENT_RED))
    expect(look.color).not.toBe(rgb(ACCENT_GREEN))
    expect(look.blur).toBe(8)
  })

  test('revient au repos et arrête l\'animation une fois le cooldown écoulé', () => {
    // active: false est ce qui interrompt la boucle requestAnimationFrame :
    // sans lui, elle tournerait indéfiniment comme avant.
    const look = cooldownAppearance(60_001, 60_000, 60_000)
    expect(look).toEqual(IDLE_APPEARANCE)
    expect(look.active).toBe(false)
  })

  test('ignore une durée nulle ou négative', () => {
    expect(cooldownAppearance(0, 1000, 0)).toEqual(IDLE_APPEARANCE)
    expect(cooldownAppearance(0, 1000, -5)).toEqual(IDLE_APPEARANCE)
  })

  test('borne la progression même si l\'horloge est incohérente', () => {
    // Fin de cooldown bien au-delà de la durée annoncée : la progression ne
    // doit pas devenir négative ni produire une couleur hors gamme.
    const look = cooldownAppearance(0, 1_000_000, 60_000)
    expect(look.color).toBe(rgb(ACCENT_RED))
    expect(look.blur).toBe(4)
  })
})
