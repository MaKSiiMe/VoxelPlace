'use client'

import { useEffect } from 'react'
import { socket } from '@features/realtime/socket'
import { useAuthStore } from '@features/auth/store'
import { useUnlocksStore } from '../store'

/**
 * Tient la progression à jour : au chargement, à chaque connexion ou
 * déconnexion (la palette d'un visiteur est celle d'un compte neuf), et quand
 * le serveur annonce un déblocage.
 */
export function useUnlocksSync() {
  const token = useAuthStore((s) => s.token)
  const load  = useUnlocksStore((s) => s.load)

  useEffect(() => { void load() }, [token, load])

  useEffect(() => {
    const onUnlocks = () => { void load() }
    socket.on('unlocks:new', onUnlocks)
    return () => { socket.off('unlocks:new', onUnlocks) }
  }, [load])
}
