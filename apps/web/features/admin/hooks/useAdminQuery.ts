'use client'

import { useCallback, useEffect, useState } from 'react'

export type QueryState<T> =
  | { status: 'loading'; data?: T }
  | { status: 'error'; error: string; data?: T }
  | { status: 'ready'; data: T }

/**
 * Charge une ressource d'administration et la recharge à la demande.
 * Un nouveau chargement annule le précédent : une réponse lente ne peut pas
 * écraser une réponse plus récente (changement de filtre, par exemple).
 */
export function useAdminQuery<T>(load: (signal: AbortSignal) => Promise<T>, deps: unknown[]) {
  const [state, setState]     = useState<QueryState<T>>({ status: 'loading' })
  const [version, setVersion] = useState(0)
  const reload = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    setState((prev) => ({ status: 'loading', data: prev.data }))
    load(controller.signal)
      .then((data) => { if (!controller.signal.aborted) setState({ status: 'ready', data }) })
      .catch((err) => {
        if (controller.signal.aborted) return
        setState((prev) => ({ status: 'error', error: err instanceof Error ? err.message : 'Erreur', data: prev.data }))
      })
    return () => controller.abort()
  }, [version, ...deps]) // eslint-disable-line react-hooks/exhaustive-deps

  return { state, reload }
}
