'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Button, Dialog, Field } from '@shared/ui'

interface Props {
  open:          boolean
  onClose:       () => void
  title:         string
  description:   ReactNode
  confirmLabel:  string
  onConfirm:     () => Promise<void>
  /** Mot à recopier pour confirmer une action irréversible. */
  typedConfirmation?: string
}

/**
 * Confirmation d'une action de modération. Remplace window.confirm(), qui ne
 * disait rien de la portée de l'action et se validait d'un Entrée machinal.
 */
export function ConfirmDialog({ open, onClose, title, description, confirmLabel, onConfirm, typedConfirmation }: Props) {
  const [typed, setTyped] = useState('')
  const [busy,  setBusy]  = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { if (open) { setTyped(''); setError(null) } }, [open])

  const armed = !typedConfirmation || typed.trim() === typedConfirmation

  async function confirm() {
    if (!armed || busy) return
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action impossible')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={title} size="sm">
      <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void confirm() }}>
        <div className="text-sm text-fg-muted">{description}</div>
        {typedConfirmation && (
          <Field
            label={`Tape « ${typedConfirmation} » pour confirmer`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        )}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="danger" disabled={!armed || busy}>{busy ? 'En cours…' : confirmLabel}</Button>
        </div>
      </form>
    </Dialog>
  )
}
