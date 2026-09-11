import { describe, test, expect } from 'vitest'
import { TouchGesture, pinchTransform, TAP_TOLERANCE_PX } from '../features/canvas/gestures'
import { MAX_SCALE, MIN_SCALE } from '../features/canvas/viewportState'

/** Sprite simulé, mis à jour comme le ferait le canvas. */
function setup(initial = { x: 100, y: 900, scale: 4 }) {
  let sprite = { ...initial }
  const g = new TouchGesture(() => sprite)
  const apply = (t: typeof sprite | null) => { if (t) sprite = t; return t }
  return { g, apply, get sprite() { return sprite } }
}

/** Point de la toile (coordonnées locales) sous un point de l'écran. */
const localUnder = (s: { x: number; y: number; scale: number }, px: number, py: number) =>
  ({ x: (px - s.x) / s.scale, y: (s.y - py) / s.scale })

describe('tap', () => {
  test('un doigt posé puis levé sans bouger est un tap', () => {
    const { g } = setup()
    g.down(1, { x: 50, y: 50 })
    expect(g.up(1)).toEqual({ x: 50, y: 50 })
  })

  test('un léger tremblement reste un tap et ne déplace pas la vue', () => {
    const { g, apply, sprite } = setup()
    const before = { ...sprite }
    g.down(1, { x: 50, y: 50 })
    expect(apply(g.move(1, { x: 50 + TAP_TOLERANCE_PX, y: 50 }))).toBeNull()
    expect(g.up(1)).not.toBeNull()
    expect(sprite).toEqual(before)
  })

  test('un glissement n\'est pas un tap — sinon chaque déplacement poserait un pixel', () => {
    const { g, apply } = setup()
    g.down(1, { x: 50, y: 50 })
    apply(g.move(1, { x: 120, y: 50 }))
    expect(g.up(1)).toBeNull()
  })

  test('un pincement n\'est jamais un tap, même quand on relâche le dernier doigt', () => {
    const { g } = setup()
    g.down(1, { x: 50, y: 50 })
    g.down(2, { x: 150, y: 50 })
    expect(g.up(2)).toBeNull()
    expect(g.up(1)).toBeNull()
  })
})

describe('déplacement à un doigt', () => {
  test('la vue suit le doigt', () => {
    const { g, apply } = setup({ x: 100, y: 900, scale: 4 })
    g.down(1, { x: 50, y: 50 })
    const t = apply(g.move(1, { x: 80, y: 20 }))
    expect(t).toEqual({ x: 130, y: 870, scale: 4 })
  })

  test('le doigt restant après un pincement reprend sans faire sauter la vue', () => {
    const s = setup()
    s.g.down(1, { x: 50, y: 50 })
    s.g.down(2, { x: 150, y: 50 })
    s.apply(s.g.move(2, { x: 250, y: 50 }))      // pincement
    const afterPinch = { ...s.sprite }
    s.g.up(2)
    const t = s.apply(s.g.move(1, { x: 50 + 30, y: 50 }))
    expect(t!.scale).toBe(afterPinch.scale)
    expect(t!.x).toBeCloseTo(afterPinch.x + 30)
  })
})

describe('pincement', () => {
  test('écarter les doigts zoome proportionnellement', () => {
    const { g, apply } = setup({ x: 0, y: 0, scale: 4 })
    g.down(1, { x: 100, y: 100 })
    g.down(2, { x: 200, y: 100 })               // 100 px d'écart
    const t = apply(g.move(2, { x: 300, y: 100 })) // 200 px : ×2
    expect(t!.scale).toBeCloseTo(8)
  })

  test('le point de la toile sous les doigts reste sous les doigts', () => {
    const start = { x: 37, y: 812, scale: 4 }
    const mid   = { x: 200, y: 300 }
    const local = localUnder(start, mid.x, mid.y)
    const t = pinchTransform(start, mid, 100, mid, 250)
    const after = localUnder(t, mid.x, mid.y)
    expect(after.x).toBeCloseTo(local.x)
    expect(after.y).toBeCloseTo(local.y)
  })

  test('zoomer en déplaçant les doigts emmène le même point de la toile', () => {
    const start = { x: 37, y: 812, scale: 4 }
    const from  = { x: 200, y: 300 }
    const to    = { x: 260, y: 340 }
    const local = localUnder(start, from.x, from.y)
    const t = pinchTransform(start, from, 100, to, 150)
    const after = localUnder(t, to.x, to.y)
    expect(after.x).toBeCloseTo(local.x)
    expect(after.y).toBeCloseTo(local.y)
  })

  test('le zoom reste borné', () => {
    expect(pinchTransform({ x: 0, y: 0, scale: 40 }, { x: 0, y: 0 }, 10, { x: 0, y: 0 }, 1000).scale).toBe(MAX_SCALE)
    expect(pinchTransform({ x: 0, y: 0, scale: 1 },  { x: 0, y: 0 }, 1000, { x: 0, y: 0 }, 1).scale).toBe(MIN_SCALE)
  })
})
