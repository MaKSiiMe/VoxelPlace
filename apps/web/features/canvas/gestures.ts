// ── Gestes tactiles ──────────────────────────────────────────────────────────
// Le canvas ne répondait qu'à la molette, au clic droit et à la barre d'espace :
// inutilisable au doigt. Règles retenues :
//   · un doigt qui glisse       → déplace la vue
//   · deux doigts               → zoom par pincement, centré entre les doigts
//   · un doigt posé puis levé   → tap : pose (mode Build) ou inspection
//
// Au doigt, la pose ne peut pas avoir lieu à l'appui comme à la souris :
// chaque début de déplacement poserait un pixel.

import { MIN_SCALE, MAX_SCALE } from './viewportState'

/** Un doigt tremble davantage qu'une souris : tolérance plus large avant de parler de glissement. */
export const TAP_TOLERANCE_PX = 10

export interface Point { x: number; y: number }
export interface SpriteTransform { x: number; y: number; scale: number }

export function distance(a: Point, b: Point) { return Math.hypot(a.x - b.x, a.y - b.y) }
export function midpoint(a: Point, b: Point): Point { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }

/**
 * Transformation du sprite pendant un pincement.
 *
 * Le point de la toile qui se trouvait sous le milieu des doigts au début du
 * geste reste sous leur milieu actuel : on peut zoomer et se déplacer d'un
 * même mouvement, comme sur une carte. Le sprite a une échelle Y négative
 * (axe inversé), d'où les signes opposés entre les deux axes.
 */
export function pinchTransform(
  start: SpriteTransform,
  startMid: Point, startDist: number,
  mid: Point, dist: number,
): SpriteTransform {
  const ratio = startDist > 0 ? dist / startDist : 1
  const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, start.scale * ratio))
  const lx = (startMid.x - start.x) / start.scale
  const ly = (start.y - startMid.y) / start.scale
  return { scale, x: mid.x - lx * scale, y: mid.y + ly * scale }
}

/**
 * Suivi d'un geste tactile, indépendant de Pixi et du DOM.
 * Chaque méthode renvoie ce que le canvas doit appliquer.
 */
export class TouchGesture {
  private touches = new Map<number, Point>()
  private start: null | {
    kind: 'pan' | 'pinch'
    point: Point
    sprite: SpriteTransform
    mid: Point
    dist: number
  } = null
  /** Faux dès qu'un geste a dépassé la tolérance ou impliqué deux doigts. */
  private isTap = false

  constructor(private readonly getSprite: () => SpriteTransform) {}

  get activeTouches() { return this.touches.size }

  down(id: number, p: Point) {
    const first = this.touches.size === 0
    this.touches.set(id, p)
    if (first) this.isTap = true
    if (this.touches.size > 1) this.isTap = false
    this.restart()
  }

  /** @returns la nouvelle transformation à appliquer, ou null s'il n'y a rien à faire. */
  move(id: number, p: Point): SpriteTransform | null {
    if (!this.touches.has(id) || !this.start) return null
    this.touches.set(id, p)
    const pts = [...this.touches.values()]

    if (this.start.kind === 'pinch' && pts.length >= 2) {
      return pinchTransform(this.start.sprite, this.start.mid, this.start.dist, midpoint(pts[0], pts[1]), distance(pts[0], pts[1]))
    }

    const dx = p.x - this.start.point.x
    const dy = p.y - this.start.point.y
    if (this.isTap && Math.hypot(dx, dy) <= TAP_TOLERANCE_PX) return null
    this.isTap = false
    return { scale: this.start.sprite.scale, x: this.start.sprite.x + dx, y: this.start.sprite.y + dy }
  }

  /** @returns le point du tap si le doigt levé en était un, sinon null. */
  up(id: number): Point | null {
    const p = this.touches.get(id)
    const tap = this.isTap && this.touches.size === 1 ? p ?? null : null
    this.touches.delete(id)
    if (this.touches.size === 0) {
      this.start = null
    } else {
      // Le doigt restant reprend en déplacement depuis sa position actuelle,
      // sans saut ni tap involontaire.
      this.isTap = false
      this.restart()
    }
    return tap
  }

  cancel(id: number) {
    this.isTap = false
    this.up(id)
  }

  private restart() {
    const pts = [...this.touches.values()]
    const sprite = this.getSprite()
    this.start = pts.length >= 2
      ? { kind: 'pinch', point: pts[0], sprite, mid: midpoint(pts[0], pts[1]), dist: distance(pts[0], pts[1]) }
      : { kind: 'pan',   point: pts[0], sprite, mid: pts[0], dist: 0 }
  }
}
