'use client'

import { useState, useEffect } from 'react'
import { BEZEL_COLOR, BORDER_COLOR, ACCENT_BLUE, ACCENT_RED, ACCENT_GREEN } from '../theme'
import { DEFAULT_COLORS } from '@features/canvas/store'

const API           = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const ACCENT_YELLOW = '#e0af68'

interface DashboardData {
  username:       string
  rank:           number
  pixels_placed:  number
  colors_used:    number
  favorite_color: number
  last_active:    string
  first_active:   string
  streak:         number
  rivals:         { rival: string; overwrites: number }[]
  neighbors:      { neighbor: string; shared_zone_pixels: number }[]
  intact_pixels:  { percent: number; total: number; still_mine: number }
}

interface Props {
  username: string
  onClose:  () => void
}

function Stat({ label, value, color = '#c0caf5' }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:2, flex:1, minWidth:80 }}>
      <span style={{ color:BORDER_COLOR, fontSize:10, fontWeight:700, fontFamily:'monospace', letterSpacing:'0.08em' }}>{label.toUpperCase()}</span>
      <span style={{ color, fontSize:18, fontWeight:700, fontFamily:'monospace' }}>{value}</span>
    </div>
  )
}

export function StatsModal({ username, onClose }: Props) {
  const [data,    setData]    = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    if (!username || username.startsWith('viewer_')) {
      setError('Connectez-vous pour voir vos stats')
      setLoading(false)
      return
    }
    Promise.all([
      fetch(`${API}/api/players/${encodeURIComponent(username)}/dashboard`).then(r => r.json()),
      fetch(`${API}/api/players/${encodeURIComponent(username)}`).then(r => r.json()),
    ])
      .then(([dashboard, player]) => {
        if (dashboard.error) throw new Error('Posez votre premier pixel pour voir vos stats !')
        setData({ ...dashboard, rank: player.rank ?? 1 })
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Erreur'))
      .finally(() => setLoading(false))
  }, [username])

  const fav = data ? (DEFAULT_COLORS[data.favorite_color] ?? '#888') : '#888'

  return (
    <div
      style={{ position:'fixed', inset:0, zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)' }}
      onClick={onClose}
    >
      <div
        style={{ background:BEZEL_COLOR, border:`1px solid ${BORDER_COLOR}`, borderRadius:12, padding:28, width:460, maxHeight:'80vh', display:'flex', flexDirection:'column', gap:20 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:18 }}>📊</span>
            <span style={{ color:ACCENT_BLUE, fontWeight:700, fontSize:16, fontFamily:'monospace' }}>
              {username}
            </span>
          </div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:BORDER_COLOR, cursor:'pointer', fontSize:18, lineHeight:1, padding:0 }}
            onMouseEnter={e => (e.currentTarget.style.color = ACCENT_RED)}
            onMouseLeave={e => (e.currentTarget.style.color = BORDER_COLOR)}>✕</button>
        </div>

        {loading && <div style={{ color:BORDER_COLOR, fontSize:13, textAlign:'center', padding:'32px 0' }}>Chargement…</div>}
        {error   && <div style={{ color:ACCENT_RED, fontSize:13, textAlign:'center', padding:'16px 0' }}>{error}</div>}

        {data && (
          <div style={{ overflowY:'auto', display:'flex', flexDirection:'column', gap:20 }}>

            {/* Stats principales */}
            <div style={{ display:'flex', flexWrap:'wrap', gap:16, background:'#1a1b26', border:`1px solid ${BORDER_COLOR}`, borderRadius:8, padding:'14px 16px' }}>
              <Stat label="Pixels"   value={data.pixels_placed.toLocaleString()} color={ACCENT_GREEN} />
              <Stat label="Rang"     value={`#${data.rank}`}                      color={ACCENT_YELLOW} />
              <Stat label="Couleurs" value={data.colors_used}                     color={ACCENT_BLUE} />
              <Stat label="Streak"   value={`${data.streak}j`}                   color='#e0af68' />
            </div>

            {/* Couleur favorite + intacts */}
            <div style={{ display:'flex', gap:12 }}>
              <div style={{ flex:1, background:'#1a1b26', border:`1px solid ${BORDER_COLOR}`, borderRadius:8, padding:'12px 14px', display:'flex', flexDirection:'column', gap:8 }}>
                <span style={{ color:BORDER_COLOR, fontSize:10, fontWeight:700, fontFamily:'monospace', letterSpacing:'0.08em' }}>COULEUR FAVORITE</span>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:24, height:24, borderRadius:5, background:fav, border:`1px solid ${BORDER_COLOR}` }} />
                  <span style={{ color:'#c0caf5', fontFamily:'monospace', fontSize:13 }}>{fav}</span>
                </div>
              </div>
              <div style={{ flex:1, background:'#1a1b26', border:`1px solid ${BORDER_COLOR}`, borderRadius:8, padding:'12px 14px', display:'flex', flexDirection:'column', gap:8 }}>
                <span style={{ color:BORDER_COLOR, fontSize:10, fontWeight:700, fontFamily:'monospace', letterSpacing:'0.08em' }}>PIXELS INTACTS</span>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ color:ACCENT_GREEN, fontFamily:'monospace', fontSize:20, fontWeight:700 }}>{data.intact_pixels.percent}%</span>
                  <span style={{ color:BORDER_COLOR, fontSize:11 }}>{data.intact_pixels.still_mine}/{data.intact_pixels.total}</span>
                </div>
              </div>
            </div>

            {/* Rivaux */}
            {data.rivals.length > 0 && (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <span style={{ color:BORDER_COLOR, fontSize:10, fontWeight:700, fontFamily:'monospace', letterSpacing:'0.08em' }}>RIVAUX</span>
                {data.rivals.map(r => (
                  <div key={r.rival} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#1a1b26', border:`1px solid ${BORDER_COLOR}`, borderRadius:6, padding:'6px 12px' }}>
                    <span style={{ color:'#c0caf5', fontSize:12 }}>{r.rival}</span>
                    <span style={{ color:ACCENT_RED, fontFamily:'monospace', fontSize:11 }}>{r.overwrites} écrasements</span>
                  </div>
                ))}
              </div>
            )}

            {/* Voisins */}
            {data.neighbors.length > 0 && (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <span style={{ color:BORDER_COLOR, fontSize:10, fontWeight:700, fontFamily:'monospace', letterSpacing:'0.08em' }}>VOISINS DE ZONE</span>
                {data.neighbors.map(n => (
                  <div key={n.neighbor} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#1a1b26', border:`1px solid ${BORDER_COLOR}`, borderRadius:6, padding:'6px 12px' }}>
                    <span style={{ color:'#c0caf5', fontSize:12 }}>{n.neighbor}</span>
                    <span style={{ color:ACCENT_BLUE, fontFamily:'monospace', fontSize:11 }}>{n.shared_zone_pixels} px partagés</span>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
