'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Button, cn } from '@shared/ui'
import { adminApi } from '../api'
import { useAdminQuery } from '../hooks/useAdminQuery'
import type { AdminSession } from '../session'
import { CanvasSection } from './CanvasSection'
import { LogsSection } from './LogsSection'
import { PlayersSection } from './PlayersSection'
import { ReportsSection } from './ReportsSection'
import { StatsSection } from './StatsSection'
import { RoleBadge } from './ui'

export type AdminTab = 'signalements' | 'joueurs' | 'toile' | 'journal' | 'statistiques'

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'signalements', label: 'Signalements' },
  { id: 'joueurs',      label: 'Joueurs' },
  { id: 'toile',        label: 'Toile' },
  { id: 'journal',      label: 'Journal' },
  { id: 'statistiques', label: 'Statistiques' },
]

const isTab = (value: string): value is AdminTab => TABS.some((t) => t.id === value)

interface Props {
  session:  AdminSession
  onLogout: () => void
}

/**
 * Tableau de bord de modération. Il n'exposait que la restauration du canvas :
 * signalements, bannissements, rôles et journaux n'étaient accessibles qu'en
 * appelant l'API à la main.
 */
export function AdminDashboard({ session, onLogout }: Props) {
  const [tab, setTab] = useState<AdminTab>('signalements')
  const tabRefs = useRef<Partial<Record<AdminTab, HTMLButtonElement | null>>>({})
  const baseId  = useId()
  const pending = useAdminQuery((signal) => adminApi.reports('pending', signal), [])
  const pendingCount = pending.state.data?.length ?? 0

  // L'onglet vit dans l'ancre (#joueurs) : un rechargement ou un lien partagé y ramène
  useEffect(() => {
    const fromHash = window.location.hash.slice(1)
    if (isTab(fromHash)) setTab(fromHash)
  }, [])
  function select(next: AdminTab, focus = false) {
    setTab(next)
    history.replaceState(null, '', `#${next}`)
    if (focus) tabRefs.current[next]?.focus()
  }
  function onTabKey(e: KeyboardEvent) {
    const i = TABS.findIndex((t) => t.id === tab)
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    e.preventDefault()
    select(TABS[(i + step + TABS.length) % TABS.length].id, true)
  }

  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <p className="text-sm font-semibold text-fg">
            VoxelPlace <span className="font-normal text-fg-subtle">· Modération</span>
          </p>
          <div className="ml-auto flex items-center gap-2 text-sm">
            <span className="hidden text-fg-muted sm:inline">{session.username ?? 'Mot de passe admin'}</span>
            <RoleBadge role={session.role} />
            <a href="/" className="ml-1 inline-flex h-8 items-center whitespace-nowrap rounded-control px-2.5 text-xs font-medium text-fg-muted hover:bg-surface-2 hover:text-fg">
              Retour à la toile
            </a>
            {!session.username && <Button size="sm" variant="ghost" className="whitespace-nowrap px-2.5" onClick={onLogout}>Se déconnecter</Button>}
          </div>
        </div>
        <div className="mx-auto max-w-6xl overflow-x-auto px-4">
          <div role="tablist" aria-label="Sections de modération" className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                ref={(el) => { tabRefs.current[t.id] = el }}
                type="button"
                role="tab"
                id={`${baseId}-tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`${baseId}-panel`}
                tabIndex={tab === t.id ? 0 : -1}
                onClick={() => select(t.id)}
                onKeyDown={onTabKey}
                className={cn(
                  'relative flex h-10 shrink-0 items-center gap-2 px-3 text-sm font-medium transition-colors',
                  tab === t.id ? 'text-fg after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accent' : 'text-fg-muted hover:text-fg',
                )}
              >
                {t.label}
                {t.id === 'signalements' && pendingCount > 0 && (
                  <span className="rounded-full bg-warning/20 px-1.5 text-[11px] font-semibold tabular-nums text-warning">
                    {pendingCount}<span className="sr-only"> à traiter</span>
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main id={`${baseId}-panel`} role="tabpanel" aria-labelledby={`${baseId}-tab-${tab}`} className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="sr-only">Modération VoxelPlace</h1>
        {tab === 'signalements' && <ReportsSection onChanged={pending.reload} />}
        {tab === 'joueurs'      && <PlayersSection session={session} />}
        {tab === 'toile'        && <CanvasSection session={session} />}
        {tab === 'journal'      && <LogsSection />}
        {tab === 'statistiques' && <StatsSection />}
      </main>
    </div>
  )
}
