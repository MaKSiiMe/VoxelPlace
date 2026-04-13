import { ImageResponse } from 'next/og'

export const runtime   = 'edge'
export const revalidate = 86400          // regénère toutes les 24h
export const size      = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Palette canonique — source de vérité (sync avec shared/palette.js)
const PALETTE = [
  '#FFFFFF', // 0  blanc
  '#AAAAAA', // 1  gris clair
  '#888888', // 2  gris
  '#000000', // 3  noir
  '#884422', // 4  marron
  '#FF4444', // 5  rouge
  '#FF8800', // 6  orange
  '#FFFF00', // 7  jaune
  '#88CC22', // 8  vert clair
  '#00AA00', // 9  vert
  '#00AAAA', // 10 cyan
  '#44AAFF', // 11 bleu clair
  '#4444FF', // 12 bleu
  '#AA00AA', // 13 violet
  '#FF44FF', // 14 magenta
  '#FF88AA', // 15 rose
]

const GRID_SIZE = 2048
// Output : 1200×630 px, chaque px JSX = 1px de l'image finale
const OUT_W = 1200
const OUT_H = 630
// Zone canvas à afficher : pleine largeur (2048), crop vertical centré
// 2048 * (630/1200) = 1075 lignes canvas → crop du centre
const CANVAS_ROWS_SHOWN = Math.round(GRID_SIZE * (OUT_H / OUT_W))  // ~1075
const CANVAS_ROW_OFFSET = Math.floor((GRID_SIZE - CANVAS_ROWS_SHOWN) / 2) // ~486

export default async function OgImage() {
  let grid: number[] | null = null

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
    const res    = await fetch(`${apiUrl}/api/grid`, { cache: 'no-store' })
    if (res.ok) {
      const data = await res.json()
      grid = data.grid as number[]
    }
  } catch {
    // canvas vide si l'API est indisponible
  }

  // RLE par ligne : groupe les pixels consécutifs de même couleur
  // Canvas vide → 512 spans, canvas actif → quelques milliers max
  type Span = { color: string; width: number }
  const rows: Span[][] = []

  for (let outRow = 0; outRow < OUT_H; outRow++) {
    // Mapper chaque ligne output → ligne canvas (Y inversé : Y=0 est en bas du canvas)
    const canvasY = Math.round(CANVAS_ROW_OFFSET + CANVAS_ROWS_SHOWN - 1 - outRow * CANVAS_ROWS_SHOWN / OUT_H)

    const spans: Span[] = []
    let currentColor = ''
    let runLen = 0

    for (let outCol = 0; outCol < OUT_W; outCol++) {
      // Mapper chaque colonne output → colonne canvas
      const canvasX = Math.round(outCol * GRID_SIZE / OUT_W)
      const idx = canvasY * GRID_SIZE + canvasX
      const colorId = grid ? (grid[idx] & 0x0F) : 0
      const color = PALETTE[colorId] ?? '#FFFFFF'

      if (color === currentColor) {
        runLen++
      } else {
        if (runLen > 0) spans.push({ color: currentColor, width: runLen })
        currentColor = color
        runLen = 1
      }
    }
    if (runLen > 0) spans.push({ color: currentColor, width: runLen })
    rows.push(spans)
  }

  return new ImageResponse(
    (
      <div
        style={{
          display:         'flex',
          flexDirection:   'column',
          width:           1200,
          height:          630,
          backgroundColor: '#1a1b26',
          position:        'relative',
        }}
      >
        {/* Canvas pleine largeur 1200×630, crop vertical centré */}
        <div
          style={{
            display:       'flex',
            flexDirection: 'column',
            position:      'absolute',
            top:           0,
            left:          0,
            width:         OUT_W,
            height:        OUT_H,
          }}
        >
          {rows.map((spans, rowIdx) => (
            <div key={rowIdx} style={{ display: 'flex', height: 1 }}>
              {spans.map((span, spanIdx) => (
                <div
                  key={spanIdx}
                  style={{ width: span.width, height: 1, backgroundColor: span.color }}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Overlay gradient pleine largeur en bas */}
        <div
          style={{
            display:    'flex',
            position:   'absolute',
            bottom:     0,
            left:       0,
            width:      1200,
            height:     200,
            background: 'linear-gradient(to top, rgba(26,27,38,1) 0%, rgba(26,27,38,0.6) 60%, transparent 100%)',
          }}
        />

        {/* Titre en bas à gauche */}
        <div
          style={{
            display:       'flex',
            flexDirection: 'column',
            position:      'absolute',
            bottom:        40,
            left:          48,
          }}
        >
          <span style={{ color: '#c0caf5', fontSize: 56, fontWeight: 700, lineHeight: 1.1 }}>
            VoxelPlace
          </span>
          <span style={{ color: '#a9b1d6', fontSize: 24, marginTop: 8 }}>
            Canvas collaboratif multijoueur en temps réel
          </span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
