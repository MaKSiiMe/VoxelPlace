// ── Génération d'un timelapse GIF ────────────────────────────────────────────

import { Worker } from 'node:worker_threads'
import { planGif, posesFromRows, GIF_MAX_FRAMES } from './frames.js'

export class GifBusyError extends Error {
  constructor() { super('Un GIF est déjà en cours de génération, réessaie dans quelques secondes') }
}

const WORKER_URL = new URL('./worker.js', import.meta.url)
const TIMEOUT_MS = 30_000

// Un seul encodage à la fois : chacun occupe un cœur. Sans limite, quelques
// requêtes simultanées suffiraient encore à saturer la machine.
const inFlight = new Set()

/**
 * @param {object[]} rows      poses { x, y, colorId } dans l'ordre chronologique
 * @param {{x,y,w,h}} zone     zone de la grille à rendre
 * @returns {Promise<{ buffer: Buffer, plan: object }>}
 */
export async function renderTimelapseGif(rows, zone, { scale = 1, fps = 10, timeoutMs = TIMEOUT_MS } = {}) {
  if (inFlight.size > 0) throw new GifBusyError()
  const job = Symbol('gif')
  inFlight.add(job)
  const plan = planGif({ w: zone.w, h: zone.h, scale })
  try {
    const poses = posesFromRows(rows)
    const bytes = await new Promise((resolve, reject) => {
      const worker = new Worker(WORKER_URL, {
        workerData: { poses, zone, plan, fps, maxFrames: GIF_MAX_FRAMES },
        transferList: [poses.xs.buffer, poses.ys.buffer, poses.colors.buffer],
      })
      const timer = setTimeout(() => {
        worker.terminate()
        reject(new Error('Génération du GIF trop longue'))
      }, timeoutMs)
      worker.once('message', (data) => { clearTimeout(timer); resolve(data) })
      worker.once('error',   (err)  => { clearTimeout(timer); reject(err) })
      worker.once('exit',    (code) => { clearTimeout(timer); if (code !== 0) reject(new Error(`Worker GIF arrêté (${code})`)) })
    })
    return { buffer: Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength), plan }
  } finally {
    inFlight.delete(job)
  }
}

/** Un encodage est-il en cours ? (tests) */
export function _isBusy() { return inFlight.size > 0 }
