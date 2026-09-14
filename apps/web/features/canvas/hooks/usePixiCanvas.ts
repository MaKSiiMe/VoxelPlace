'use client'

import { useEffect, type RefObject } from 'react'
import {
  Application,
  BufferImageSource,
  Texture,
  Sprite,
  type FederatedPointerEvent,
} from 'pixi.js'
import { useCanvasStore, DEFAULT_COLORS, drainDirtyPixels } from '../store'
import { viewportState, registerViewportControls, unregisterViewportControls, zoomAround } from '../viewportState'
import { toDisplayCoords } from '../coords'
import { shouldPlace, shouldInspect } from '../clickIntent'
import { TouchGesture } from '../gestures'

// ─── Palette RGBA (construite depuis DEFAULT_COLORS du store) ────────────────
const PALETTE_RGBA: Uint8Array = (() => {
  const buf = new Uint8Array(DEFAULT_COLORS.length * 4)
  DEFAULT_COLORS.forEach((hex, i) => {
    buf[i * 4]     = parseInt(hex.slice(1, 3), 16)
    buf[i * 4 + 1] = parseInt(hex.slice(3, 5), 16)
    buf[i * 4 + 2] = parseInt(hex.slice(5, 7), 16)
    buf[i * 4 + 3] = 255
  })
  return buf
})()

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Réécrit tout le buffer RGBA depuis la grille. Réservé aux chargements complets. */
function fillRGBA(rgba: Uint8Array, grid: Uint8Array, size: number): void {
  for (let i = 0; i < size * size; i++) {
    const id = (grid[i] ?? 0) & 0x0F
    rgba[i * 4]     = PALETTE_RGBA[id * 4]
    rgba[i * 4 + 1] = PALETTE_RGBA[id * 4 + 1]
    rgba[i * 4 + 2] = PALETTE_RGBA[id * 4 + 2]
    rgba[i * 4 + 3] = 255
  }
}

/** Réécrit les 4 octets d'un seul pixel. */
function writePixelRGBA(rgba: Uint8Array, index: number, colorId: number): void {
  const id = colorId & 0x0F
  const o  = index * 4
  rgba[o]     = PALETTE_RGBA[id * 4]
  rgba[o + 1] = PALETTE_RGBA[id * 4 + 1]
  rgba[o + 2] = PALETTE_RGBA[id * 4 + 2]
  rgba[o + 3] = 255
}

const DEFAULT_SCALE  = 4
const GRID_HALF      = 1024

function centerOnOrigin(app: Application, sprite: Sprite) {
  sprite.scale.x =  DEFAULT_SCALE
  sprite.scale.y = -DEFAULT_SCALE
  const cx = Math.round(app.renderer.width  / 2)
  const cy = Math.round(app.renderer.height / 2)
  sprite.x = cx - GRID_HALF * DEFAULT_SCALE
  sprite.y = cy + GRID_HALF * DEFAULT_SCALE
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePixiCanvas(
  containerRef: RefObject<HTMLDivElement | null>,
  username: string,
) {
  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    let destroyed    = false
    let initComplete = false

    let app:          Application
    let bufferSource: BufferImageSource
    let rgbaBuffer:   Uint8Array
    let gridSprite:   Sprite
    let isPanning     = false
    let panStart      = { x: 0, y: 0 }
    let spriteStart   = { x: 0, y: 0 }
    let isSpaceDown   = false
    let unsubGrid:     () => void
    let unsubFullGrid: () => void
    let resizeObs:    ResizeObserver

    async function init() {
      app = new Application()

      await app.init({
        width:           container.clientWidth,
        height:          container.clientHeight,
        backgroundColor: 0x13141c,   // --color-bg
        antialias:       false,
        resolution:      1,
        autoDensity:     false,
        preference:      'webgl',
      })

      if (destroyed) { app.destroy(true); return }

      app.canvas.style.imageRendering = 'pixelated'
      app.canvas.style.display        = 'block'
      container.appendChild(app.canvas)

      // ── Texture ──
      const initSize = useCanvasStore.getState().gridSize
      // Alloué une fois pour toute la durée de vie du canvas : on y écrit
      // ensuite pixel par pixel, au lieu de reconstruire 16 Mo à chaque pose.
      rgbaBuffer = new Uint8Array(initSize * initSize * 4).fill(255)

      bufferSource = new BufferImageSource({
        resource:   rgbaBuffer,
        width:      initSize,
        height:     initSize,
        format:     'rgba8unorm',
        scaleMode:  'nearest',
        alphaMode:  'no-premultiply-alpha',
      } as ConstructorParameters<typeof BufferImageSource>[0])

      const texture = new Texture({ source: bufferSource })
      gridSprite    = new Sprite({ texture })
      gridSprite.eventMode = 'static'
      gridSprite.cursor    = 'crosshair'
      app.stage.addChild(gridSprite)
      centerOnOrigin(app, gridSprite)

      // ── Register navigate callback for minimap click-to-navigate ──
      const applyZoom = (factor: number, px: number, py: number) => {
        const next = zoomAround({ x: gridSprite.x, y: gridSprite.y, scale: gridSprite.scale.x }, factor, px, py)
        gridSprite.scale.x =  next.scale
        gridSprite.scale.y = -next.scale
        gridSprite.x = next.x
        gridSprite.y = next.y
        useCanvasStore.getState().setPixelSize(next.scale)
      }

      registerViewportControls({
        navigate: (gx, gy) => {
          const S = gridSprite.scale.x
          gridSprite.x = app.renderer.width  / 2 - gx * S
          gridSprite.y = app.renderer.height / 2 + gy * S
        },
        zoomBy:   (factor) => applyZoom(factor, app.renderer.width / 2, app.renderer.height / 2),
        recenter: () => {
          centerOnOrigin(app, gridSprite)
          useCanvasStore.getState().setPixelSize(gridSprite.scale.x)
        },
      })

      // ── Grid overlay — manipulé directement en DOM via data-attribute ──
      app.ticker.add(() => {
        flushGridChanges()
        const scale = gridSprite.scale.x
        useCanvasStore.getState().setPixelSize(scale)
        // Mise à jour du viewport pour la minimap (sans re-render React)
        viewportState.spriteX = gridSprite.x
        viewportState.spriteY = gridSprite.y
        viewportState.scale   = scale
        viewportState.screenW = app.renderer.width
        viewportState.screenH = app.renderer.height
        const el = document.getElementById('canvas-grid-overlay')
        if (!el) return
        const opacity = Math.min(1, (scale - 4) / 4)
        if (opacity <= 0) { el.style.opacity = '0'; return }
        el.style.opacity       = String(opacity * 0.2)
        el.style.backgroundSize     = `${scale}px ${scale}px`
        el.style.backgroundPosition = `${gridSprite.x}px ${gridSprite.y}px`
      })

      // ── Suivi des changements de grille ──
      // La grille est mutée en place : on observe le compteur de version, et
      // on note simplement qu'il y a du travail. L'application a lieu dans le
      // ticker, au plus une fois par frame, quel que soit le nombre de pixels
      // reçus entre deux images.
      let needsFullRedraw = false
      let hasPendingWork  = false

      unsubGrid = useCanvasStore.subscribe(
        (s) => s.gridVersion,
        () => { hasPendingWork = true },
      )

      // Un remplacement complet de la grille (grid:init) vide la file : les
      // indices en attente ne désignent plus rien de valide.
      unsubFullGrid = useCanvasStore.subscribe(
        (s) => s.grid,
        () => { needsFullRedraw = true; hasPendingWork = true },
      )

      function flushGridChanges() {
        if (!hasPendingWork || !bufferSource) return
        hasPendingWork = false

        const grid = useCanvasStore.getState().grid
        if (!grid) return
        const size = useCanvasStore.getState().gridSize

        if (needsFullRedraw) {
          needsFullRedraw = false
          drainDirtyPixels()
          fillRGBA(rgbaBuffer, grid, size)
        } else {
          const dirty = drainDirtyPixels()
          if (dirty.length === 0) return
          for (const index of dirty) writePixelRGBA(rgbaBuffer, index, grid[index] ?? 0)
        }
        bufferSource.update()
      }

      const currentGrid = useCanvasStore.getState().grid
      if (currentGrid) {
        fillRGBA(rgbaBuffer, currentGrid, initSize)
        bufferSource.update()
      }

      // ── Click → place pixel ──
      // Appui : pose immédiate en mode Build. On mémorise la position et le mode
      // pour décider, au relâchement, s'il s'agissait d'un clic d'inspection.
      let pressStart: { x: number; y: number; selectedColor: number | null } | null = null

      gridSprite.on('pointerdown', (e: FederatedPointerEvent) => {
        if (e.pointerType === 'touch') return   // géré par le suivi de gestes plus bas
        const local  = e.getLocalPosition(gridSprite)
        const gx     = Math.floor(local.x)
        const gy     = Math.floor(local.y)
        const { gridSize, placePixel, selectedColor } = useCanvasStore.getState()
        const inBounds = gx >= 0 && gx < gridSize && gy >= 0 && gy < gridSize

        pressStart = { x: e.clientX, y: e.clientY, selectedColor }
        if (shouldPlace({ button: e.button, spaceHeld: isSpaceDown, inBounds, selectedColor })) {
          placePixel(gx, gy, username)
        }
      })

      // Relâchement : en mode Exploration, un clic sans glissement ouvre l'inspecteur
      gridSprite.on('pointerup', (e: FederatedPointerEvent) => {
        if (e.pointerType === 'touch' || !pressStart) return
        const local  = e.getLocalPosition(gridSprite)
        const gx     = Math.floor(local.x)
        const gy     = Math.floor(local.y)
        const { gridSize, setInspectedPixel } = useCanvasStore.getState()
        const inBounds = gx >= 0 && gx < gridSize && gy >= 0 && gy < gridSize
        const movedPx  = Math.hypot(e.clientX - pressStart.x, e.clientY - pressStart.y)
        const selectedColorAtDown = pressStart.selectedColor
        pressStart = null

        if (shouldInspect({ button: e.button, spaceHeld: isSpaceDown, inBounds, movedPx, selectedColorAtDown })) {
          setInspectedPixel({ x: gx, y: gy })
        }
      })

      // ── Hover → coordonnées grille + position écran pour le curseur ──
      gridSprite.on('pointermove', (e: FederatedPointerEvent) => {
        const local = e.getLocalPosition(gridSprite)
        const gx    = Math.floor(local.x)
        const gy    = Math.floor(local.y)
        const { gridSize, setHoveredPixel, setCursorScreenPos } = useCanvasStore.getState()

        if (gx >= 0 && gx < gridSize && gy >= 0 && gy < gridSize) {
          setHoveredPixel(toDisplayCoords(gx, gy, gridSize))
          const scale   = gridSprite.scale.x
          const screenX = gridSprite.x + gx * scale
          const screenY = gridSprite.y - (gy + 1) * scale
          setCursorScreenPos({ x: screenX, y: screenY })
        } else {
          setHoveredPixel(null)
          setCursorScreenPos(null)
        }
      })

      gridSprite.on('pointerleave', () => {
        useCanvasStore.getState().setHoveredPixel(null)
        useCanvasStore.getState().setCursorScreenPos(null)
      })

      // ── Pan (clic droit + espace+drag) + désélection mode Build ──
      app.stage.eventMode = 'static'
      app.stage.hitArea   = app.screen

      app.stage.on('pointerdown', (e: FederatedPointerEvent) => {
        if (e.button === 2) {
          const { selectedColor, setSelectedColor } = useCanvasStore.getState()
          if (selectedColor !== null) {
            setSelectedColor(null)
            return
          }
        }
        if (e.button !== 2 && !isSpaceDown) return
        isPanning   = true
        panStart    = { x: e.clientX, y: e.clientY }
        spriteStart = { x: gridSprite.x, y: gridSprite.y }
        app.canvas.style.cursor = 'grabbing'
      })

      app.stage.on('pointermove', (e: FederatedPointerEvent) => {
        if (!isPanning) return
        gridSprite.x = spriteStart.x + (e.clientX - panStart.x)
        gridSprite.y = spriteStart.y + (e.clientY - panStart.y)
      })

      const stopPan = () => {
        isPanning = false
        app.canvas.style.cursor = isSpaceDown ? 'grab' : ''
      }
      app.stage.on('pointerup',        stopPan)
      app.stage.on('pointerupoutside', stopPan)

      // ── Zoom ──
      const onWheel = (e: WheelEvent) => {
        e.preventDefault()
        const rect   = app.canvas.getBoundingClientRect()
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
        applyZoom(factor, e.clientX - rect.left, e.clientY - rect.top)
      }
      // ── Gestes tactiles : déplacement, pincement, tap ──
      const gesture = new TouchGesture(() => ({ x: gridSprite.x, y: gridSprite.y, scale: gridSprite.scale.x }))
      const canvasEl = app.canvas
      const toCanvasPoint = (e: PointerEvent) => {
        const r = canvasEl.getBoundingClientRect()
        return { x: e.clientX - r.left, y: e.clientY - r.top }
      }

      const onTouchDown = (e: PointerEvent) => {
        if (e.pointerType !== 'touch') return
        canvasEl.setPointerCapture(e.pointerId)
        gesture.down(e.pointerId, toCanvasPoint(e))
      }
      const onTouchMove = (e: PointerEvent) => {
        if (e.pointerType !== 'touch') return
        const t = gesture.move(e.pointerId, toCanvasPoint(e))
        if (!t) return
        gridSprite.scale.x =  t.scale
        gridSprite.scale.y = -t.scale
        gridSprite.x = t.x
        gridSprite.y = t.y
        useCanvasStore.getState().setPixelSize(t.scale)
      }
      const onTouchUp = (e: PointerEvent) => {
        if (e.pointerType !== 'touch') return
        const tap = gesture.up(e.pointerId)
        if (!tap) return

        // Même règle qu'à la souris : pose en mode Build, inspection sinon
        const local = gridSprite.toLocal({ x: tap.x, y: tap.y })
        const gx = Math.floor(local.x)
        const gy = Math.floor(local.y)
        const { gridSize, selectedColor, placePixel, setInspectedPixel } = useCanvasStore.getState()
        const inBounds = gx >= 0 && gx < gridSize && gy >= 0 && gy < gridSize
        if (shouldPlace({ button: 0, spaceHeld: false, inBounds, selectedColor })) {
          placePixel(gx, gy, username)
        } else if (shouldInspect({ button: 0, spaceHeld: false, inBounds, movedPx: 0, selectedColorAtDown: selectedColor })) {
          setInspectedPixel({ x: gx, y: gy })
        }
      }
      const onTouchCancel = (e: PointerEvent) => {
        if (e.pointerType === 'touch') gesture.cancel(e.pointerId)
      }

      canvasEl.addEventListener('pointerdown',   onTouchDown)
      canvasEl.addEventListener('pointermove',   onTouchMove)
      canvasEl.addEventListener('pointerup',     onTouchUp)
      canvasEl.addEventListener('pointercancel', onTouchCancel)

      const onContextMenu = (e: MouseEvent) => e.preventDefault()
      container.addEventListener('contextmenu', onContextMenu)
      container.addEventListener('wheel', onWheel, { passive: false })

      // ── Space key ──
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.code !== 'Space' || e.target !== document.body) return
        e.preventDefault()
        isSpaceDown = true
        if (!isPanning) app.canvas.style.cursor = 'grab'
      }
      const onKeyUp = (e: KeyboardEvent) => {
        if (e.code !== 'Space') return
        isSpaceDown = false
        if (!isPanning) app.canvas.style.cursor = ''
      }
      window.addEventListener('keydown', onKeyDown)
      window.addEventListener('keyup',   onKeyUp)

      // ── Resize ──
      resizeObs = new ResizeObserver(() => {
        if (!app?.renderer) return
        app.renderer.resize(container.clientWidth, container.clientHeight)
        app.stage.hitArea = app.screen
      })
      resizeObs.observe(container)

      ;(container as HTMLDivElement & { _pixiCleanup?: () => void })._pixiCleanup = () => {
        canvasEl.removeEventListener('pointerdown',   onTouchDown)
        canvasEl.removeEventListener('pointermove',   onTouchMove)
        canvasEl.removeEventListener('pointerup',     onTouchUp)
        canvasEl.removeEventListener('pointercancel', onTouchCancel)
        container.removeEventListener('contextmenu', onContextMenu)
        container.removeEventListener('wheel', onWheel)
        window.removeEventListener('keydown', onKeyDown)
        window.removeEventListener('keyup',   onKeyUp)
        resizeObs?.disconnect()
        unsubGrid?.()
        unsubFullGrid?.()
        unregisterViewportControls()
      }

      initComplete = true
    }

    init().catch(console.error)

    return () => {
      destroyed = true
      ;(container as HTMLDivElement & { _pixiCleanup?: () => void })._pixiCleanup?.()
      if (initComplete) {
        try {
          app.destroy(true, { children: true, texture: true, textureSource: true })
        } catch { /* ignore double-destroy in React StrictMode */ }
      }
    }
  }, [containerRef, username]) // eslint-disable-line react-hooks/exhaustive-deps
}
