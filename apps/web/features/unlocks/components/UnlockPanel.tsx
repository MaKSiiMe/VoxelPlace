'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { DEFAULT_COLORS } from '@features/canvas/store'
import { useHudStore } from '@features/hud/store'
import { Button, Dialog, cn, LockIcon } from '@shared/ui'
import { useUnlocksStore } from '../store'
import { nodeStatus, PALETTE_SIZE, type NodeStatus } from '../progress'
import type { TreeNode } from '../api'
import { ConditionList } from './ConditionList'

interface Props {
  open:    boolean
  onClose: () => void
}

type Tab = 'colors' | 'features'

const TABS: { id: Tab; label: string }[] = [
  { id: 'colors',   label: 'Couleurs' },
  { id: 'features', label: 'Fonctionnalités' },
]

const LEVELS: { level: number; title: string }[] = [
  { level: 1, title: 'Niveau 1 — offertes à l’inscription' },
  { level: 2, title: 'Niveau 2 — mélanges primaires' },
  { level: 3, title: 'Niveau 3' },
  { level: 4, title: 'Niveau 4 — nuances' },
]

const FEATURE_GROUPS: { title: string; nodeIds: string[] }[] = [
  { title: 'Zone et partage', nodeIds: ['feature:zone_select', 'feature:zone_share', 'feature:zone_gif'] },
  { title: 'Timelapse',       nodeIds: ['feature:timelapse_personal', 'feature:timelapse_global'] },
  { title: 'Analyse',         nodeIds: ['feature:heatmap', 'feature:search', 'feature:dashboard_global'] },
  { title: 'Profil',          nodeIds: ['feature:dashboard', 'feature:profile'] },
  { title: 'Affichage',       nodeIds: ['feature:highlight', 'feature:theme'] },
]

/**
 * Arbre de progression : couleurs à débloquer, puis fonctionnalités.
 *
 * Remplace un tiroir latéral en styles inline (ancien thème) qui n'affichait
 * que les deux premières conditions d'un nœud, désignait les couleurs par leur
 * numéro et vendait des fonctionnalités sans interface.
 */
export function UnlockPanel({ open, onClose }: Props) {
  const { status, tree, colors, streak, load } = useUnlocksStore()
  const focusNode = useHudStore((s) => s.focusNode)
  const [tab, setTab] = useState<Tab>('colors')
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ colors: null, features: null })
  const baseId  = useId()

  useEffect(() => { if (open) void load() }, [open, load])

  // Ouvert depuis une couleur verrouillée : on montre son nœud
  useEffect(() => {
    if (!open || !focusNode) return
    setTab(focusNode.startsWith('feature:') ? 'features' : 'colors')
  }, [open, focusNode])
  useEffect(() => {
    if (!open || !focusNode || tree.length === 0) return
    const el = [...document.querySelectorAll<HTMLElement>('[data-node]')].find((n) => n.dataset.node === focusNode)
    el?.scrollIntoView({ block: 'center' })
  }, [open, focusNode, tree, tab])

  function onTabKey(e: KeyboardEvent) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const next = tab === 'colors' ? 'features' : 'colors'
    setTab(next)
    tabRefs.current[next]?.focus()
  }

  const colorNodes   = tree.filter((n) => n.type === 'color')
  const featureNodes = tree.filter((n) => n.type === 'feature')
  const unlockedColorCount = colorNodes.filter((n) => n.unlocked).length
  // Un rôle de confiance pose les 16 couleurs sans les avoir débloquées
  const roleGrantsAll = (colors?.length ?? 0) === PALETTE_SIZE && unlockedColorCount < PALETTE_SIZE

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Progression"
      description="Pose des pixels pour remplir les conditions, puis dépense tes heures de streak."
    >
      {status === 'error' && tree.length === 0 && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-control bg-danger/10 p-3 text-sm text-danger">
          Impossible de charger ta progression.
          <Button size="sm" variant="secondary" onClick={() => void load()}>Réessayer</Button>
        </div>
      )}
      {status !== 'error' && tree.length === 0 && (
        <p role="status" className="py-10 text-center text-sm text-fg-muted">Chargement…</p>
      )}

      {tree.length > 0 && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-2">
            <Summary label="Streak disponible" value={`${streak ?? 0} h`} />
            <Summary label="Couleurs débloquées" value={`${unlockedColorCount}/${colorNodes.length}`} />
          </div>
          <p className="-mt-2 text-xs text-fg-subtle">
            Chaque heure où tu poses au moins un pixel ajoute 1 h de streak ; 24 h sans pixel le remettent à zéro.
            Débloquer une couleur dépense ces heures.
            {roleGrantsAll && ' Ton rôle te donne déjà les 16 couleurs : cette progression reste celle de ton compte.'}
          </p>

          <div role="tablist" aria-label="Catégorie" className="grid grid-cols-2 gap-1 rounded-control bg-bg p-1">
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
                onClick={() => setTab(t.id)}
                onKeyDown={onTabKey}
                className={cn(
                  'h-8 rounded-md text-sm font-medium transition-colors duration-150',
                  tab === t.id ? 'bg-surface-2 text-fg shadow-sm' : 'text-fg-muted hover:text-fg',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div id={`${baseId}-panel`} role="tabpanel" aria-labelledby={`${baseId}-tab-${tab}`} className="flex flex-col gap-6">
            {tab === 'colors' && LEVELS.map(({ level, title }) => {
              const nodes = colorNodes.filter((n) => n.level === level)
              if (nodes.length === 0) return null
              return (
                <NodeGroup key={level} title={title}>
                  {nodes.map((node) => (
                    <NodeCard key={node.nodeId} node={node} tree={tree} streak={streak} focused={node.nodeId === focusNode} />
                  ))}
                </NodeGroup>
              )
            })}

            {tab === 'features' && (
              <>
                {featureNodes.some((n) => n.comingSoon) && (
                  <p className="rounded-control bg-surface-2 p-3 text-xs text-fg-muted">
                    Les fonctionnalités marquées « À venir » n’ont pas encore d’interface : elles ne se débloquent pas
                    et ne te coûteront rien tant qu’elles ne sont pas disponibles.
                  </p>
                )}
                {groupFeatures(featureNodes).map(({ title, nodes }) => (
                  <NodeGroup key={title} title={title}>
                    {nodes.map((node) => (
                      <NodeCard key={node.nodeId} node={node} tree={tree} streak={streak} focused={node.nodeId === focusNode} />
                    ))}
                  </NodeGroup>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </Dialog>
  )
}

/** Regroupe les fonctionnalités par thème ; une fonctionnalité non classée n'est pas perdue pour autant. */
export function groupFeatures(nodes: readonly TreeNode[]) {
  const byId   = new Map(nodes.map((n) => [n.nodeId, n]))
  const placed = new Set<string>()
  const groups = FEATURE_GROUPS.map(({ title, nodeIds }) => {
    const found = nodeIds.flatMap((id) => byId.get(id) ?? [])
    found.forEach((n) => placed.add(n.nodeId))
    return { title, nodes: found }
  })
  groups.push({ title: 'Autres', nodes: nodes.filter((n) => !placed.has(n.nodeId)) })
  return groups.filter((g) => g.nodes.length > 0)
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-control bg-surface-2 px-3 py-2.5">
      <span className="text-xs text-fg-subtle">{label}</span>
      <span className="font-mono text-lg tabular-nums text-fg">{value}</span>
    </div>
  )
}

function NodeGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-subtle">{title}</h3>
      <div className="grid items-start gap-2 sm:grid-cols-2">{children}</div>
    </section>
  )
}

const BADGE: Record<NodeStatus, { label: string; className: string } | null> = {
  unlocked:     { label: 'Débloquée', className: 'bg-success/15 text-success' },
  coming_soon:  { label: 'À venir',   className: 'bg-surface-2 text-fg-muted' },
  ready:        { label: 'Prête',     className: 'bg-accent/15 text-accent' },
  needs_streak: null,
  locked:       null,
}

function NodeCard({ node, tree, streak, focused }: { node: TreeNode; tree: readonly TreeNode[]; streak: number | null; focused: boolean }) {
  const unlock = useUnlocksStore((s) => s.unlock)
  const [busy,  setBusy]  = useState(false)
  const [error, setError] = useState<string | null>(null)
  const status = nodeStatus(node, streak)
  const badge  = BADGE[status]
  const isFeature = node.type === 'feature'

  async function handleUnlock() {
    setBusy(true)
    setError(null)
    try {
      await unlock(node.nodeId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Déblocage impossible')
    } finally {
      setBusy(false)
    }
  }

  return (
    <article
      data-node={node.nodeId}
      aria-label={`${node.name}${badge ? `, ${badge.label.toLowerCase()}` : ''}`}
      className={cn(
        'flex flex-col gap-2.5 rounded-control border p-3',
        status === 'ready' ? 'border-accent/60' : 'border-line',
        status === 'coming_soon' && 'opacity-80',
        focused && 'outline-2 outline-offset-2 outline-warning',
      )}
    >
      <div className="flex items-center gap-2.5">
        {!isFeature && node.colorId !== null && (
          <span
            className="relative grid size-7 shrink-0 place-items-center rounded-md"
            style={{ backgroundColor: DEFAULT_COLORS[node.colorId], boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / .2)' }}
            aria-hidden="true"
          >
            {!node.unlocked && (
              <span className="grid size-4 place-items-center rounded-full bg-bg/80 text-fg [&>svg]:size-2.5"><LockIcon /></span>
            )}
          </span>
        )}
        <span className={cn('min-w-0 flex-1 text-sm font-medium', node.unlocked ? 'text-fg' : 'text-fg-muted')}>{node.name}</span>
        {badge && <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium', badge.className)}>{badge.label}</span>}
        {!badge && node.streakCost > 0 && (
          <span className="shrink-0 font-mono text-xs tabular-nums text-fg-subtle">{node.streakCost} h</span>
        )}
      </div>

      {!node.unlocked && <ConditionList node={node} tree={tree} streak={streak} />}

      {status === 'needs_streak' && (
        <p className="text-xs text-warning">
          Il te manque {node.streakCost - (streak ?? 0)} h de streak.
        </p>
      )}
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      {status === 'ready' && (
        <Button size="sm" variant="primary" className="self-start" onClick={handleUnlock} disabled={busy}>
          {busy ? 'Déblocage…' : node.streakCost > 0 ? `Débloquer · ${node.streakCost} h` : 'Débloquer'}
        </Button>
      )}
    </article>
  )
}
