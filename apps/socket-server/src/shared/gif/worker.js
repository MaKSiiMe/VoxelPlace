// ── Encodage GIF hors de la boucle d'événements ──────────────────────────────
// Exécuté dans un worker thread : même borné, l'encodage de 100 images de
// 1024 × 1024 prend plusieurs centaines de millisecondes. Dans le thread
// principal, ce temps suspend le temps réel de tous les joueurs.

import { parentPort, workerData } from 'node:worker_threads'
import gifenc from 'gifenc'
import { PALETTE_RGB } from '../palette.js'
import { timelapseFrames } from './frames.js'

const { GIFEncoder } = gifenc
const { poses, zone, plan, fps, maxFrames } = workerData

const gif   = GIFEncoder()
const delay = Math.round(1000 / fps)
let first = true
for (const frame of timelapseFrames(poses, zone, plan, maxFrames)) {
  // Palette globale écrite une fois : toutes les images partagent les 16 couleurs
  gif.writeFrame(frame, plan.width, plan.height, first ? { palette: PALETTE_RGB, delay } : { delay })
  first = false
}
gif.finish()
const bytes = gif.bytes()
parentPort.postMessage(bytes, [bytes.buffer])
