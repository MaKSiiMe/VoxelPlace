// ── Arbre de compétences VoxelPlace ──────────────────────────────────────────
// Chaque nœud a :
//   type        : 'color' | 'feature'
//   level       : 1-4 (couleurs uniquement)
//   colorId     : index dans la palette (couleurs uniquement)
//   name        : nom lisible
//   streakCost  : heures de streak à dépenser (0 = automatique)
//   conditions  : tableau de conditions à remplir
//   comingSoon  : (features) aucune interface ne la rend encore utilisable —
//                 le nœud reste visible mais ne peut être ni débloqué ni
//                 annoncé, pour ne pas faire dépenser du streak dans le vide.
//                 Chaque fonctionnalité livrée lève son marqueur.
//
// Les fonctionnalités libres pour tous (classement, statistiques, minimap,
// inspecteur de pixel) ne figurent pas dans l'arbre : elles y étaient listées
// comme déblocables sans jamais avoir été verrouillées. Le chat, en sommeil,
// n'y figure pas non plus.
//
// Types de conditions :
//   color_count        { colorId, min }   — X pixels de cette couleur posés (cumulés)
//   color_unlocked     { colorId }        — cette couleur doit être débloquée
//   feature_unlocked   { nodeId }         — cette feature doit être débloquée
//   pixels_placed      { min }            — X pixels posés au total
//   pixels_lost        { min }            — X de ses pixels écrasés par d'autres
//   pixels_overwritten { min }            — X pixels d'autres écrasés par soi
//   days_played        { min }            — avoir joué sur X jours différents
//   zones_visited      { min }            — avoir posé dans X zones 64×64 différentes
//   rank_top           { max }            — être dans le top N du leaderboard
//   all_features_unlocked {}              — toutes les features débloquées
//   color_each_unlocked {}                — 1px de chaque couleur débloquée
//   color_level4_any {}                   — au moins 1 couleur niveau 4 débloquée

export const TREE = {

  // ── Niveau 1 — couleurs de base (débloquées à la création du compte) ────────
  'color:0':  { type: 'color', level: 1, colorId: 0,  name: 'Blanc',      streakCost: 0, conditions: [] },
  'color:3':  { type: 'color', level: 1, colorId: 3,  name: 'Noir',       streakCost: 0, conditions: [] },
  'color:12': { type: 'color', level: 1, colorId: 12, name: 'Bleu',       streakCost: 0, conditions: [] },
  'color:7':  { type: 'color', level: 1, colorId: 7,  name: 'Jaune',      streakCost: 0, conditions: [] },
  'color:5':  { type: 'color', level: 1, colorId: 5,  name: 'Rouge',      streakCost: 0, conditions: [] },

  // ── Niveau 2 — mélanges primaires (10x cumulés + 2h streak) ─────────────────
  'color:6': { type: 'color', level: 2, colorId: 6,  name: 'Orange', streakCost: 2, conditions: [
    { type: 'color_count', colorId: 5,  min: 10 },  // rouge
    { type: 'color_count', colorId: 7,  min: 10 },  // jaune
  ]},
  'color:13': { type: 'color', level: 2, colorId: 13, name: 'Violet', streakCost: 2, conditions: [
    { type: 'color_count', colorId: 12, min: 10 },  // bleu
    { type: 'color_count', colorId: 5,  min: 10 },  // rouge
  ]},
  'color:9': { type: 'color', level: 2, colorId: 9,  name: 'Vert', streakCost: 2, conditions: [
    { type: 'color_count', colorId: 12, min: 10 },  // bleu
    { type: 'color_count', colorId: 7,  min: 10 },  // jaune
  ]},

  // ── Niveau 3 — 10x cumulés + 3h streak ──────────────────────────────────────
  'color:2': { type: 'color', level: 3, colorId: 2,  name: 'Gris', streakCost: 3, conditions: [
    { type: 'color_count', colorId: 0,  min: 10 },  // blanc
    { type: 'color_count', colorId: 3,  min: 10 },  // noir
  ]},
  'color:10': { type: 'color', level: 3, colorId: 10, name: 'Cyan', streakCost: 3, conditions: [
    { type: 'color_count', colorId: 9,  min: 10 },  // vert
    { type: 'color_count', colorId: 12, min: 10 },  // bleu
  ]},
  'color:4': { type: 'color', level: 3, colorId: 4,  name: 'Marron', streakCost: 3, conditions: [
    { type: 'color_count', colorId: 5,  min: 10 },  // rouge
    { type: 'color_count', colorId: 6,  min: 10 },  // orange
    { type: 'color_count', colorId: 3,  min: 10 },  // noir
  ]},
  'color:14': { type: 'color', level: 3, colorId: 14, name: 'Magenta', streakCost: 3, conditions: [
    { type: 'color_count', colorId: 5,  min: 10 },  // rouge
    { type: 'color_count', colorId: 13, min: 10 },  // violet
  ]},

  // ── Niveau 4 — prérequis couleur + 10x cumulés + 5h streak ──────────────────
  'color:15': { type: 'color', level: 4, colorId: 15, name: 'Rose', streakCost: 5, conditions: [
    { type: 'color_unlocked', colorId: 13 },         // violet débloqué
    { type: 'color_count', colorId: 0,  min: 10 },  // blanc
    { type: 'color_count', colorId: 5,  min: 10 },  // rouge
    { type: 'color_count', colorId: 13, min: 10 },  // violet
  ]},
  'color:8': { type: 'color', level: 4, colorId: 8,  name: 'Vert clair', streakCost: 5, conditions: [
    { type: 'color_unlocked', colorId: 10 },         // cyan débloqué
    { type: 'color_count', colorId: 0,  min: 10 },  // blanc
    { type: 'color_count', colorId: 7,  min: 10 },  // jaune
    { type: 'color_count', colorId: 9,  min: 10 },  // vert
    { type: 'color_count', colorId: 12, min: 10 },  // bleu
  ]},
  'color:11': { type: 'color', level: 4, colorId: 11, name: 'Bleu clair', streakCost: 5, conditions: [
    { type: 'color_unlocked', colorId: 10 },         // cyan débloqué
    { type: 'color_count', colorId: 0,  min: 10 },  // blanc
    { type: 'color_count', colorId: 12, min: 10 },  // bleu
    { type: 'color_count', colorId: 10, min: 10 },  // cyan
  ]},
  'color:1': { type: 'color', level: 4, colorId: 1,  name: 'Gris clair', streakCost: 5, conditions: [
    { type: 'color_unlocked', colorId: 2 },          // gris débloqué
    { type: 'color_count', colorId: 0,  min: 10 },  // blanc
    { type: 'color_count', colorId: 2,  min: 10 },  // gris
    { type: 'color_count', colorId: 3,  min: 10 },  // noir
  ]},

  // ── Features — Placement ─────────────────────────────────────────────────────
  'feature:highlight': { type: 'feature', name: 'Surbrillance de ses pixels', comingSoon: true, streakCost: 0, conditions: [
    { type: 'color_count', colorId: 0,  min: 1 },
    { type: 'color_count', colorId: 3,  min: 1 },
    { type: 'color_count', colorId: 12, min: 1 },
    { type: 'color_count', colorId: 7,  min: 1 },
    { type: 'color_count', colorId: 5,  min: 1 },
  ]},


  // ── Features — Stats & Profil ────────────────────────────────────────────────
  'feature:dashboard': { type: 'feature', name: 'Dashboard joueur', comingSoon: true, streakCost: 0, conditions: [
    { type: 'pixels_placed', min: 100 },
  ]},
  'feature:profile': { type: 'feature', name: 'Profil public', comingSoon: true, streakCost: 0, conditions: [
    { type: 'rank_top', max: 100 },
    { type: 'all_features_unlocked' },
  ]},

  // ── Features — Historique & Analyse ─────────────────────────────────────────
  'feature:search': { type: 'feature', name: 'Recherche joueur', comingSoon: true, streakCost: 0, conditions: [
    { type: 'pixels_overwritten', min: 25 },
  ]},
  'feature:heatmap': { type: 'feature', name: 'Heatmap', streakCost: 0, conditions: [
    { type: 'pixels_lost', min: 10 },   // 50 à l'origine : hors d'atteinte pour la communauté actuelle
  ]},
  'feature:dashboard_global': { type: 'feature', name: 'Dashboard global', comingSoon: true, streakCost: 0, conditions: [
    { type: 'pixels_overwritten', min: 100 },
  ]},

  // ── Features — Zone & Partage ────────────────────────────────────────────────
  'feature:zone_select': { type: 'feature', name: 'Sélection de zone', comingSoon: true, streakCost: 0, conditions: [
    { type: 'color_each_unlocked' },
  ]},
  'feature:zone_share': { type: 'feature', name: 'Partage de zone', comingSoon: true, streakCost: 5, conditions: [
    { type: 'feature_unlocked', nodeId: 'feature:zone_select' },
  ]},
  'feature:zone_gif': { type: 'feature', name: 'GIF de zone', comingSoon: true, streakCost: 10, conditions: [
    { type: 'feature_unlocked', nodeId: 'feature:zone_share' },
  ]},

  // ── Features — Timelapse ─────────────────────────────────────────────────────
  // Le timelapse personnel exigeait la sélection de zone, qui n'est pas encore
  // livrée : personne n'aurait pu le débloquer. Seuils abaissés pour la
  // communauté actuelle (3 jours → 2, 10 zones → 5).
  'feature:timelapse_personal': { type: 'feature', name: 'Timelapse + GIF personnel', streakCost: 0, conditions: [
    { type: 'days_played', min: 2 },
    { type: 'pixels_lost', min: 1 },
  ]},
  'feature:timelapse_global': { type: 'feature', name: 'Timelapse + GIF canvas global', streakCost: 0, conditions: [
    { type: 'feature_unlocked', nodeId: 'feature:timelapse_personal' },
    { type: 'zones_visited', min: 5 },
  ]},

  // ── Features — Canvas & UX ───────────────────────────────────────────────────
  'feature:theme': { type: 'feature', name: 'Mode light/dark', comingSoon: true, streakCost: 0, conditions: [
    { type: 'color_count', colorId: 0, min: 10 },  // 10x blanc
    { type: 'color_count', colorId: 3, min: 10 },  // 10x noir
  ]},
}

// Couleurs de niveau 1 débloquées automatiquement à la création du compte
export const BASE_COLOR_NODES = ['color:0', 'color:3', 'color:12', 'color:7', 'color:5']

/** Identifiants de palette des couleurs de base : toujours utilisables. */
export const BASE_COLOR_IDS = BASE_COLOR_NODES.map(nodeId => TREE[nodeId].colorId)
