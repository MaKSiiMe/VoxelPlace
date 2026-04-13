// ── Palette canonique — source de vérité ─────────────────────────────────────
// 16 couleurs, compatibles Minecraft (wool/concrete × 16)
// Les clients web appliquent leur propre mapping thème (voir store.ts)

export const PALETTE_HEX = [
  '#FFFFFF', // 0  blanc
  '#AAAAAA', // 1  gris clair
  '#888888', // 2  gris
  '#000000', // 3  noir
  '#884422', // 4  marron
  '#FF4444', // 5  rouge
  '#FF8800', // 6  orange
  '#FFFF00', // 7  jaune
  '#88CC22', // 8  vert clair
  '#00AA00', // 9  vert
  '#00AAAA', // 10 cyan
  '#44AAFF', // 11 bleu clair
  '#4444FF', // 12 bleu
  '#AA00AA', // 13 violet
  '#FF44FF', // 14 magenta
  '#FF88AA', // 15 rose
]

export const PALETTE_RGB = PALETTE_HEX.map(hex => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
])
