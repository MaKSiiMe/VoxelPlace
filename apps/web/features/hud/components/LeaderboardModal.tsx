'use client'

import { useState, useEffect } from 'react'
import { BEZEL_COLOR, BORDER_COLOR, ACCENT_RED, ACCENT_GREEN } from '../theme'
import { DEFAULT_COLORS } from '@features/canvas/store'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const ACCENT_YELLOW = '#e0af68'

interface LeaderboardEntry {
  rank:           number
  username:       string
  pixels_placed:  number
  colors_used:    number
  favorite_color: number
  last_active:    string
}

interface Props {
  onClose: () => void
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)   return 'À l\'instant'
  if (m < 60)  return `${m}min`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h`
  return `${Math.floor(h / 24)}j`
}

function RankBadge({ rank }: { rank: number }) {
  const colors: Record<number, string> = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' }
  const color = colors[rank] ?? BORDER_COLOR
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, color, border: `1px solid ${color}`,
      borderRadius: 4, padding: '1px 6px', fontFamily: 'monospace', minWidth: 28,
      textAlign: 'center', flexShrink: 0,
    }}>
      #{rank}
    </span>
  )
}

export function LeaderboardModal({ onClose }: Props) {
  const [rows,    setRows]    = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    fetch(`${API}/api/leaderboard?limit=20`)
      .then(r => r.json())
      .then(d => setRows(d.leaderboard ?? []))
      .catch(() => setError('Impossible de charger le leaderboard'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div
      style={{ position:'fixed', inset:0, zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)' }}
      onClick={onClose}
    >
      <div
        style={{ background:BEZEL_COLOR, border:`1px solid ${BORDER_COLOR}`, borderRadius:12, padding:28, width:440, maxHeight:'80vh', display:'flex', flexDirection:'column', gap:16 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:18 }}>🏆</span>
            <span style={{ color:ACCENT_YELLOW, fontWeight:700, fontSize:16, fontFamily:'monospace' }}>Leaderboard</span>
          </div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:BORDER_COLOR, cursor:'pointer', fontSize:18, lineHeight:1, padding:0 }}
            onMouseEnter={e => (e.currentTarget.style.color = ACCENT_RED)}
            onMouseLeave={e => (e.currentTarget.style.color = BORDER_COLOR)}>✕</button>
        </div>

        {/* Contenu */}
        <div style={{ overflowY:'auto', display:'flex', flexDirection:'column', gap:6 }}>
          {loading && <div style={{ color:BORDER_COLOR, fontSize:13, textAlign:'center', padding:'32px 0' }}>Chargement…</div>}
          {error   && <div style={{ color:ACCENT_RED, fontSize:13, textAlign:'center' }}>{error}</div>}
          {!loading && rows.length === 0 && (
            <div style={{ color:BORDER_COLOR, fontSize:13, textAlign:'center', padding:'32px 0' }}>
              Aucun joueur pour le moment — soyez le premier !
            </div>
          )}

          {rows.map(row => {
            const fav = DEFAULT_COLORS[row.favorite_color] ?? '#888'
            return (
              <div key={row.username} style={{
                display:'flex', alignItems:'center', gap:10, padding:'8px 12px',
                background: row.rank <= 3 ? `${ACCENT_YELLOW}11` : '#1a1b26',
                border:`1px solid ${row.rank <= 3 ? `${ACCENT_YELLOW}44` : BORDER_COLOR}`,
                borderRadius:8,
              }}>
                <RankBadge rank={row.rank} />

                {/* Couleur favorite */}
                <div style={{ width:14, height:14, borderRadius:3, background:fav, flexShrink:0, border:`1px solid ${BORDER_COLOR}` }} />

                {/* Username */}
                <span style={{ color:'#c0caf5', fontSize:13, fontWeight:600, flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {row.username}
                </span>

                {/* Pixels */}
                <span style={{ color:ACCENT_GREEN, fontFamily:'monospace', fontSize:12, flexShrink:0 }}>
                  {row.pixels_placed.toLocaleString()} px
                </span>

                {/* Last active */}
                <span style={{ color:BORDER_COLOR, fontSize:11, flexShrink:0, minWidth:36, textAlign:'right' }}>
                  {timeAgo(row.last_active)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
