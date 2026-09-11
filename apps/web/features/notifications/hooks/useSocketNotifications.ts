'use client'

import { useEffect } from 'react'
import { socket } from '@features/realtime/socket'
import { notify } from '../store'
import {
  overwrittenNotification, unlockNotifications, bannedNotification, gridErrorNotification,
  type OverwrittenPayload, type UnlocksPayload, type BannedPayload, type GridErrorPayload,
} from '../socketEvents'

/** Branche les événements serveur sur les notifications. À monter une fois, dans la page de jeu. */
export function useSocketNotifications() {
  useEffect(() => {
    const onOverwritten = (p: OverwrittenPayload) => notify(overwrittenNotification(p))
    const onUnlocks     = (p: UnlocksPayload)     => unlockNotifications(p).forEach(notify)
    const onBanned      = (p: BannedPayload)      => notify(bannedNotification(p))
    const onGridError   = (p: GridErrorPayload)   => notify(gridErrorNotification(p))

    socket.on('pixel:overwritten', onOverwritten)
    socket.on('unlocks:new',       onUnlocks)
    socket.on('banned',            onBanned)
    socket.on('grid:error',        onGridError)

    return () => {
      // Retrait ciblé : socket.off('event') sans handler retirerait aussi les
      // écouteurs posés par d'autres hooks sur le même événement.
      socket.off('pixel:overwritten', onOverwritten)
      socket.off('unlocks:new',       onUnlocks)
      socket.off('banned',            onBanned)
      socket.off('grid:error',        onGridError)
    }
  }, [])
}
