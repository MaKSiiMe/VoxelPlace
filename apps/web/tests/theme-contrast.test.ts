import { describe, test, expect } from 'vitest'
import { BEZEL_COLOR, MUTED_TEXT, TEXT_COLOR, ACCENT_BLUE, ACCENT_GREEN, ACCENT_RED } from '../features/hud/theme'

// Ratio de contraste WCAG 2.x entre deux couleurs hexadécimales
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5]
    .map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('contraste des couleurs de premier plan sur les panneaux', () => {
  // Seuil WCAG 1.4.3 pour du texte courant : 4,5:1
  for (const [name, color] of Object.entries({ TEXT_COLOR, MUTED_TEXT, ACCENT_BLUE, ACCENT_GREEN, ACCENT_RED })) {
    test(`${name} est lisible sur BEZEL_COLOR`, () => {
      expect(contrast(color, BEZEL_COLOR)).toBeGreaterThanOrEqual(4.5)
    })
  }
})
