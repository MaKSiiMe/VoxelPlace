import { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react'

const BASE_PX        = 8
const MIN_ZOOM       = 0.5
const MAX_ZOOM       = 24
const DRAG_THRESHOLD = 4

// Seuil à partir duquel les lignes de grille sont dessinées
const GRID_LINE_ZOOM = 2.5

const GridCanvas = forwardRef(function GridCanvas(
  { grid, gridSize, colors, onPixelClick, adminMode, cooldown },
  ref
) {
  const wrapperRef  = useRef(null)
  const canvasRef   = useRef(null)  // canvas principal (pixels)
  const overlayRef  = useRef(null)  // canvas overlay (grille + hover)
  const tooltipRef  = useRef(null)

  const zoomRef    = useRef(1)
  const panRef     = useRef({ x: 0, y: 0 })
  const dragRef    = useRef(null)
  const touchRef   = useRef(null)   // état tactile en cours
  const hoveredRef = useRef(null)   // { x, y } | null

  const [, forceRender] = useState(0)
  const rerender = useCallback(() => forceRender(n => n + 1), [])

  const canvasSize = gridSize * BASE_PX

  // ── Dessin principal ─────────────────────────────────────────────────────
  const drawGrid = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !grid) return
    const ctx = canvas.getContext('2d')
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        ctx.fillStyle = colors[grid[y * gridSize + x]] ?? '#FFFFFF'
        ctx.fillRect(x * BASE_PX, y * BASE_PX, BASE_PX, BASE_PX)
      }
    }
  }, [grid, gridSize, colors])

  useEffect(() => { drawGrid() }, [drawGrid])

  // ── Overlay : grille + hover highlight ───────────────────────────────────
  const drawOverlay = useCallback(() => {
    const canvas = overlayRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const zoom = zoomRef.current

    // Lignes de grille — apparaissent progressivement à partir de GRID_LINE_ZOOM
    if (zoom >= GRID_LINE_ZOOM) {
      const alpha = Math.min(0.25, (zoom - GRID_LINE_ZOOM) * 0.08)
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`
      ctx.lineWidth = 0.5
      for (let i = 0; i <= gridSize; i++) {
        ctx.beginPath()
        ctx.moveTo(i * BASE_PX, 0)
        ctx.lineTo(i * BASE_PX, gridSize * BASE_PX)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(0, i * BASE_PX)
        ctx.lineTo(gridSize * BASE_PX, i * BASE_PX)
        ctx.stroke()
      }
    }

    // Hover highlight
    const h = hoveredRef.current
    if (h && zoom >= 1) {
      ctx.fillStyle = adminMode
        ? 'rgba(240,165,0,0.18)'
        : 'rgba(255,255,255,0.14)'
      ctx.fillRect(h.x * BASE_PX, h.y * BASE_PX, BASE_PX, BASE_PX)

      ctx.strokeStyle = adminMode
        ? 'rgba(240,165,0,0.9)'
        : 'rgba(255,255,255,0.85)'
      ctx.lineWidth = 1
      ctx.strokeRect(h.x * BASE_PX + 0.5, h.y * BASE_PX + 0.5, BASE_PX - 1, BASE_PX - 1)
    }
  }, [gridSize, adminMode])

  // Redessine l'overlay à chaque rerender (zoom/pan/hover)
  useEffect(() => { drawOverlay() }, [drawOverlay, /* zoom/pan via forceRender */])

  // ── drawPixel exposé au parent ───────────────────────────────────────────
  const drawPixel = useCallback((x, y, colorId) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = colors[colorId] ?? '#FFFFFF'
    ctx.fillRect(x * BASE_PX, y * BASE_PX, BASE_PX, BASE_PX)
    // Re-dessine l'overlay pour restaurer les lignes de grille au-dessus
    drawOverlay()
  }, [colors, drawOverlay])

  useImperativeHandle(ref, () => ({ drawPixel }), [drawPixel])

  // ── Centrage initial ─────────────────────────────────────────────────────
  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const { width, height } = wrapper.getBoundingClientRect()
    panRef.current = {
      x: (width  - canvasSize) / 2,
      y: (height - canvasSize) / 2,
    }
    rerender()
  }, [canvasSize, rerender])

  // ── Conversion écran → pixel grille ─────────────────────────────────────
  function screenToPixel(clientX, clientY) {
    const wrapper = wrapperRef.current
    if (!wrapper) return null
    const rect = wrapper.getBoundingClientRect()
    const zoom = zoomRef.current
    const { x: panX, y: panY } = panRef.current
    const px = Math.floor((clientX - rect.left  - panX) / (zoom * BASE_PX))
    const py = Math.floor((clientY - rect.top   - panY) / (zoom * BASE_PX))
    if (px < 0 || px >= gridSize || py < 0 || py >= gridSize) return null
    return { x: px, y: py }
  }

  // ── Wheel : zoom centré sur le curseur ───────────────────────────────────
  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return

    function onWheel(e) {
      e.preventDefault()
      const rect = wrapper.getBoundingClientRect()
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
      const prevZoom = zoomRef.current
      const newZoom  = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prevZoom * factor))
      const { x: panX, y: panY } = panRef.current
      const cx = (e.clientX - rect.left - panX) / prevZoom
      const cy = (e.clientY - rect.top  - panY) / prevZoom
      zoomRef.current = newZoom
      panRef.current  = {
        x: e.clientX - rect.left - cx * newZoom,
        y: e.clientY - rect.top  - cy * newZoom,
      }
      rerender()
    }
    wrapper.addEventListener('wheel', onWheel, { passive: false })
    return () => wrapper.removeEventListener('wheel', onWheel)
  }, [rerender])

  // ── Drag (pan) + détection clic ──────────────────────────────────────────
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    dragRef.current = {
      startX: e.clientX, startY: e.clientY,
      startPanX: panRef.current.x, startPanY: panRef.current.y,
      moved: false,
    }
  }, [])

  useEffect(() => {
    function onMouseMove(e) {
      if (!dragRef.current) return
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      if (!dragRef.current.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        dragRef.current.moved = true
      }
      if (dragRef.current.moved) {
        panRef.current = {
          x: dragRef.current.startPanX + dx,
          y: dragRef.current.startPanY + dy,
        }
        rerender()
      }
    }

    function onMouseUp(e) {
      if (!dragRef.current) return
      if (!dragRef.current.moved) {
        const pixel = screenToPixel(e.clientX, e.clientY)
        if (pixel) onPixelClick(pixel.x, pixel.y)
      }
      dragRef.current = null
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup',   onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup',   onMouseUp)
    }
  }, [onPixelClick, gridSize, rerender])

  // ── Hover ────────────────────────────────────────────────────────────────
  const handleMouseMove = useCallback((e) => {
    const pixel = screenToPixel(e.clientX, e.clientY)
    const prev  = hoveredRef.current
    if (pixel?.x !== prev?.x || pixel?.y !== prev?.y) {
      hoveredRef.current = pixel
      drawOverlay()
    }
    // Tooltip
    const tooltip = tooltipRef.current
    if (!tooltip) return
    if (pixel) {
      tooltip.style.display = 'block'
      tooltip.style.left = `${e.clientX + 14}px`
      tooltip.style.top  = `${e.clientY + 14}px`
      tooltip.textContent = `${pixel.x}, ${pixel.y}`
    } else {
      tooltip.style.display = 'none'
    }
  }, [gridSize, drawOverlay])

  const handleMouseLeave = useCallback(() => {
    hoveredRef.current = null
    drawOverlay()
    if (tooltipRef.current) tooltipRef.current.style.display = 'none'
  }, [drawOverlay])

  // ── Touch : pan (1 doigt) + pinch-to-zoom (2 doigts) + tap ──────────────
  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return

    function pixelAt(clientX, clientY) {
      const rect = wrapper.getBoundingClientRect()
      const zoom = zoomRef.current
      const { x: panX, y: panY } = panRef.current
      const px = Math.floor((clientX - rect.left - panX) / (zoom * BASE_PX))
      const py = Math.floor((clientY - rect.top  - panY) / (zoom * BASE_PX))
      if (px < 0 || px >= gridSize || py < 0 || py >= gridSize) return null
      return { x: px, y: py }
    }

    function onTouchStart(e) {
      e.preventDefault()
      if (e.touches.length === 1) {
        const t = e.touches[0]
        touchRef.current = {
          mode: 'pan',
          startX: t.clientX, startY: t.clientY,
          startPanX: panRef.current.x, startPanY: panRef.current.y,
          moved: false,
        }
      } else if (e.touches.length === 2) {
        const t0 = e.touches[0], t1 = e.touches[1]
        const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY)
        const rect  = wrapper.getBoundingClientRect()
        touchRef.current = {
          mode: 'pinch',
          startDist: dist,
          startZoom: zoomRef.current,
          startPanX: panRef.current.x, startPanY: panRef.current.y,
          midX: (t0.clientX + t1.clientX) / 2 - rect.left,
          midY: (t0.clientY + t1.clientY) / 2 - rect.top,
        }
      }
    }

    function onTouchMove(e) {
      e.preventDefault()
      if (!touchRef.current) return

      if (touchRef.current.mode === 'pan' && e.touches.length === 1) {
        const t = e.touches[0]
        const dx = t.clientX - touchRef.current.startX
        const dy = t.clientY - touchRef.current.startY
        if (!touchRef.current.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
          touchRef.current.moved = true
        }
        if (touchRef.current.moved) {
          panRef.current = {
            x: touchRef.current.startPanX + dx,
            y: touchRef.current.startPanY + dy,
          }
          rerender()
        }
      } else if (touchRef.current.mode === 'pinch' && e.touches.length === 2) {
        const t0 = e.touches[0], t1 = e.touches[1]
        const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY)
        const scale = dist / touchRef.current.startDist
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, touchRef.current.startZoom * scale))
        const { midX, midY, startPanX, startPanY, startZoom } = touchRef.current
        const cx = (midX - startPanX) / startZoom
        const cy = (midY - startPanY) / startZoom
        zoomRef.current = newZoom
        panRef.current  = { x: midX - cx * newZoom, y: midY - cy * newZoom }
        rerender()
      }
    }

    function onTouchEnd(e) {
      e.preventDefault()
      if (!touchRef.current) return
      // Tap : 1 doigt, pas de mouvement
      if (touchRef.current.mode === 'pan' && !touchRef.current.moved && e.changedTouches.length === 1) {
        const t = e.changedTouches[0]
        const pixel = pixelAt(t.clientX, t.clientY)
        if (pixel) onPixelClick(pixel.x, pixel.y)
      }
      // Passage de 2 doigts à 1 : repasser en mode pan sans déclencher de tap
      if (e.touches.length === 1 && touchRef.current.mode === 'pinch') {
        const t = e.touches[0]
        touchRef.current = {
          mode: 'pan',
          startX: t.clientX, startY: t.clientY,
          startPanX: panRef.current.x, startPanY: panRef.current.y,
          moved: true,
        }
      } else {
        touchRef.current = null
      }
    }

    wrapper.addEventListener('touchstart',  onTouchStart, { passive: false })
    wrapper.addEventListener('touchmove',   onTouchMove,  { passive: false })
    wrapper.addEventListener('touchend',    onTouchEnd,   { passive: false })
    wrapper.addEventListener('touchcancel', onTouchEnd,   { passive: false })
    return () => {
      wrapper.removeEventListener('touchstart',  onTouchStart)
      wrapper.removeEventListener('touchmove',   onTouchMove)
      wrapper.removeEventListener('touchend',    onTouchEnd)
      wrapper.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [onPixelClick, gridSize, rerender])

  // ── Boutons zoom ─────────────────────────────────────────────────────────
  const applyZoom = useCallback((factor) => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const { width, height } = wrapper.getBoundingClientRect()
    const prevZoom = zoomRef.current
    const newZoom  = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prevZoom * factor))
    const { x: panX, y: panY } = panRef.current
    // Zoom centré sur le milieu de la zone
    const cx = (width  / 2 - panX) / prevZoom
    const cy = (height / 2 - panY) / prevZoom
    zoomRef.current = newZoom
    panRef.current  = {
      x: width  / 2 - cx * newZoom,
      y: height / 2 - cy * newZoom,
    }
    rerender()
  }, [rerender])

  const resetView = useCallback(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const { width, height } = wrapper.getBoundingClientRect()
    zoomRef.current = 1
    panRef.current  = {
      x: (width  - canvasSize) / 2,
      y: (height - canvasSize) / 2,
    }
    rerender()
  }, [canvasSize, rerender])

  const { x: panX, y: panY } = panRef.current
  const zoom = zoomRef.current

  const cursor = dragRef.current?.moved
    ? 'grabbing'
    : cooldown && !adminMode
      ? 'not-allowed'
      : adminMode
        ? 'crosshair'
        : 'crosshair'

  return (
    <>
      <div
        ref={wrapperRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          position: 'relative', width: '100%', height: '100%',
          overflow: 'hidden', background: 'var(--canvas-bg)',
          cursor,
        }}
      >
        {/* Canvas principal */}
        <canvas
          ref={canvasRef}
          width={canvasSize}
          height={canvasSize}
          style={canvasStyle(panX, panY, zoom)}
        />

        {/* Canvas overlay (grille + hover) */}
        <canvas
          ref={overlayRef}
          width={canvasSize}
          height={canvasSize}
          style={{ ...canvasStyle(panX, panY, zoom), pointerEvents: 'none' }}
        />

        {/* ── Contrôles zoom ── */}
        <div style={zoomControls}>
          <button style={zoomBtn} onClick={() => applyZoom(1.5)} title="Zoomer">＋</button>
          <button
            style={{ ...zoomBtn, fontSize: 10, minWidth: 42 }}
            onClick={resetView}
            title="Réinitialiser la vue"
          >
            ×{zoom.toFixed(1)}
          </button>
          <button style={zoomBtn} onClick={() => applyZoom(1 / 1.5)} title="Dézoomer">－</button>
        </div>
      </div>

      {/* Tooltip coordonnées */}
      <div ref={tooltipRef} style={tooltipStyle} />
    </>
  )
})

export default GridCanvas

// ── Styles statiques ─────────────────────────────────────────────────────────
function canvasStyle(panX, panY, zoom) {
  return {
    position: 'absolute', left: 0, top: 0,
    transformOrigin: '0 0',
    transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
    imageRendering: 'pixelated',
  }
}

const zoomControls = {
  position: 'absolute', bottom: 16, right: 16,
  display: 'flex', flexDirection: 'column', gap: 4,
  zIndex: 10,
}

const zoomBtn = {
  background: 'rgba(15,15,35,0.85)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 6,
  color: '#ccc',
  width: 32, minWidth: 32, height: 28,
  fontSize: 14, fontWeight: 700,
  cursor: 'pointer', display: 'flex', alignItems: 'center',
  justifyContent: 'center', fontFamily: 'inherit',
  backdropFilter: 'blur(4px)',
}

const tooltipStyle = {
  display: 'none',
  position: 'fixed',
  background: 'rgba(5,5,20,0.9)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#ccc',
  padding: '3px 9px',
  borderRadius: 5,
  fontSize: 11,
  fontFamily: 'monospace',
  pointerEvents: 'none',
  zIndex: 999,
  backdropFilter: 'blur(4px)',
}
