// ── Thème partagé entre tous les composants HUD ──────────────────────────────

export const BEZEL_COLOR  = '#24283b'
export const BORDER_COLOR = '#414868'
export const ACCENT_BLUE  = '#7aa2f7'
export const ACCENT_GREEN = '#9ece6a'
export const ACCENT_RED   = '#f7768e'

// Texte et icônes secondaires. BORDER_COLOR ne doit pas servir de couleur de
// premier plan : sur BEZEL_COLOR il n'offre qu'un contraste de 1,63:1, sous
// le seuil WCAG de 3:1 pour un élément d'interface. MUTED_TEXT atteint 6,9:1
// tout en restant discret.
export const MUTED_TEXT   = '#a9b1d6'
export const TEXT_COLOR   = '#c0caf5'

// Ombre unifiée appliquée sur tous les SVG du HUD (bezel, notch, volets)
export const HUD_SHADOW = 'drop-shadow(0 0 8px rgba(0,0,0,1))'

// Dimensions du bezel
export const THIN    = 12
export const TASKBAR = 64
export const RADIUS  = 24
