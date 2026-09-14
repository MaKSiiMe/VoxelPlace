import { describe, test, expect, vi } from 'vitest'
import { pixelLink, parsePixelLink } from '../features/canvas/pixelLink'
import { formatDisplayCoords } from '../features/canvas/coords'

describe('pixelLink / parsePixelLink', () => {
  test('le lien porte les coordonnées affichées au joueur', () => {
    // Même repère que le HUD : un modérateur lit et partage ce qu'il voit
    expect(pixelLink(1024, 1024)).toBe('/?x=0&y=0')
    expect(pixelLink(1012, 984)).toBe('/?x=-12&y=40')
    expect(formatDisplayCoords(1012, 984)).toBe('X: -12  Y: 40')
  })

  test('aller-retour exact sur les bords de la grille', () => {
    for (const [gx, gy] of [[0, 0], [2047, 2047], [0, 2047], [1012, 984]]) {
      expect(parsePixelLink(pixelLink(gx, gy).slice(1))).toEqual({ x: gx, y: gy })
    }
  })

  test('ignore un lien absent, incomplet, non entier ou hors grille', () => {
    for (const search of ['', '?x=3', '?x=&y=', '?x=1.5&y=0', '?x=abc&y=0', '?x=5000&y=0', '?x=0&y=-1024']) {
      expect(parsePixelLink(search), search).toBeNull()
    }
  })
})

describe('navigation différée', () => {
  test('une navigation demandée avant l\'initialisation du canvas s\'applique à son enregistrement', async () => {
    vi.resetModules()
    const vp = await import('../features/canvas/viewportState')
    vp.navigateToPixel(10, 20)
    const navigate = vi.fn()
    vp.registerViewportControls({ navigate, zoomBy: vi.fn(), recenter: vi.fn() })
    expect(navigate).toHaveBeenCalledWith(10, 20)

    // Une seule fois : un second enregistrement (resize, remontage) ne rejoue rien
    const again = vi.fn()
    vp.registerViewportControls({ navigate: again, zoomBy: vi.fn(), recenter: vi.fn() })
    expect(again).not.toHaveBeenCalled()
  })
})
