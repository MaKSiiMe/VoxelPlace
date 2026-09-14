'use client'

import { useState } from 'react'
import { toGridCoords, formatDisplayCoords } from '@features/canvas/coords'
import { pixelLink } from '@features/canvas/pixelLink'
import { Button, Field } from '@shared/ui'
import { adminApi } from '../api'
import type { AdminSession } from '../session'
import { ConfirmDialog } from './ConfirmDialog'
import { Notice, Panel } from './ui'

const GRID_SIZE = 2048
const HALF      = GRID_SIZE / 2

/** Coordonnées saisies (repère du HUD) → pixel de la grille, ou message d'erreur. */
export function parseDisplayInput(rawX: string, rawY: string): { x: number; y: number } | string {
  if (rawX.trim() === '' || rawY.trim() === '') return 'Renseigne X et Y.'
  const dx = Number(rawX), dy = Number(rawY)
  if (!Number.isInteger(dx) || !Number.isInteger(dy)) return 'X et Y sont des nombres entiers.'
  const grid = toGridCoords(dx, dy, GRID_SIZE)
  if (grid.x < 0 || grid.x >= GRID_SIZE || grid.y < 0 || grid.y >= GRID_SIZE) {
    return `X va de ${-HALF} à ${HALF - 1}, Y de ${-HALF + 1} à ${HALF}.`
  }
  return grid
}

export function CanvasSection({ session }: { session: AdminSession }) {
  const isSuperadmin = session.role === 'superadmin'
  const [rawX, setRawX] = useState('')
  const [rawY, setRawY] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)
  const [pending,  setPending]  = useState<{ x: number; y: number } | null>(null)
  const [dialog,   setDialog]   = useState<'restore' | 'clear' | null>(null)
  const [notice,   setNotice]   = useState<string | null>(null)

  const parsed = parseDisplayInput(rawX, rawY)

  return (
    <div className="flex flex-col gap-4">
      <Notice message={notice} />

      <Panel title="Effacer un pixel" description="Coordonnées telles qu’affichées en haut de l’écran de jeu. Le pixel redevient blanc partout, Minecraft compris.">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (typeof parsed === 'string') return setInputError(parsed)
            setInputError(null)
            setPending(parsed)
          }}
        >
          <div className="w-28"><Field label="X" inputMode="numeric" value={rawX} onChange={(e) => setRawX(e.target.value)} autoComplete="off" /></div>
          <div className="w-28"><Field label="Y" inputMode="numeric" value={rawY} onChange={(e) => setRawY(e.target.value)} autoComplete="off" /></div>
          <Button type="submit" variant="danger">Effacer…</Button>
          {typeof parsed !== 'string' && (
            <a href={pixelLink(parsed.x, parsed.y)} target="_blank" rel="noopener" className="h-10 content-center text-sm text-accent underline underline-offset-2">
              Voir ce pixel<span className="sr-only"> (nouvel onglet)</span>
            </a>
          )}
        </form>
        {inputError && <p role="alert" className="mt-2 text-sm text-danger">{inputError}</p>}
      </Panel>

      <Panel
        title="Restaurer la toile depuis l’historique"
        description="Reconstruit la grille à partir de pixel_history, si Redis a perdu ou corrompu la toile. Chaque pixel reprend sa dernière couleur connue."
        actions={<Button variant="secondary" disabled={!isSuperadmin} onClick={() => setDialog('restore')}>Restaurer…</Button>}
      >
        {!isSuperadmin && <p className="text-xs text-fg-subtle">Réservé à l’administrateur (connexion par mot de passe).</p>}
      </Panel>

      <Panel
        tone="danger"
        title="Vider la toile"
        description="Remet les 4 194 304 pixels à blanc pour tous les joueurs. L’historique est conservé : une restauration reste possible."
        actions={<Button variant="danger" disabled={!isSuperadmin} onClick={() => setDialog('clear')}>Vider la toile…</Button>}
      >
        {!isSuperadmin && <p className="text-xs text-fg-subtle">Réservé à l’administrateur (connexion par mot de passe).</p>}
      </Panel>

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        title="Effacer ce pixel ?"
        description={pending && <>Le pixel <span className="font-mono text-fg">{formatDisplayCoords(pending.x, pending.y)}</span> redevient blanc.</>}
        confirmLabel="Effacer"
        onConfirm={async () => {
          if (!pending) return
          const { previousOwner } = await adminApi.clearPixel(pending.x, pending.y)
          setNotice(`Pixel ${formatDisplayCoords(pending.x, pending.y)} effacé${previousOwner ? ` (il appartenait à ${previousOwner})` : ''}.`)
        }}
      />
      <ConfirmDialog
        open={dialog === 'restore'}
        onClose={() => setDialog(null)}
        title="Restaurer la toile ?"
        description="La grille actuelle est remplacée par celle reconstruite depuis l’historique. Tous les joueurs rechargent la toile."
        confirmLabel="Restaurer"
        onConfirm={async () => {
          const { restored } = await adminApi.restoreCanvas()
          setNotice(`Toile restaurée : ${restored.toLocaleString('fr-FR')} pixels.`)
        }}
      />
      <ConfirmDialog
        open={dialog === 'clear'}
        onClose={() => setDialog(null)}
        title="Vider toute la toile ?"
        description="Tous les pixels redeviennent blancs, sur le web et dans Minecraft, pour tous les joueurs connectés."
        confirmLabel="Vider la toile"
        typedConfirmation="VIDER"
        onConfirm={async () => {
          await adminApi.clearCanvas()
          setNotice('La toile a été vidée.')
        }}
      />
    </div>
  )
}
