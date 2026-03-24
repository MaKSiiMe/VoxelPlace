# Roadmap RNCP 6 — CDA — VoxelPlace

> **Deadline finale : 30 juillet 2025**
> Ce fichier suit l'avancement des critères RNCP 6 (Holberton Toulouse).
> Mettre à jour au fur et à mesure.

---

## Récapitulatif

| # | Catégorie | Fait | Partiel | À faire | Total | Avancement |
|---|-----------|------|---------|---------|-------|-----------|
| 1 | Base de données | 5 | 0 | 0 | 5 | 🟩 100% |
| 2 | Sécurité | 6 | 1 | 1 | 8 | 🟩 75% |
| 3 | DevOps & Tests | 3 | 0 | 2 | 5 | 🟩 60% |
| 4 | Accessibilité | 4 | 0 | 1 | 5 | 🟩 80% |
| 5 | Tests Frontend | 0 | 0 | 5 | 5 | 🟥 0% |
| 6 | RGPD | 4 | 0 | 0 | 4 | 🟩 100% |
| 7 | Conception UML | 4 | 1 | 0 | 5 | 🟩 80% |
| 8 | SEO | 4 | 0 | 1 | 5 | 🟩 80% |
| 9 | Maquettage & Responsive | 1 | 1 | 2 | 4 | 🟨 30% |
| 10 | Rendus obligatoires | 0 | 0 | 5 | 5 | 🟥 0% |
| — | **TOTAL** | **32** | **4** | **15** | **51** | **~63%** |

---

## Légende

- ✅ Fait
- 🔄 En cours / partiel
- ❌ À faire
- 🚫 Non applicable / hors scope

---

## 1. Base de données (`02_backend_bdd.md`)

| # | Critère | Statut | Notes |
|---|---------|--------|-------|
| 1.1 | Méthode Merise : MCD → MLD → MPD | ✅ | MLD + ERD Mermaid dans `docs/uml/erd-merise.md` |
| 1.2 | ERD avant le code | ✅ | `docs/uml/erd-merise.md` |
| 1.3 | BDD SQL (MySQL/PostgreSQL) | ✅ | PostgreSQL 16 — tables `users` + `pixel_history` — container `voxelplace-db` |
| 1.4 | Requêtes préparées anti-injection SQL | ✅ | `$1, $2` dans `auth.js` et `index.js` — INSERT, SELECT, DISTINCT ON paramétrés |
| 1.5 | BDD hébergée ou démarche documentée | ✅ | Redis + PostgreSQL sur serveur Debian, persistés via volumes Docker |

---

## 2. Sécurité (`03_backend_securite_infrastructure.md`)

| # | Critère | Statut | Notes |
|---|---------|--------|-------|
| 2.1 | Hachage des mots de passe (bcrypt) | ✅ | `bcryptjs` 10 rounds — `hashPassword()` / `verifyPassword()` dans `auth.js` |
| 2.2 | Protection CSRF (tokens) | ❌ | API stateless JWT — CSRF non critique, à justifier dans le rapport |
| 2.3 | Protection XSS | ✅ | `sanitizeUsername()` dans `utils.js` — suppression `< > " '` et caractères de contrôle |
| 2.4 | HTTPS en production | ✅ | Certificat auto-signé nginx — port 443, redirect 80→443 — `voxelplace-web/Dockerfile` |
| 2.5 | Secrets hors dépôt Git | ✅ | `.env` dans `.gitignore` — `JWT_SECRET`, `POSTGRES_PASSWORD`, `ADMIN_PASSWORD` |
| 2.6 | Principe de moindre privilège | ✅ | Mode admin protégé par mot de passe séparé |
| 2.7 | Rate limiting | ✅ | Cooldown 1s par pixel, par username — vérifié côté serveur |
| 2.8 | Architecture MVC documentée | 🔄 | Séparation utils / grid / auth / index — à expliciter dans le rapport |

---

## 3. DevOps & Tests (`04_devops_testing.md`)

| # | Critère | Statut | Notes |
|---|---------|--------|-------|
| 3.1 | Docker (conteneurisation) | ✅ | API + Frontend + PostgreSQL + Minecraft dans `docker-compose.yml` |
| 3.2 | GitFlow (branches feature/develop/main) | ❌ | Tout sur `main` — à adopter dès maintenant |
| 3.3 | CI/CD | ✅ | GitHub Actions dans `.github/workflows/deploy.yml` — SSH via Tailscale |
| 3.4 | Tests unitaires | ✅ | 34/34 tests — `node:test` — validation, grid, auth (bcrypt + JWT) |
| 3.5 | Captures d'écran tests pour rapport | ❌ | À faire : `npm test` puis screenshot terminal |

---

## 4. Frontend — Accessibilité (`05_frontend_accessibilite.md`)

| # | Critère | Statut | Notes |
|---|---------|--------|-------|
| 4.1 | `alt` sur toutes les images | ✅ | Pas d'images — icônes emoji/texte |
| 4.2 | `<label>` sur tous les champs | ✅ | `App.jsx` — sr-only labels sur tous les inputs (pseudo, password, confirm, admin) |
| 4.3 | Attributs ARIA (`aria-label`, `aria-live`) | ✅ | `aria-live`, `aria-label`, `aria-hidden`, `role="banner"`, `role="tab"`, `role="alert"` |
| 4.4 | Navigation clavier (`:focus-visible`) | ✅ | `index.css` |
| 4.5 | Contraste couleurs ≥ 4.5:1 (WCAG AA) | ❌ | À vérifier avec DevTools (onglet Accessibilité) |

---

## 5. Tests Frontend (`06_frontend_tests_devtools.md`)

| # | Critère | Statut | Notes |
|---|---------|--------|-------|
| 5.1 | Audit Lighthouse ≥ 90 (Performance) | ❌ | À lancer sur la prod et capturer |
| 5.2 | Audit Lighthouse ≥ 90 (Accessibilité) | ❌ | Idem |
| 5.3 | Audit Lighthouse ≥ 90 (SEO) | ❌ | Idem |
| 5.4 | Audit Lighthouse ≥ 90 (Bonnes pratiques) | ❌ | Idem |
| 5.5 | Captures DevTools pour le rapport | ❌ | Network, Console, Elements |

---

## 6. RGPD (`07_frontend_rgpd.md`)

| # | Critère | Statut | Notes |
|---|---------|--------|-------|
| 6.1 | Bandeau cookies / consentement | ✅ | `CookieBanner` dans `App.jsx` — localStorage consent |
| 6.2 | Lien vers politique de confidentialité | ✅ | Bouton dans le bandeau RGPD ouvre la modale |
| 6.3 | Politique de confidentialité | ✅ | `PrivacyModal.jsx` — données collectées, finalité, durée, droits RGPD, lien CNIL |
| 6.4 | Données personnelles protégées | ✅ | Mots de passe hachés bcrypt, jamais stockés en clair |

---

## 7. Conception UML (`08_conception_uml.md`)

| # | Critère | Statut | Notes |
|---|---------|--------|-------|
| 7.1 | Diagramme de classes | ✅ | `docs/uml/class-diagram.md` |
| 7.2 | Diagramme de cas d'utilisation | ✅ | `docs/uml/use-case.md` |
| 7.3 | Diagramme de séquence | ✅ | `docs/uml/sequence-diagram.md` |
| 7.4 | Diagramme de déploiement | ✅ | `docs/uml/deployment-diagram.md` |
| 7.5 | ERD / MLD (Merise) | 🔄 | Textuel + Mermaid dans `docs/uml/erd-merise.md` — MCD visuel à refaire avec Mocodo/Draw.io |

---

## 8. SEO (`12_frontend_seo.md`)

| # | Critère | Statut | Notes |
|---|---------|--------|-------|
| 8.1 | `<title>` pertinent | ✅ | "VoxelPlace — Canvas collaboratif en temps réel" |
| 8.2 | `<meta description>` | ✅ | Description avec Minecraft / Hytale / Roblox |
| 8.3 | `<h1>` unique par page | ❌ | À vérifier — présent dans AuthScreen (`welcome-title`) mais pas dans le shell principal |
| 8.4 | Open Graph tags | ✅ | `og:title`, `og:description`, `og:type` |
| 8.5 | `<meta robots>` | ✅ | `index, follow` |

---

## 9. Maquettage & Responsive (`11_frontend_maquettage_css.md`)

| # | Critère | Statut | Notes |
|---|---------|--------|-------|
| 9.1 | Wireframes réalisés avant le dev | ❌ | À créer rétrospectivement pour le rapport (Figma / Draw.io) |
| 9.2 | Design responsive (media queries) | 🔄 | CSS `max-width: 600px` pour UI — canvas non responsive |
| 9.3 | Canvas responsive / touch | ✅ | Touch events : pan 1 doigt, pinch-to-zoom 2 doigts, tap = clic |
| 9.4 | Flexbox / Grid documentés | ❌ | À mentionner dans le rapport |

---

## 10. Rendus obligatoires (`13_presentation_attendus.md`, `14`, `15`, `16`)

| # | Rendu | Deadline | Statut |
|---|-------|----------|--------|
| 10.1 | **Rapport écrit** (40-60 pages, plan REV2) | J-7 | ❌ |
| 10.2 | **Dossier Professionnel** (template officiel CDA) | S-2 | ❌ |
| 10.3 | **Support de présentation** (slides) | S-1 | ❌ |
| 10.4 | Questionnaire professionnel (révision) | Jour J | ❌ |
| 10.5 | Entretien final non-technique (révision) | Jour J | ❌ |

---

## Priorités recommandées

### Critique — bloquant pour le jury

1. ❌ **GitFlow** — adopter dès maintenant : branches `feature/`, `develop`
2. ❌ **Rapport écrit** — commencer tôt (le plus long)
3. ❌ **Dossier Professionnel** — template RNCP à remplir

### Important — questions fréquentes jury

4. 🔄 **MCD Merise avec losanges** — Mocodo (en ligne) ou Draw.io
5. ❌ **Lighthouse ≥ 90** — captures pour le rapport
6. ❌ **Page politique de confidentialité** — RGPD
7. ❌ **Wireframes** — rétrospectivement pour le rapport
8. ❌ **Captures DevTools + tests** — pour le rapport

### Secondaire — bonus

9. ❌ **Touch events** sur canvas mobile
10. ❌ **CSRF tokens** — justifiable comme non-critique (API stateless JWT)

---

## Future Features

> Évolutions prévues pour VoxelPlace, classées par complexité. Ne pas bloquer le RNCP là-dessus.

| Fonctionnalité | Difficulté | Statut | Composants impactés |
|:---|:---:|:---:|:---|
| **Leaderboard Cross-platform** | ⭐ | ✅ | `Leaderboard.jsx`, Redis `HINCRBY` |
| **Heatmap d'activité** | ⭐⭐ | ✅ | `GridCanvas.jsx` (3e canvas), `GET /api/heatmap` |
| **Timelapse interactif** | ⭐⭐ | ✅ | `Timelapse.jsx`, `pixel_history`, `GET /api/history` |
| **Git log pixel** | ⭐⭐ | ✅ | `PixelHistory.jsx`, clic droit canvas, `GET /api/pixel/:x/:y/history` |
| **Canvas Pulse** | ⭐⭐ | ✅ | `Pulse.jsx`, `GET /api/pulse` (pixels/minute 3h) |
| **Time Capsule** | ⭐⭐⭐ | ✅ | `TimeCapsule.jsx`, `GET /api/snapshot?at=` |
| **Zones contestées** | ⭐⭐⭐ | ✅ | overlay `GridCanvas`, `GET /api/conflicts` (SQL window function) |
| **Redesign UI** | ⭐⭐ | 🔄 | shadcn/ui + Tailwind CSS — branche `feature/ui-redesign` |
| **Client Roblox (Lua)** | ⭐⭐ | ❌ | Backend (Socket.io), Roblox Studio |
| **Client Hytale (Mod API)** | ⭐⭐ | ❌ | Backend (Socket.io), Mod API |
| **Vue 3D (Three.js / Voxel)** | ⭐⭐⭐⭐ | ❌ | Frontend (WebGL), `React-Three-Fiber` |

---

### ✅ Données implémentées (pixel_history)

La table `pixel_history` (PostgreSQL append-only) alimente toutes les features analytics :

- **Heatmap** — `COUNT(*) GROUP BY x, y` → overlay semi-transparent bleu→rouge
- **Timelapse** — replay chronologique événement par événement à vitesse variable (×1 à MAX)
- **Git log pixel** — clic droit → liste des 50 dernières modifications d'une case avec auteur, couleur, date
- **Canvas Pulse** — `date_trunc('minute')` → sparkline pixels/minute sur 3h, refresh 30s
- **Time Capsule** — `DISTINCT ON (x, y) WHERE placed_at <= $1` → état exact du canvas à n'importe quel timestamp
- **Zones contestées** — `LAG(username) OVER (PARTITION BY x, y)` → overlay des pixels écrasés par un autre utilisateur

---

### 🔄 En cours — Redesign UI

Refonte visuelle sur la branche `feature/ui-redesign` avec **shadcn/ui + Tailwind CSS**.

---

### ❌ À venir — Clients cross-game

- **Roblox (Lua)** — WebSocket vers le backend, mapping `BrickColor` → `colorId`
- **Hytale** — intégration via Mod API, mapping blocs → `colorId`

---

### ❌ Vue 3D (Three.js)

Vue alternative WebGL transformant la grille 2D en monde de cubes interactifs.

- **Technologie :** `React-Three-Fiber` + `InstancedMesh` pour optimiser le rendu des 4 096 cubes
