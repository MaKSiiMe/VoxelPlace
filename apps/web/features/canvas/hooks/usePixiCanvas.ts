'use client'

import { useEffect, type RefObject } from 'react'
import {
  Application,
  BufferImageSource,
  Texture,
  Sprite,
  type FederatedPointerEvent,
} from 'pixi.js'
import { useCanvasStore } from '../store'

// ─── Palette RGBA (miroir de COLORS dans apps/socket-server/src/index.js) ────
const HEX_COLORS = [
  '#FFFFFF', '#000000', '#FF4444', '#00AA00',
  '#4444FF', '#FFFF00', '#FF8800', '#AA00AA',
]

const PALETTE_RGBA: Uint8Array = (() => {
  const buf = new Uint8Array(HEX_COLORS.length * 4)
  HEX_COLORS.forEach((hex, i) => {
    buf[i * 4]     = parseInt(hex.slice(1, 3), 16)
    buf[i * 4 + 1] = parseInt(hex.slice(3, 5), 16)
    buf[i * 4 + 2] = parseInt(hex.slice(5, 7), 16)
    buf[i * 4 + 3] = 255
  })
  return buf
})()

// ─── Helpers ─────────────────────────────────────────────────────────────────

function gridToRGBA(grid: Uint8Array, size: number): Uint8Array {
  const rgba = new Uint8Array(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    const id = (grid[i] ?? 0) & 0x07
    rgba[i * 4]     = PALETTE_RGBA[id * 4]
    rgba[i * 4 + 1] = PALETTE_RGBA[id * 4 + 1]
    rgba[i * 4 + 2] = PALETTE_RGBA[id * 4 + 2]
    rgba[i * 4 + 3] = 255
  }
  return rgba
}

const DEFAULT_SCALE = 4
const GRID_HALF     = 1024 // GRID_SIZE / 2 → pixel (1024,1024) = math (0,0)

// Système de coordonnées mathématique : +X droite, +Y haut
// math (0,0) = centre du viewport = pixel grille (1024,1024)
function centerOnOrigin(app: Application, sprite: Sprite) {
  const cx = Math.round(app.renderer.width  / 2)
  const cy = Math.round(app.renderer.height / 2)
  sprite.scale.x =  DEFAULT_SCALE
  sprite.scale.y = -DEFAULT_SCALE // Y-flip : +Y vers le haut
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

    // Mutable pixi refs (not React state — no re-render needed)
    let app:          Application
    let bufferSource: BufferImageSource
    let gridSprite:   Sprite
    let isPanning     = false
    let panStart      = { x: 0, y: 0 }
    let spriteStart   = { x: 0, y: 0 }
    let isSpaceDown   = false
    let unsubGrid:    () => void
    let resizeObs:    ResizeObserver

    async function init() {
      app = new Application()

      await app.init({
        width:           container.clientWidth,
        height:          container.clientHeight,
        backgroundColor: 0xffffff,
        antialias:       false,
        resolution:      1,
        autoDensity:     false,
        preference:      'webgl',
      })

      if (destroyed) { app.destroy(true); return }

      app.canvas.style.imageRendering = 'pixelated'
      app.canvas.style.display        = 'block'
      container.appendChild(app.canvas)

      // ── Texture from initial blank 64×64 grid ──
      const initSize = useCanvasStore.getState().gridSize
      const initRGBA = new Uint8Array(initSize * initSize * 4).fill(255)

      bufferSource = new BufferImageSource({
        resource:   initRGBA,
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

      // ── Subscribe to grid changes (outside React render cycle) ──
      unsubGrid = useCanvasStore.subscribe(
        (s) => s.grid,
        (grid) => {
          if (!grid || !bufferSource) return
          const size = useCanvasStore.getState().gridSize
          bufferSource.resource = gridToRGBA(grid, size)
          bufferSource.update()
        },
      )

      // Apply grid if already loaded (race condition on hot reload)
      const currentGrid = useCanvasStore.getState().grid
      if (currentGrid) {
        bufferSource.resource = gridToRGBA(currentGrid, initSize)
        bufferSource.update()
      }

      // ── Click → place pixel ──
      gridSprite.on('pointerdown', (e: FederatedPointerEvent) => {
        if (e.button !== 0) return
        const local  = e.getLocalPosition(gridSprite)
        const gx     = Math.floor(local.x)
        const gy     = Math.floor(local.y)
        const { gridSize, placePixel } = useCanvasStore.getState()
        if (gx >= 0 && gx < gridSize && gy >= 0 && gy < gridSize) {
          placePixel(gx, gy, username)
        }
      })

      // ── Hover ──
      gridSprite.on('pointermove', (e: FederatedPointerEvent) => {
        const local = e.getLocalPosition(gridSprite)
        const gx    = Math.floor(local.x)
        const gy    = Math.floor(local.y)
        const { gridSize, setHoveredPixel } = useCanvasStore.getState()
        if (gx >= 0 && gx < gridSize && gy >= 0 && gy < gridSize) {
          setHoveredPixel({ x: gx - GRID_HALF, y: gy - GRID_HALF })
        } else {
          setHoveredPixel(null)
        }
      })
      gridSprite.on('pointerleave', () => useCanvasStore.getState().setHoveredPixel(null))

      // ── Pan (middle mouse + space+drag) ──
      app.stage.eventMode = 'static'
      app.stage.hitArea   = app.screen

      app.stage.on('pointerdown', (e: FederatedPointerEvent) => {
        if (e.button !== 1 && !isSpaceDown) return
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

      // ── Zoom (mouse wheel) ──
      const onWheel = (e: WheelEvent) => {
        e.preventDefault()
        const MIN = 0.25, MAX = 64
        const rect     = app.canvas.getBoundingClientRect()
        const mouseX   = e.clientX - rect.left
        const mouseY   = e.clientY - rect.top
        const factor   = e.deltaY < 0 ? 1.15 : 1 / 1.15
        const oldScale = gridSprite.scale.x
        const newScale = Math.max(MIN, Math.min(MAX, oldScale * factor))
        const worldX   = (mouseX - gridSprite.x) / oldScale
        const worldY   = (gridSprite.y - mouseY) / oldScale // Y-flip
        gridSprite.scale.x =  newScale
        gridSprite.scale.y = -newScale
        gridSprite.x = mouseX - worldX * newScale
        gridSprite.y = mouseY + worldY * newScale
      }
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

      // Store cleanup refs
      ;(container as HTMLDivElement & { _pixiCleanup?: () => void })._pixiCleanup = () => {
        container.removeEventListener('wheel', onWheel)
        window.removeEventListener('keydown', onKeyDown)
        window.removeEventListener('keyup',   onKeyUp)
        resizeObs?.disconnect()
        unsubGrid?.()
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
