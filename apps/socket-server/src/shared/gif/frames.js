// ── Images d'un timelapse GIF ────────────────────────────────────────────────
// Fonctions pures : aucune ne dépend d'un worker ni de la base, pour être
// testées directement.
//
// Les trois routes GIF construisaient chacune, par image, un tampon RGBA de
// (w × scale) × (h × scale) × 4 octets puis le quantifiaient : pour la toile
// entière, 17 Mo à scale=1 et 1 Go à scale=8, jusqu'à 200 fois. La palette
// étant fixe (16 couleurs), les images s'écrivent directement en index.

export const GIF_MAX_SIDE   = 1024   // côté maximal de l'image produite, en px
export const GIF_MAX_FRAMES = 100

/**
 * Dimensions du GIF pour une zone de w × h pixels de grille.
 * - Zone plus grande que GIF_MAX_SIDE : un pixel sur `step` est échantillonné.
 * - Sinon, le facteur d'agrandissement demandé est ramené sous la borne.
 */
export function planGif({ w, h, scale = 1 }) {
  const side = Math.max(w, h)
  const step = Math.max(1, Math.ceil(side / GIF_MAX_SIDE))
  const cols = Math.ceil(w / step)
  const rows = Math.ceil(h / step)
  const maxScale = Math.max(1, Math.floor(GIF_MAX_SIDE / Math.max(cols, rows)))
  const s = Math.min(Math.max(1, Math.floor(scale) || 1), maxScale)
  return { step, scale: s, cols, rows, width: cols * s, height: rows * s }
}

/**
 * Découpe les poses (dans l'ordre chronologique) en au plus `maxFrames` images.
 * Chaque image est un tableau d'index de palette de plan.width × plan.height.
 *
 * @param {{xs: ArrayLike<number>, ys: ArrayLike<number>, colors: ArrayLike<number>}} poses
 * @param {{x: number, y: number, w: number, h: number}} zone
 */
export function* timelapseFrames(poses, zone, plan, maxFrames = GIF_MAX_FRAMES) {
  const { x, y, w, h } = zone
  const total = poses.colors.length
  if (total === 0) return
  // Poses réparties uniformément sur exactement min(maxFrames, total) images ;
  // un arrondi du nombre de poses par image en perdait jusqu'à la moitié.
  const frames = Math.min(maxFrames, total)
  const canvas = new Uint8Array(w * h)
  let emitted = 0

  for (let i = 0; i < total; i++) {
    const lx = poses.xs[i] - x, ly = poses.ys[i] - y
    if (lx >= 0 && lx < w && ly >= 0 && ly < h) canvas[ly * w + lx] = poses.colors[i] & 0x0F

    if ((i + 1) * frames >= (emitted + 1) * total) {
      emitted++
      yield renderFrame(canvas, w, plan)
    }
  }
}

function renderFrame(canvas, w, { step, scale, cols, rows, width }) {
  const frame = new Uint8Array(width * rows * scale)
  for (let r = 0; r < rows; r++) {
    const line = new Uint8Array(width)
    const src = r * step * w
    for (let c = 0; c < cols; c++) {
      line.fill(canvas[src + c * step], c * scale, (c + 1) * scale)
    }
    for (let s = 0; s < scale; s++) frame.set(line, (r * scale + s) * width)
  }
  return frame
}

/** Poses PostgreSQL → tableaux typés, transférables vers un worker sans copie. */
export function posesFromRows(rows) {
  const xs = new Uint16Array(rows.length)
  const ys = new Uint16Array(rows.length)
  const colors = new Uint8Array(rows.length)
  rows.forEach((row, i) => { xs[i] = row.x; ys[i] = row.y; colors[i] = row.colorId })
  return { xs, ys, colors }
}
