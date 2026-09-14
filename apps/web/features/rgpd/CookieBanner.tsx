'use client'

import { useEffect, useState } from 'react'
import { Button } from '@shared/ui'

const STORAGE_KEY = 'voxelplace:cookies-consent'

/**
 * Information sur le stockage local.
 *
 * Le bandeau proposait « Accepter » ou « Refuser », mais refuser ne changeait
 * rien : le stockage local ne sert qu'à garder la session ouverte, ce que le
 * site fait dans tous les cas. Ce stockage étant strictement nécessaire, il est
 * exempté de consentement (CNIL) ; offrir un choix qui n'est pas respecté
 * induisait en erreur. Il reste une information, qui ne recouvre plus la
 * palette ni le bouton de connexion.
 */
export function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
    } catch { /* stockage indisponible : rien à mémoriser, rien à annoncer */ }
  }, [])

  function dismiss() {
    try { localStorage.setItem(STORAGE_KEY, 'acknowledged') } catch { /* navigation privée stricte */ }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <aside
      aria-label="Information sur le stockage local"
      // Sur mobile, sous la barre du haut : en bas, il recouvrait la palette dès
      // qu'elle s'agrandit (conditions d'une couleur verrouillée, cooldown).
      className="fixed inset-x-3 top-[72px] z-50 flex flex-col gap-3 rounded-panel bg-surface p-4 shadow-float md:inset-x-auto md:top-auto md:bottom-3 md:left-3 md:max-w-sm"
    >
      <p className="text-sm text-fg-muted">
        VoxelPlace garde ta session ouverte grâce au stockage local de ton navigateur.
        Aucun cookie tiers, aucun traceur.{' '}
        <a href="/privacy" className="text-accent underline underline-offset-2">En savoir plus</a>
      </p>
      <Button size="sm" onClick={dismiss} className="self-end">Compris</Button>
    </aside>
  )
}
