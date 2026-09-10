// La palette 16 couleurs existe en trois exemplaires : backend (source de
// vérité), frontend et plugin Minecraft. Rien ne les relie à la compilation :
// modifier l'une sans les autres désynchronise silencieusement le rendu entre
// le web et Minecraft — un joueur pose du rouge et voit apparaître du bleu.
//
// Ces tests lisent les trois fichiers et vérifient qu'ils s'accordent.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { PALETTE_HEX, PALETTE_RGB } from '../src/shared/palette.js'

const ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const read = (p) => readFileSync(join(ROOT, p), 'utf8')

/** Extrait les couleurs hexadécimales d'un tableau JS/TS nommé. */
function extractHexArray(source, arrayName) {
  const start = source.indexOf(arrayName)
  assert.notEqual(start, -1, `tableau ${arrayName} introuvable`)
  const body = source.slice(start, source.indexOf(']', start))
  return [...body.matchAll(/'(#[0-9A-Fa-f]{6})'/g)].map(m => m[1].toUpperCase())
}

describe('palette — source de vérité', () => {
  it('compte exactement 16 couleurs', () => {
    assert.equal(PALETTE_HEX.length, 16, 'la palette doit rester à 16 couleurs')
  })

  it("n'a pas de doublon", () => {
    assert.equal(new Set(PALETTE_HEX).size, 16)
  })

  it('expose des composantes RGB cohérentes avec l\'hexadécimal', () => {
    assert.equal(PALETTE_RGB.length, 16)
    // Blanc = 255,255,255 · noir = 0,0,0
    assert.deepEqual(PALETTE_RGB[0], [255, 255, 255])
    assert.deepEqual(PALETTE_RGB[3], [0, 0, 0])
    for (const [r, g, b] of PALETTE_RGB) {
      for (const c of [r, g, b]) {
        assert.ok(Number.isInteger(c) && c >= 0 && c <= 255)
      }
    }
  })
})

describe('palette — frontend', () => {
  it('DEFAULT_COLORS reprend la palette du backend, couleur par couleur', () => {
    const front = extractHexArray(read('apps/web/features/canvas/store.ts'), 'DEFAULT_COLORS')
    assert.equal(front.length, 16, 'le front doit déclarer 16 couleurs')
    assert.deepEqual(
      front,
      PALETTE_HEX.map(c => c.toUpperCase()),
      'le front et le backend ne rendent pas les mêmes couleurs'
    )
  })
})

describe('palette — plugin Minecraft', () => {
  const java = read('apps/game-bridges/minecraft/src/main/java/fr/voxelplace/minecraft/CanvasManager.java')

  // Correspondance officielle entre l'index de palette et le bloc de béton
  const EXPECTED_BLOCKS = [
    'WHITE', 'LIGHT_GRAY', 'GRAY', 'BLACK', 'BROWN', 'RED', 'ORANGE', 'YELLOW',
    'LIME', 'GREEN', 'CYAN', 'LIGHT_BLUE', 'BLUE', 'PURPLE', 'MAGENTA', 'PINK',
  ]

  it('associe 16 blocs de béton, dans l\'ordre de la palette', () => {
    const declared = [...java.matchAll(/Material\.(\w+)_CONCRETE,\s*\/\/\s*(\d+)/g)]
      .map(m => ({ block: m[1], index: parseInt(m[2], 10) }))

    assert.equal(declared.length, 16, 'le plugin doit déclarer 16 blocs')
    declared.forEach(({ block, index }, i) => {
      assert.equal(index, i, `le commentaire d'index est décalé à la position ${i}`)
      assert.equal(block, EXPECTED_BLOCKS[i],
        `couleur ${i} : le plugin utilise ${block}, la palette attend ${EXPECTED_BLOCKS[i]}`)
    })
  })

  it('accepte béton et laine pour chaque couleur, avec le même identifiant', () => {
    const mappings = [...java.matchAll(/MATERIAL_TO_COLOR\.put\(Material\.(\w+?)_(CONCRETE|WOOL),\s*(\d+)\)/g)]

    const byColor = new Map()
    for (const [, block, , id] of mappings) {
      const index = parseInt(id, 10)
      if (!byColor.has(index)) byColor.set(index, new Set())
      byColor.get(index).add(block)
    }

    assert.equal(byColor.size, 16, 'les 16 couleurs doivent être reconnues en entrée')
    for (const [index, blocks] of byColor) {
      assert.ok(
        blocks.has(EXPECTED_BLOCKS[index]),
        `couleur ${index} : attendu ${EXPECTED_BLOCKS[index]}, trouvé ${[...blocks].join(', ')}`
      )
    }
  })

  it('couvre exactement les identifiants 0 à 15, sans trou ni débordement', () => {
    const ids = new Set(
      [...java.matchAll(/MATERIAL_TO_COLOR\.put\(Material\.\w+,\s*(\d+)\)/g)]
        .map(m => parseInt(m[1], 10))
    )
    for (let i = 0; i < 16; i++) {
      assert.ok(ids.has(i), `aucun bloc ne correspond à la couleur ${i}`)
    }
    assert.ok(!ids.has(16), 'un identifiant hors palette est déclaré')
  })
})
