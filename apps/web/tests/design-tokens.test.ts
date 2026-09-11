// Vérifie les contrastes directement dans le CSS du design system, pour
// qu'aucune modification d'un token ne fasse repasser un texte sous le seuil.

import { describe, test, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const css = readFileSync(resolve(__dirname, '../../../packages/styles/src/globals.css'), 'utf8')

function token(name: string): string {
  const m = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css)
  if (!m) throw new Error(`token --color-${name} introuvable`)
  return m[1]
}

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5]
    .map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('contrastes du design system (WCAG 1.4.3 : 4,5:1)', () => {
  const surfaces   = ['bg', 'surface', 'surface-2']
  const foregrounds = ['fg', 'fg-muted', 'fg-subtle', 'accent', 'success', 'danger', 'warning']

  for (const fg of foregrounds) {
    for (const bg of surfaces) {
      test(`${fg} sur ${bg}`, () => {
        expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5)
      })
    }
  }

  for (const accent of ['accent', 'danger', 'success']) {
    test(`on-accent sur ${accent}`, () => {
      expect(contrast(token('on-accent'), token(accent))).toBeGreaterThanOrEqual(4.5)
    })
  }
})

describe('polices', () => {
  test('les polices viennent du paquet geist, embarqué — pas d\'un CDN au build', () => {
    const layout = readFileSync(resolve(__dirname, '../app/layout.tsx'), 'utf8')
    expect(layout).toMatch(/from 'geist\/font\/sans'/)
    expect(layout).not.toMatch(/next\/font\/google/)
  })

  test('le zoom du navigateur n\'est pas bloqué (WCAG 1.4.4)', () => {
    const layout = readFileSync(resolve(__dirname, '../app/layout.tsx'), 'utf8')
    expect(layout).not.toMatch(/userScalable:\s*false/)
    expect(layout).not.toMatch(/maximumScale:\s*1\b/)
  })
})
