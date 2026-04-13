# VoxelPlace — Features Roadmap

> Liste des fonctionnalités à implémenter.
> Mise à jour au fil des décisions.

---

## Légende

| Symbole | Signification |
|---------|--------------|
| ❌ | À faire |
| 🔄 | En cours |
| ✅ | Terminé |
| ⭐ | Facile |
| ⭐⭐ | Moyen |
| ⭐⭐⭐ | Difficile |
| ⭐⭐⭐⭐ | Très difficile |

---

## Authentification

| Feature | Difficulté | Statut |
|---------|-----------|--------|
| Register / Login (UI) | ⭐⭐ | ✅ |
| Profil public joueur (`/u/username`) | ⭐⭐ | ✅ |

---

## Dashboard joueur

| Feature | Difficulté | Statut |
|---------|-----------|--------|
| Stats temps réel (pixels posés, couleur favorite, rang, dernière activité) | ⭐⭐ | ✅ |
| Leaderboard (top joueurs par pixels posés) | ⭐ | ✅ |
| Feed des derniers pixels posés (couleur + joueur + timestamp) | ⭐ | ✅ |
| Dashboard joueur (streak, rivaux, voisins, pixels intacts, historique) | ⭐⭐ | ✅ |
| Dashboard global (couleur top, heure de pointe, zone active, pixels intacts) | ⭐⭐ | ✅ |
| Timelapse + GIF personnel (seulement les pixels du joueur) | ⭐⭐ | ✅ |

---

## Canvas — Interactions

| Feature | Difficulté | Statut |
|---------|-----------|--------|
| Sélection de zone rectangulaire sur le canvas | ⭐⭐ | ✅ |
| Partage de zone (lien `/share/:id`) | ⭐⭐ | ✅ |
| Recherche d'un joueur sur le canvas (mise en surbrillance de ses pixels) | ⭐⭐ | ✅ |
| Notifications temps réel (quelqu'un a écrasé ton pixel) | ⭐⭐ | ✅ |

---

## Analytics & Visualisation

| Feature | Difficulté | Statut |
|---------|-----------|--------|
| Heatmap (zones les plus actives) | ⭐⭐ | ✅ |
| Timelapse du canvas (rejouer l'historique frame par frame) | ⭐⭐⭐ | ✅ |
| Export GIF du timelapse | ⭐⭐⭐ | ✅ |
| Historique d'un pixel (git blame — qui a posé quoi et quand) | ⭐ | ✅ |

---

## Admin & Modération

| Feature | Difficulté | Statut |
|---------|-----------|--------|
| Dashboard admin (stats globales, activité par plateforme) | ⭐⭐ | ✅ |
| Suppression d'un pixel | ⭐ | ✅ |
| Vider le canvas | ⭐ | ✅ |
| Bannir un utilisateur | ⭐⭐ | ✅ |

---

## Anti-abus & Modération

| Feature | Difficulté | Statut |
|---------|-----------|--------|
| Logs de modération publics (bannissements, raisons) | ⭐ | ✅ |
| Signalement de pixel / joueur (queue admin) | ⭐⭐ | ✅ |

---

## Cooldown & Gameplay

| Feature | Difficulté | Statut |
|---------|-----------|--------|
| Cooldown 1min (base) | ⭐ | ✅ |
| Réduction de cooldown via streak en heures | ⭐ | ✅ |
| Streak en heures — balance spendable | ⭐⭐ | ✅ |
| Système de skill-tree (unlocks couleurs + features) | ⭐⭐⭐ | ✅ |

---

## Coordination & Communauté

| Feature | Difficulté | Statut |
|---------|-----------|--------|
| Overlay / template (uploader une image, voir en transparence sur le canvas) | ⭐⭐⭐ | ❌ |
| Factions / équipes avec territoire revendiqué | ⭐⭐⭐ | ❌ |
| Thread de conversation par pixel (reset si pixel écrasé) | ⭐⭐ | ✅ |
| Chat global | ⭐⭐ | ✅ |

---

## Canvas & UX

| Feature | Difficulté | Statut |
|---------|-----------|--------|
| Canvas plus grand (512×512 ou 1024×1024) | ⭐ | ❌ | <!-- sync Minecraft/autres clients requis -->
| Palette étendue (16 couleurs, max Minecraft) | ⭐ | ✅ |
| Mobile UX (pinch-to-zoom, tap pour placer) | ⭐⭐⭐ | ❌ |
| Minimap (vue globale miniature en overlay) | ⭐⭐ | ❌ |
| Mode light / dark | ⭐ | ❌ |

---

## Replay & Historique

| Feature | Difficulté | Statut |
|---------|-----------|--------|
| Pixel blame (qui a posé ce pixel et toute son histoire) | ⭐ | ✅ |
| Timelapse interactif in-app (viewer dans le front, pas juste GIF) | ⭐⭐⭐ | ❌ |
| Mode spectateur live (canvas sans compte — comportement natif) | ⭐⭐ | ✅ |

---

## Cross-Platform

| Feature | Difficulté | Statut |
|---------|-----------|--------|
| Client Roblox (Lua) | ⭐⭐ | ❌ |
| Client Hytale | ⭐⭐ | ❌ |

---

## Expérimental

| Feature | Difficulté | Statut |
|---------|-----------|--------|
| Vue 3D du canvas (Three.js) | ⭐⭐⭐⭐ | ❌ |
