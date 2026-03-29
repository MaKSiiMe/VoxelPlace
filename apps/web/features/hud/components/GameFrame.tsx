'use client'

// Cadre moniteur :
// - Extérieur : collé aux bords de la fenêtre (carré)
// - Intérieur : coins arrondis (40px)
// - Bord haut / droite / bas : fin (12px)
// - Bord gauche : épais (72px) → taskbar intégrée
// Technique : box-shadow sur l'ouverture intérieure arrondie
//             → la shadow couvre tout l'extérieur en carré

const BEZEL    = '#e8e3de'
const THIN     = 12
const TASKBAR  = 72
const RADIUS   = 40

export function GameFrame() {
  return (
    <>
      {/* Ouverture intérieure arrondie — box-shadow remplit tout l'extérieur */}
      <div
        className="fixed z-20 pointer-events-none"
        style={{
          top:          THIN,
          right:        THIN,
          bottom:       THIN,
          left:         TASKBAR,
          borderRadius: RADIUS,
          boxShadow:    `0 0 0 200vmax ${BEZEL}`,
        }}
      />

      {/* Taskbar gauche — par-dessus le bord gauche */}
      <div
        className="fixed top-0 left-0 bottom-0 z-30 flex flex-col items-center py-8 pointer-events-auto"
        style={{ width: TASKBAR }}
      >
        {/* TODO: logo, navigation, settings */}
      </div>
    </>
  )
}
