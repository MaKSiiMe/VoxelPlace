import { useState, useEffect, useCallback, useRef } from 'react'
import { socket } from './socket.js'
import GridCanvas from './components/GridCanvas.jsx'
import ColorPicker from './components/ColorPicker.jsx'
import PixelModal from './components/PixelModal.jsx'

const DEFAULT_COLORS = [
  '#FFFFFF', '#000000', '#FF4444', '#00AA00',
  '#4444FF', '#FFFF00', '#FF8800', '#AA00AA',
]

// Ordre d'affichage du gradient (clair → sombre)
// Key 1→colorId 0, Key 2→colorId 5, ..., Key 8→colorId 1
const KEY_TO_COLOR = [0, 5, 6, 2, 3, 4, 7, 1]

const API = import.meta.env.VITE_API_URL || window.location.origin

const PLATFORM_ICONS = {
  web:       '🌐',
  minecraft: '⛏',
  roblox:    '🎮',
  hytale:    '🏔',
}

// ─── Compteur de joueurs connectés ───────────────────────────────────────────
function PlayerCount({ players }) {
  if (!players || players.count === 0) return null
  const { count, byPlatform } = players
  return (
    <div style={pc.wrap} title={`${count} joueur(s) connecté(s)`}>
      <span style={pc.count}>👥 {count}</span>
      {Object.entries(byPlatform).map(([src, n]) =>
        PLATFORM_ICONS[src] ? (
          <span key={src} style={pc.item} title={`${src}: ${n}`}>
            {PLATFORM_ICONS[src]}&thinsp;<span style={pc.num}>{n}</span>
          </span>
        ) : null
      )}
    </div>
  )
}
const pc = {
  wrap:  { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  count: { fontSize: 12, color: 'var(--text-2)', fontWeight: 600 },
  item:  { fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center' },
  num:   { color: 'var(--text-2)', fontWeight: 600 },
}

// ─── Bandeau RGPD ────────────────────────────────────────────────────────────
function CookieBanner() {
  const [visible, setVisible] = useState(() => !localStorage.getItem('vp_rgpd'))
  if (!visible) return null
  return (
    <div role="alert" aria-live="polite" style={s.cookieBanner} className="vp-cookie-banner">
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)' }}>
        Ce site mémorise votre pseudo en <strong>localStorage</strong> et stocke vos pixels sur le serveur.
        Aucun cookie tiers ni tracking.{' '}
        <a href="https://www.cnil.fr/fr/rgpd-de-quoi-parle-t-on" target="_blank" rel="noopener noreferrer"
          style={{ color: 'var(--accent)' }}>En savoir plus</a>
      </p>
      <button
        style={{ ...s.btnSm, flexShrink: 0 }}
        onClick={() => { localStorage.setItem('vp_rgpd', '1'); setVisible(false) }}
        aria-label="Accepter et fermer le bandeau"
      >
        Compris ✓
      </button>
    </div>
  )
}

// ─── Écran d'authentification ─────────────────────────────────────────────────
function AuthScreen({ onConfirm }) {
  const [tab, setTab]           = useState('anon')  // 'anon' | 'login' | 'register'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [shaking, setShaking]   = useState(false)

  const API = import.meta.env.VITE_API_URL || window.location.origin

  function shake() { setShaking(true); setTimeout(() => setShaking(false), 400) }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    // ── Anonyme ──
    if (tab === 'anon') {
      if (!username.trim()) { shake(); return }
      onConfirm(username.trim(), null)
      return
    }

    // ── Connexion / Inscription ──
    if (!username.trim() || !password) { shake(); return }
    if (tab === 'register' && password !== confirm) {
      setError('Les mots de passe ne correspondent pas')
      shake(); return
    }

    setLoading(true)
    try {
      const endpoint = tab === 'login' ? '/api/auth/login' : '/api/auth/register'
      const res  = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erreur serveur'); shake(); return }
      onConfirm(data.username, data.token)
    } catch {
      setError('Impossible de contacter le serveur')
      shake()
    } finally {
      setLoading(false)
    }
  }

  function switchTab(t) { setTab(t); setError(''); setPassword(''); setConfirm('') }

  const TABS = [
    { id: 'anon',     label: '👤 Anonyme' },
    { id: 'login',    label: '🔑 Connexion' },
    { id: 'register', label: '✨ Créer un compte' },
  ]

  return (
    <div style={s.overlay} className="fade-in">
      <form
        onSubmit={handleSubmit}
        style={s.welcomeCard}
        className={`fade-up vp-welcome-card${shaking ? ' shake' : ''}`}
        aria-labelledby="welcome-title"
      >
        <div style={s.welcomeLogo} aria-hidden="true">🎨</div>
        <h1 id="welcome-title" style={s.welcomeTitle}>VoxelPlace</h1>
        <p style={s.welcomeSub}>Canvas collaboratif 64×64 en temps réel</p>

        {/* Onglets */}
        <div style={authS.tabs} role="tablist">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              style={{ ...authS.tab, ...(tab === t.id ? authS.tabActive : {}) }}
              onClick={() => switchTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Pseudo */}
        <div style={{ width: '100%', position: 'relative' }}>
          <label htmlFor="vp-username" style={s.srOnly}>Pseudo</label>
          <input
            id="vp-username"
            style={s.input}
            placeholder="Pseudo…"
            value={username}
            onChange={e => setUsername(e.target.value)}
            maxLength={32}
            autoFocus
            autoComplete="username"
            aria-required="true"
          />
          <span style={s.charCount} aria-live="polite">{username.length}/32</span>
        </div>

        {/* Mot de passe (login + register) */}
        {tab !== 'anon' && (
          <>
            <div style={{ width: '100%' }}>
              <label htmlFor="vp-password" style={s.srOnly}>Mot de passe</label>
              <input
                id="vp-password"
                type="password"
                style={s.input}
                placeholder="Mot de passe (6 caractères min.)…"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                aria-required="true"
              />
            </div>
            {tab === 'register' && (
              <div style={{ width: '100%' }}>
                <label htmlFor="vp-confirm" style={s.srOnly}>Confirmer le mot de passe</label>
                <input
                  id="vp-confirm"
                  type="password"
                  style={s.input}
                  placeholder="Confirmer le mot de passe…"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  aria-required="true"
                />
              </div>
            )}
          </>
        )}

        {error && (
          <p role="alert" style={{ color: 'var(--danger)', fontSize: 13, margin: 0 }}>{error}</p>
        )}

        <button style={s.btnAccent} type="submit" disabled={loading}>
          {loading ? '…' : tab === 'anon' ? 'Jouer →' : tab === 'login' ? 'Se connecter' : 'Créer mon compte'}
        </button>

        <div style={s.platforms} aria-label="Plateformes compatibles">
          <span title="Web" aria-label="Web">🌐</span>
          <span style={s.platformDot} aria-hidden="true" />
          <span title="Minecraft" aria-label="Minecraft">⛏</span>
          <span style={s.platformDot} aria-hidden="true" />
          <span title="Roblox" aria-label="Roblox">🎮</span>
          <span style={s.platformDot} aria-hidden="true" />
          <span title="Hytale" aria-label="Hytale">🏔</span>
        </div>
      </form>
    </div>
  )
}

const authS = {
  tabs: {
    display: 'flex', width: '100%', borderRadius: 'var(--r-sm)',
    overflow: 'hidden', border: '1px solid var(--border-2)',
  },
  tab: {
    flex: 1, padding: '7px 4px', fontSize: 11, fontWeight: 600,
    background: 'var(--surface-2)', border: 'none', color: 'var(--text-2)',
    cursor: 'pointer', transition: 'background 0.15s, color 0.15s',
  },
  tabActive: {
    background: 'var(--accent)', color: '#fff',
  },
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function App() {
  const [connected, setConnected]     = useState(false)
  const [grid, setGrid]               = useState(null)
  const [gridSize, setGridSize]       = useState(64)
  const [colors, setColors]           = useState(DEFAULT_COLORS)
  const [selectedColor, setSelectedColor] = useState(2)
  const [username, setUsername]           = useState(() => localStorage.getItem('vp_username') || '')
  const [usernameSet, setUsernameSet]     = useState(() => !!localStorage.getItem('vp_username'))
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('vp_token'))
  const [editingUsername, setEditingUsername] = useState(false)
  const [editValue, setEditValue]     = useState('')
  const [lastPixel, setLastPixel]     = useState(null)

  // Cooldown
  const [cooldown, setCooldown]       = useState(false)
  const cooldownTimer                 = useRef(null)

  // Players
  const [players, setPlayers]         = useState({ count: 0, byPlatform: {} })

  // Hover info
  const [hoverData, setHoverData]     = useState(null)
  const hoverTimerRef                 = useRef(null)

  // Admin
  const [isAdmin, setIsAdmin]         = useState(false)
  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const [adminPassword, setAdminPassword]   = useState('')
  const [adminError, setAdminError]         = useState('')
  const [pixelModal, setPixelModal]         = useState(null)
  const [pixelModalReadOnly, setPixelModalReadOnly] = useState(false)
  const logoClicksRef                       = useRef([])

  const gridRef     = useRef(null)
  const gridSizeRef = useRef(64)

  // ── Socket.io ────────────────────────────────────────────────────────────
  useEffect(() => {
    socket.connect()

    socket.on('connect', () => {
      setConnected(true)
      // Annonce la présence dès la (re)connexion si le pseudo est déjà défini
      const stored = localStorage.getItem('vp_username')
      if (stored) socket.emit('player:join', { username: stored, source: 'web' })
    })
    socket.on('disconnect', () => setConnected(false))

    socket.on('grid:init', ({ grid, size, colors: cols, players: pl }) => {
      setGrid(new Uint8Array(grid))
      setGridSize(size)
      gridSizeRef.current = size
      if (cols) setColors(cols)
      if (pl)  setPlayers(pl)
    })

    socket.on('pixel:update', ({ x, y, colorId, username: who }) => {
      setGrid(prev => {
        if (!prev) return prev
        const next = new Uint8Array(prev)
        next[y * gridSizeRef.current + x] = colorId
        return next
      })
      setLastPixel({ x, y, colorId, username: who })
      gridRef.current?.drawPixel(x, y, colorId)
    })

    socket.on('players:update', (pl) => setPlayers(pl))

    return () => {
      socket.off('connect'); socket.off('disconnect')
      socket.off('grid:init'); socket.off('pixel:update')
      socket.off('players:update')
      socket.disconnect()
    }
  }, [])

  // ── Raccourcis clavier (touches 1–8 = couleurs) ──────────────────────────
  useEffect(() => {
    function onKeyDown(e) {
      if (e.target.tagName === 'INPUT') return
      const idx = parseInt(e.key, 10) - 1
      if (idx >= 0 && idx < KEY_TO_COLOR.length) {
        setSelectedColor(KEY_TO_COLOR[idx])
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // ── Clic pixel ───────────────────────────────────────────────────────────
  const openPixelModal = useCallback(async (x, y, readOnly) => {
    try {
      const res = await fetch(`${API}/api/pixel/${x}/${y}`)
      setPixelModal(await res.json())
    } catch {
      setPixelModal({ x, y, colorId: 0, username: null, source: null })
    }
    setPixelModalReadOnly(readOnly)
  }, [])

  const handlePixelHover = useCallback((x, y) => {
    clearTimeout(hoverTimerRef.current)
    if (x === null) { setHoverData(null); return }
    hoverTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/api/pixel/${x}/${y}`)
        setHoverData(await res.json())
      } catch { setHoverData(null) }
    }, 300)
  }, [])

  const handlePixelClick = useCallback(async (x, y) => {
    if (!connected) return

    if (isAdmin) {
      openPixelModal(x, y, false)
      return
    }

    if (!usernameSet || cooldown) return

    setCooldown(true)
    clearTimeout(cooldownTimer.current)
    cooldownTimer.current = setTimeout(() => setCooldown(false), 1000)

    socket.emit('pixel:place', { x, y, colorId: selectedColor, username, source: 'web' }, (ack) => {
      if (ack?.exempt) {
        clearTimeout(cooldownTimer.current)
        setCooldown(false)
      }
    })
  }, [connected, isAdmin, usernameSet, cooldown, selectedColor, username, openPixelModal])

  // ── Admin ────────────────────────────────────────────────────────────────
  const handleAdminClear = useCallback(() => {
    if (!pixelModal) return
    socket.emit('admin:clear', { x: pixelModal.x, y: pixelModal.y }, (ack) => {
      if (ack?.ok) setPixelModal(null)
    })
  }, [pixelModal])

  const handleAdminLogin = (e) => {
    e.preventDefault()
    setAdminError('')
    socket.emit('admin:auth', adminPassword, (ack) => {
      if (ack?.ok) {
        setIsAdmin(true)
        setShowAdminLogin(false)
        setAdminPassword('')
      } else {
        setAdminError(ack?.error || 'Erreur')
      }
    })
  }

  const handleLogoClick = () => {
    const now = Date.now()
    logoClicksRef.current = [...logoClicksRef.current.filter(t => now - t < 3000), now]
    if (logoClicksRef.current.length >= 5) {
      logoClicksRef.current = []
      isAdmin ? setIsAdmin(false) : setShowAdminLogin(true)
    }
  }

  // ── Username ─────────────────────────────────────────────────────────────
  const handleUsernameConfirm = (val, token) => {
    localStorage.setItem('vp_username', val)
    if (token) { localStorage.setItem('vp_token', token); setIsAuthenticated(true) }
    else { localStorage.removeItem('vp_token'); setIsAuthenticated(false) }
    setUsername(val)
    setUsernameSet(true)
    // Annonce immédiate si déjà connecté
    if (socket.connected) socket.emit('player:join', { username: val, source: 'web' })
  }

  const handleUsernameEdit = (e) => {
    e.preventDefault()
    const val = editValue.trim()
    if (!val) return
    localStorage.setItem('vp_username', val)
    setUsername(val)
    setEditingUsername(false)
  }

  // ── Premier lancement ────────────────────────────────────────────────────
  if (!usernameSet) {
    return <AuthScreen onConfirm={handleUsernameConfirm} />
  }

  // ── Shell principal ──────────────────────────────────────────────────────
  return (
    <div style={s.shell}>

      {/* ── Header ── */}
      <header style={{ ...s.header, ...(isAdmin ? s.headerAdmin : {}) }} role="banner" className="vp-header">

        {/* Logo */}
        <button style={s.logo} onClick={handleLogoClick} title="VoxelPlace" aria-label="VoxelPlace — 5 clics pour le mode admin">
          {isAdmin ? '👑' : '🎨'}&ensp;VoxelPlace
        </button>

        {/* Centre */}
        <div style={s.headerCenter} className="vp-header-center">
          {isAdmin ? (
            <span style={s.adminBadge}>MODE ADMIN</span>
          ) : lastPixel ? (
            <div style={s.lastPixel} className="fade-in" key={`${lastPixel.x}-${lastPixel.y}`}>
              <span style={{ ...s.colorDot, background: colors[lastPixel.colorId] }} />
              <span style={{ color: 'var(--text-2)', fontSize: 12 }}>
                ({lastPixel.x},{lastPixel.y})&ensp;par
              </span>
              <strong style={{ fontSize: 12 }}>{lastPixel.username}</strong>
              {lastPixel.source && PLATFORM_ICONS[lastPixel.source] && (
                <span style={{ fontSize: 12 }} title={lastPixel.source}>
                  {PLATFORM_ICONS[lastPixel.source]}
                </span>
              )}
            </div>
          ) : null}
        </div>

        {/* Compteur joueurs */}
        <PlayerCount players={players} />

        {/* Droite */}
        <div style={s.headerRight}>
          {/* Indicateur connexion */}
          <div style={s.connStatus} aria-live="polite" aria-label={connected ? 'Connecté au serveur' : 'Déconnecté du serveur'}>
            <span
              style={{ ...s.dot, background: connected ? '#00cc66' : '#cc3300' }}
              className={connected ? 'dot-connected' : 'dot-disconnected'}
              aria-hidden="true"
            />
            <span style={{ fontSize: 11, color: 'var(--text-2)' }}>
              {connected ? 'En ligne' : 'Hors ligne'}
            </span>
          </div>

          {/* Username */}
          {editingUsername ? (
            <form onSubmit={handleUsernameEdit} style={{ display: 'flex', gap: 6 }}>
              <label htmlFor="vp-edit-username" style={s.srOnly}>Nouveau pseudo</label>
              <input
                id="vp-edit-username"
                style={{ ...s.inputSm }}
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                maxLength={32}
                autoFocus
                aria-label="Modifier le pseudo"
              />
              <button style={s.btnSm} type="submit">OK</button>
              <button style={{ ...s.btnSm, background: 'var(--surface-2)' }} type="button"
                onClick={() => setEditingUsername(false)}>✕</button>
            </form>
          ) : (
            <button
              style={s.userBtn}
              onClick={() => { if (!isAuthenticated) { setEditValue(username); setEditingUsername(true) } }}
              title={isAuthenticated ? 'Compte authentifié' : 'Changer de pseudo'}
              aria-label={isAuthenticated ? `Connecté en tant que ${username}` : `Pseudo : ${username} — cliquer pour modifier`}
            >
              {isAuthenticated ? '🔒' : '👤'}&ensp;{username}
            </button>
          )}
        </div>
      </header>

      {/* ── Canvas ── */}
      <main style={s.canvasArea}>
        {grid ? (
          <GridCanvas
            ref={gridRef}
            grid={grid}
            gridSize={gridSize}
            colors={colors}
            onPixelClick={handlePixelClick}
            onPixelHover={handlePixelHover}
            hoverData={hoverData}
            adminMode={isAdmin}
            cooldown={cooldown}
          />
        ) : (
          <div style={s.loading}>
            <div style={s.loadingDot} />
            <span style={{ color: 'var(--text-2)', fontSize: 14 }}>Connexion à la toile…</span>
          </div>
        )}
      </main>

      {/* ── Toolbar ── */}
      <footer style={s.toolbar} className="vp-toolbar">
        {/* Barre de cooldown (top edge du footer) */}
        {cooldown && (
          <div style={s.cooldownTrack}>
            <div key={Date.now()} style={s.cooldownBar} />
          </div>
        )}

        {isAdmin ? (
          <div style={s.adminHint}>
            <span style={{ fontSize: 18 }}>👑</span>
            <span>Cliquez sur un pixel pour inspecter et supprimer</span>
            <div style={s.separator} />
            <button
              style={{ ...s.btnAccent, background: 'var(--admin)', color: '#000', fontSize: 13, padding: '6px 14px' }}
              onClick={() => {
                if (!confirm('Remettre toute la toile à zéro ?')) return
                socket.emit('admin:clearAll', null, (ack) => {
                  if (ack?.error) alert(ack.error)
                })
              }}
            >
              🗑 Vider le canvas
            </button>
          </div>
        ) : (
          <>
            <ColorPicker
              colors={colors}
              selectedId={selectedColor}
              onSelect={setSelectedColor}
              keyMap={KEY_TO_COLOR}
            />
            <div style={s.separator} />
            <div style={{ ...s.previewSwatch, background: colors[selectedColor] }} />
            <span style={{ fontSize: 12, color: 'var(--text-2)', fontFamily: 'monospace' }}>
              {colors[selectedColor]}
            </span>
          </>
        )}

        <span style={s.hint} className="vp-hint">
          {isAdmin
            ? '5 clics sur le logo pour quitter le mode admin'
            : 'Molette zoom · Glisser déplacer · Touches 1–8'}
        </span>
      </footer>

      {/* ── Modale admin login ── */}
      {showAdminLogin && (
        <>
          <div style={s.backdrop} className="fade-in" onClick={() => setShowAdminLogin(false)} />
          <form style={s.adminModal} className="fade-up vp-admin-modal" onSubmit={handleAdminLogin} aria-labelledby="admin-modal-title">
            <button type="button" style={s.closeBtn} onClick={() => setShowAdminLogin(false)} aria-label="Fermer">✕</button>
            <div style={{ fontSize: 32 }} aria-hidden="true">👑</div>
            <h2 id="admin-modal-title" style={{ color: 'var(--admin)', fontSize: 18, fontWeight: 700 }}>Accès Admin</h2>
            <label htmlFor="vp-admin-password" style={s.srOnly}>Mot de passe administrateur</label>
            <input
              id="vp-admin-password"
              type="password"
              style={s.input}
              placeholder="Mot de passe…"
              value={adminPassword}
              onChange={e => setAdminPassword(e.target.value)}
              autoFocus
              autoComplete="current-password"
            />
            {adminError && (
              <p style={{ color: 'var(--danger)', fontSize: 13 }}>{adminError}</p>
            )}
            <button style={{ ...s.btnAccent, background: 'var(--admin)' }} type="submit">
              Connexion
            </button>
          </form>
        </>
      )}

      {/* ── Modale pixel ── */}
      {pixelModal && (
        <PixelModal
          pixel={pixelModal}
          colors={colors}
          onClear={handleAdminClear}
          onClose={() => setPixelModal(null)}
          readOnly={pixelModalReadOnly}
        />
      )}

      {/* ── Bandeau RGPD ── */}
      <CookieBanner />
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
  shell: {
    display: 'flex', flexDirection: 'column',
    width: '100vw', height: '100vh', overflow: 'hidden',
    background: 'var(--bg)',
  },

  // Header
  header: {
    display: 'flex', alignItems: 'center', gap: 16,
    padding: '0 20px', height: 56, flexShrink: 0,
    background: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
    transition: 'border-color 0.3s',
  },
  headerAdmin: {
    borderBottom: '1px solid var(--admin)',
  },
  logo: {
    background: 'none', border: 'none',
    fontSize: 16, fontWeight: 800, color: 'var(--accent)',
    letterSpacing: 1, cursor: 'default', userSelect: 'none',
    padding: 0, flexShrink: 0,
  },
  headerCenter: {
    flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center',
  },
  headerRight: {
    display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
  },
  connStatus: {
    display: 'flex', alignItems: 'center', gap: 6,
  },
  dot: {
    width: 8, height: 8, borderRadius: '50%', display: 'inline-block', flexShrink: 0,
  },
  adminBadge: {
    background: 'var(--admin)', color: '#000',
    fontSize: 10, fontWeight: 800, letterSpacing: 1.5,
    padding: '3px 12px', borderRadius: 20,
  },
  lastPixel: {
    display: 'flex', alignItems: 'center', gap: 6,
  },
  colorDot: {
    width: 10, height: 10, borderRadius: 3, flexShrink: 0,
    border: '1px solid rgba(255,255,255,0.15)',
  },

  // Boutons header
  userBtn: {
    background: 'var(--surface-2)', border: '1px solid var(--border-2)',
    borderRadius: 'var(--r-sm)', color: 'var(--text)',
    padding: '5px 12px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
    transition: 'background 0.15s',
  },
  btnSm: {
    background: 'var(--accent)', border: 'none',
    borderRadius: 'var(--r-sm)', color: '#fff',
    padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
  },
  inputSm: {
    background: 'var(--surface-2)', border: '1px solid var(--border-2)',
    borderRadius: 'var(--r-sm)', color: 'var(--text)',
    padding: '5px 10px', fontSize: 13, outline: 'none', width: 140,
  },

  // Canvas area
  canvasArea: {
    flex: 1, display: 'flex', overflow: 'hidden', position: 'relative',
  },
  loading: {
    margin: 'auto', display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 16,
  },
  loadingDot: {
    width: 12, height: 12, borderRadius: '50%',
    background: 'var(--accent)', opacity: 0.7,
    animation: 'pulse-connected 1.2s infinite',
  },

  // Toolbar
  toolbar: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '0 20px', height: 64, flexShrink: 0,
    background: 'var(--surface)', borderTop: '1px solid var(--border)',
    position: 'relative',
  },
  cooldownTrack: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
    background: 'var(--border)',
    overflow: 'hidden',
  },
  cooldownBar: {
    height: '100%', width: '100%',
    background: 'var(--accent)',
    transformOrigin: 'left',
    animation: 'cooldown-shrink 1s linear forwards',
  },
  separator: {
    width: 1, height: 28, background: 'var(--border-2)', flexShrink: 0,
    margin: '0 4px',
  },
  previewSwatch: {
    width: 28, height: 28, borderRadius: 'var(--r-sm)', flexShrink: 0,
    border: '2px solid var(--border-2)',
  },
  hint: {
    marginLeft: 'auto', fontSize: 11, color: 'var(--text-3)',
    whiteSpace: 'nowrap', userSelect: 'none',
  },
  adminHint: {
    display: 'flex', alignItems: 'center', gap: 10,
    color: 'var(--admin)', fontSize: 13, fontWeight: 600,
  },
  inspectBtn: {
    background: 'var(--surface-2)', border: '1px solid var(--border-2)',
    borderRadius: 'var(--r-sm)', fontSize: 18, lineHeight: 1,
    padding: '4px 8px', cursor: 'pointer', flexShrink: 0,
    transition: 'background 0.15s, border-color 0.15s',
  },
  inspectBtnActive: {
    background: 'rgba(99,102,241,0.2)', border: '1px solid #6366f1',
  },

  // Modales
  backdrop: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
    zIndex: 100,
  },
  adminModal: {
    position: 'fixed', top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)', zIndex: 101,
    background: 'var(--surface)', border: '1px solid var(--admin)',
    borderRadius: 'var(--r-lg)', padding: '32px 36px',
    minWidth: 300, display: 'flex', flexDirection: 'column',
    gap: 14, alignItems: 'center', boxShadow: 'var(--shadow)',
  },
  closeBtn: {
    position: 'absolute', top: 12, right: 14,
    background: 'none', border: 'none',
    color: 'var(--text-2)', fontSize: 16, cursor: 'pointer', lineHeight: 1,
  },

  // Welcome screen
  overlay: {
    width: '100vw', height: '100vh',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg)',
  },
  welcomeCard: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--r-xl)', padding: '44px 48px',
    display: 'flex', flexDirection: 'column', gap: 14,
    minWidth: 340, alignItems: 'center', boxShadow: 'var(--shadow)',
  },
  welcomeLogo: { fontSize: 48, lineHeight: 1 },
  welcomeTitle: { fontSize: 30, fontWeight: 800, color: 'var(--accent)', letterSpacing: 2 },
  welcomeSub: { fontSize: 13, color: 'var(--text-2)', marginBottom: 4, textAlign: 'center' },
  charCount: {
    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
    fontSize: 11, color: 'var(--text-3)', pointerEvents: 'none',
  },
  platforms: {
    display: 'flex', alignItems: 'center', gap: 6,
    marginTop: 4, fontSize: 20,
  },
  platformDot: {
    width: 4, height: 4, borderRadius: '50%',
    background: 'var(--border-2)',
  },

  // Accessibilité — visuellement caché mais lisible par les lecteurs d'écran
  srOnly: {
    position: 'absolute', width: 1, height: 1,
    padding: 0, margin: -1, overflow: 'hidden',
    clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
  },

  // RGPD cookie banner
  cookieBanner: {
    position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 300,
    display: 'flex', alignItems: 'center', gap: 16,
    padding: '12px 20px',
    background: 'var(--surface-2)', borderTop: '1px solid var(--border)',
  },

  // Inputs / buttons globaux
  input: {
    background: 'var(--surface-2)', border: '1px solid var(--border-2)',
    borderRadius: 'var(--r-md)', color: 'var(--text)',
    padding: '10px 14px', fontSize: 15, outline: 'none', width: '100%',
    transition: 'border-color 0.15s',
  },
  btnAccent: {
    background: 'var(--accent)', border: 'none',
    borderRadius: 'var(--r-md)', color: '#fff',
    padding: '11px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
    width: '100%', transition: 'background 0.15s',
  },
}
