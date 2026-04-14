'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchTree, fetchUnlocks, fetchAvailable, unlockNode, type TreeNode } from '../api'
import { DEFAULT_COLORS } from '@features/canvas/store'
import { BEZEL_COLOR, BORDER_COLOR, ACCENT_BLUE, ACCENT_GREEN, ACCENT_RED } from '@features/hud/theme'

const ACCENT_YELLOW = '#e0af68'
const THIN = 12

interface Props {
  open:     boolean
  onClose:  () => void
}

const FEATURE_CATEGORIES: Record<string, string[]> = {
  'Placement': ['feature:highlight'],
  'Chat':      ['feature:chat_global', 'feature:chat_pixel'],
  'Stats':     ['feature:leaderboard', 'feature:stats', 'feature:dashboard', 'feature:profile'],
  'Analyse':   ['feature:pixel_blame', 'feature:search', 'feature:heatmap', 'feature:dashboard_global'],
  'Zone':      ['feature:zone_select', 'feature:zone_share', 'feature:zone_gif'],
  'Timelapse': ['feature:timelapse_personal', 'feature:timelapse_global'],
  'Canvas':    ['feature:minimap', 'feature:theme'],
}

function ConditionLabel({ cond }: { cond: Record<string, unknown> }) {
  const type = cond.type as string
  if (type === 'color_count')        return <span>{cond.min as number}× couleur {cond.colorId as number}</span>
  if (type === 'color_unlocked')     return <span>Couleur {cond.colorId as number} débloquée</span>
  if (type === 'feature_unlocked')   return <span>{(cond.nodeId as string).replace('feature:', '')} débloqué</span>
  if (type === 'pixels_placed')      return <span>{cond.min as number} pixels posés</span>
  if (type === 'pixels_lost')        return <span>{cond.min as number} pixels perdus</span>
  if (type === 'pixels_overwritten') return <span>{cond.min as number} pixels écrasés</span>
  if (type === 'days_played')        return <span>{cond.min as number} jours joués</span>
  if (type === 'zones_visited')      return <span>{cond.min as number} zones visitées</span>
  if (type === 'rank_top')           return <span>Top {cond.max as number} du leaderboard</span>
  if (type === 'color_each_unlocked') return <span>1× de chaque couleur débloquée</span>
  if (type === 'color_level4_any')   return <span>Au moins 1 couleur niveau 4</span>
  if (type === 'all_features_unlocked') return <span>Toutes les features débloquées</span>
  return <span>{type}</span>
}

export function UnlockPanel({ open, onClose }: Props) {
  const [tab,       setTab]       = useState<'colors' | 'features'>('colors')
  const [tree,      setTree]      = useState<TreeNode[]>([])
  const [streak,    setStreak]    = useState(0)
  const [available, setAvailable] = useState<Set<string>>(new Set())
  const [loading,   setLoading]   = useState(false)
  const [unlocking, setUnlocking] = useState<string | null>(null)
  const [error,     setError]     = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [treeData, unlocksData, availData] = await Promise.allSettled([
        fetchTree(),
        fetchUnlocks(),
        fetchAvailable(),
      ])
      if (treeData.status === 'fulfilled')    setTree(treeData.value)
      if (unlocksData.status === 'fulfilled') setStreak(unlocksData.value.streak_hours)
      if (availData.status === 'fulfilled')   setAvailable(new Set(availData.value))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (open) load() }, [open, load])

  async function handleUnlock(nodeId: string) {
    setUnlocking(nodeId)
    setError('')
    try {
      await unlockNode(nodeId)
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setUnlocking(null)
    }
  }

  const colors   = tree.filter(n => n.type === 'color')
  const byLevel  = [1, 2, 3, 4].map(lvl => colors.filter(n => n.level === lvl))
  const features = tree.filter(n => n.type === 'feature')
  const featMap  = Object.fromEntries(features.map(n => [n.nodeId, n]))

  return (
    <>
      {/* Overlay cliquable pour fermer */}
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 39 }}
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        style={{
          position:   'fixed',
          top:        THIN,
          right:      THIN,
          bottom:     THIN,
          width:      340,
          zIndex:     40,
          background: BEZEL_COLOR,
          borderLeft: `1px solid ${BORDER_COLOR}`,
          display:    'flex',
          flexDirection: 'column',
          transform:  open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 220ms ease',
          overflow:   'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding:        '16px 20px 12px',
          borderBottom:   `1px solid ${BORDER_COLOR}`,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          flexShrink:     0,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ color: ACCENT_BLUE, fontWeight: 700, fontSize: 14, fontFamily: 'monospace' }}>
              Arbre de compétences
            </span>
            <span style={{ color: ACCENT_YELLOW, fontSize: 12, fontFamily: 'monospace' }}>
              ⏱ {streak}h de streak
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: BORDER_COLOR, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = ACCENT_RED)}
            onMouseLeave={e => (e.currentTarget.style.color = BORDER_COLOR)}
          >✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${BORDER_COLOR}`, flexShrink: 0 }}>
          {(['colors', 'features'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex:         1,
                padding:      '10px 0',
                background:   tab === t ? `${ACCENT_BLUE}22` : 'transparent',
                border:       'none',
                borderBottom: tab === t ? `2px solid ${ACCENT_BLUE}` : '2px solid transparent',
                color:        tab === t ? ACCENT_BLUE : BORDER_COLOR,
                fontSize:     13,
                fontWeight:   tab === t ? 700 : 400,
                cursor:       'pointer',
              }}
            >
              {t === 'colors' ? 'Couleurs' : 'Features'}
            </button>
          ))}
        </div>

        {/* Erreur */}
        {error && (
          <div style={{ padding: '8px 20px', color: ACCENT_RED, fontSize: 12, flexShrink: 0 }}>
            {error}
          </div>
        )}

        {/* Contenu scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {loading && (
            <div style={{ color: BORDER_COLOR, fontSize: 13, textAlign: 'center', padding: '40px 0' }}>
              Chargement…
            </div>
          )}

          {/* ── Tab Couleurs ── */}
          {!loading && tab === 'colors' && byLevel.map((nodes, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ color: BORDER_COLOR, fontSize: 10, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.1em' }}>
                NIVEAU {i + 1}
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {nodes.map(node => {
                  const hex   = DEFAULT_COLORS[node.colorId ?? 0] ?? '#888'
                  const isAvail = available.has(node.nodeId)
                  return (
                    <div
                      key={node.nodeId}
                      style={{
                        width:        72,
                        display:      'flex',
                        flexDirection:'column',
                        alignItems:   'center',
                        gap:          4,
                      }}
                    >
                      {/* Swatch */}
                      <div style={{
                        width:        40,
                        height:       40,
                        borderRadius: 8,
                        background:   node.unlocked ? hex : '#1a1b26',
                        border:       `2px solid ${node.unlocked ? hex : isAvail ? ACCENT_GREEN : BORDER_COLOR}`,
                        display:      'flex',
                        alignItems:   'center',
                        justifyContent: 'center',
                        position:     'relative',
                        opacity:      node.unlocked ? 1 : 0.6,
                      }}>
                        {!node.unlocked && (
                          <span style={{ fontSize: 16 }}>🔒</span>
                        )}
                        {node.unlocked && (
                          <div style={{ width: 28, height: 28, borderRadius: 5, background: hex }} />
                        )}
                      </div>
                      {/* Nom */}
                      <span style={{ color: node.unlocked ? '#c0caf5' : BORDER_COLOR, fontSize: 10, textAlign: 'center' }}>
                        {node.name}
                      </span>
                      {/* Bouton unlock */}
                      {!node.unlocked && isAvail && (
                        <button
                          onClick={() => handleUnlock(node.nodeId)}
                          disabled={!!unlocking}
                          style={{
                            padding:      '2px 6px',
                            background:   `${ACCENT_GREEN}22`,
                            border:       `1px solid ${ACCENT_GREEN}`,
                            borderRadius: 4,
                            color:        ACCENT_GREEN,
                            fontSize:     10,
                            cursor:       'pointer',
                          }}
                        >
                          {unlocking === node.nodeId ? '…' : `${node.streakCost}h`}
                        </button>
                      )}
                      {/* Coût si non dispo */}
                      {!node.unlocked && !isAvail && node.streakCost > 0 && (
                        <span style={{ color: BORDER_COLOR, fontSize: 10 }}>{node.streakCost}h</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* ── Tab Features ── */}
          {!loading && tab === 'features' && Object.entries(FEATURE_CATEGORIES).map(([cat, nodeIds]) => {
            const nodes = nodeIds.map(id => featMap[id]).filter(Boolean)
            if (!nodes.length) return null
            return (
              <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ color: BORDER_COLOR, fontSize: 10, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.1em' }}>
                  {cat.toUpperCase()}
                </span>
                {nodes.map(node => {
                  const isAvail = available.has(node.nodeId)
                  return (
                    <div
                      key={node.nodeId}
                      style={{
                        background:   node.unlocked ? `${ACCENT_GREEN}11` : '#1a1b26',
                        border:       `1px solid ${node.unlocked ? ACCENT_GREEN : isAvail ? `${ACCENT_GREEN}66` : BORDER_COLOR}`,
                        borderRadius: 8,
                        padding:      '10px 12px',
                        display:      'flex',
                        alignItems:   'center',
                        gap:          10,
                      }}
                    >
                      {/* Icône */}
                      <span style={{ fontSize: 16, flexShrink: 0 }}>
                        {node.unlocked ? '✅' : isAvail ? '🔓' : '🔒'}
                      </span>

                      {/* Nom + conditions */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span style={{ color: node.unlocked ? '#c0caf5' : BORDER_COLOR, fontSize: 13, fontWeight: node.unlocked ? 600 : 400 }}>
                          {node.name}
                        </span>
                        {!node.unlocked && node.conditions.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {(node.conditions as Record<string, unknown>[]).slice(0, 2).map((c, i) => (
                              <span key={i} style={{ color: BORDER_COLOR, fontSize: 10 }}>
                                • <ConditionLabel cond={c} />
                              </span>
                            ))}
                            {node.conditions.length > 2 && (
                              <span style={{ color: BORDER_COLOR, fontSize: 10 }}>
                                +{node.conditions.length - 2} autres conditions
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Unlock / coût */}
                      {!node.unlocked && isAvail && (
                        <button
                          onClick={() => handleUnlock(node.nodeId)}
                          disabled={!!unlocking}
                          style={{
                            padding:      '4px 8px',
                            background:   `${ACCENT_GREEN}22`,
                            border:       `1px solid ${ACCENT_GREEN}`,
                            borderRadius: 6,
                            color:        ACCENT_GREEN,
                            fontSize:     11,
                            cursor:       'pointer',
                            flexShrink:   0,
                            fontWeight:   700,
                          }}
                        >
                          {unlocking === node.nodeId ? '…' : node.streakCost > 0 ? `${node.streakCost}h` : 'Débloquer'}
                        </button>
                      )}
                      {!node.unlocked && !isAvail && node.streakCost > 0 && (
                        <span style={{ color: BORDER_COLOR, fontSize: 11, flexShrink: 0 }}>{node.streakCost}h</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
