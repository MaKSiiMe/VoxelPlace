# Roadmap RNCP 6 — CDA — VoxelPlace

> **Deadline finale : 30 juillet 2025**
> Ce fichier suit l'avancement des critères RNCP 6 (Holberton Toulouse).
> Mettre à jour au fur et à mesure.
>
> 🔄 **Mise à jour du 22 juin 2026** — Gros rattrapage depuis la dernière revue (27 mars 2026) : RGPD, Lighthouse, rapport écrit et dossier professionnel ont tous avancé significativement. Cette version reflète l'état réel du dépôt à cette date (y compris les fichiers non commités `docs/rapport.md`, `docs/dossier/`, et le diff en cours sur `docs/uml/class-diagram.md`).

---

## Récapitulatif

| # | Catégorie | Fait | Partiel | À faire | Total | Avancement |
|---|-----------|------|---------|---------|-------|-----------|
| 1 | Base de données | 5 | 0 | 0 | 5 | 🟩 100% |
| 2 | Sécurité | 5 | 2 | 1 | 8 | 🟨 75% |
| 3 | DevOps & Tests | 4 | 0 | 1 | 5 | 🟩 80% |
| 4 | Accessibilité | 2 | 1 | 2 | 5 | 🟨 50% |
| 5 | Tests Frontend | 3 | 1 | 1 | 5 | 🟨 70% |
| 6 | RGPD | 4 | 0 | 0 | 4 | 🟩 100% |
| 7 | Conception UML | 5 | 0 | 0 | 5 | 🟩 100% |
| 8 | SEO | 5 | 0 | 0 | 5 | 🟩 100% |
| 9 | Maquettage & Responsive | 3 | 1 | 0 | 4 | 🟩 88% |
| 10 | Rendus obligatoires | 0 | 2 | 3 | 5 | 🟥 20% |
| — | **TOTAL** | **36** | **7** | **8** | **51** | **~78%** |

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
| 1.3 | BDD SQL (MySQL/PostgreSQL) | ✅ | PostgreSQL 16 — tables `users` + `pixel_history` via Drizzle ORM — container `voxelplace-db` |
| 1.4 | Requêtes préparées anti-injection SQL | ✅ | `$1, $2` dans `apps/socket-server/src/features/auth/routes.js` — INSERT/SELECT paramétrés |
| 1.5 | BDD hébergée ou démarche documentée | ✅ | Redis + PostgreSQL sur serveur Debian, persistés via volumes Docker |

---

## 2. Sécurité (`03_backend_securite_infrastructure.md`)

| # | Critère | Statut | Notes |
|---|---------|--------|-------|
| 2.1 | Hachage des mots de passe (bcrypt) | ✅ | `bcryptjs` 10 rounds — `hashPassword()` / `verifyPassword()` dans `apps/socket-server/src/features/auth/routes.js` |
| 2.2 | Protection CSRF (tokens) | 🔄 | API stateless JWT — CSRF non critique, à justifier dans le rapport (API JSON sans cookie de session) — argumentaire déjà rédigé dans `docs/rapport.md` §3 |
| 2.3 | Protection XSS | ✅ | `sanitizeUsername()` dans `apps/socket-server/src/features/canvas/utils.js` — suppression `< > " '` et caractères de contrôle |
| 2.4 | HTTPS en production | 🔄 | Reverse proxy `voxelplace-nginx` ajouté dans `docker-compose.yml` (routage `/`, `/api/`, `/socket.io/`) mais écoute en HTTP (port 80) — HTTPS réel fourni en amont par Tailscale Funnel, pas par nginx. À documenter clairement dans le rapport comme architecture assumée |
| 2.5 | Secrets hors dépôt Git | ✅ | `.env` dans `.gitignore` — `JWT_SECRET`, `POSTGRES_PASSWORD`, `ADMIN_PASSWORD` — `.env.example` fourni à la racine |
| 2.6 | Principe de moindre privilège | ✅ | Mode admin protégé par `ADMIN_PASSWORD` séparé, vérifié côté serveur — user `nextjs` non-root dans le container Docker web |
| 2.7 | Rate limiting | ✅ | Cooldown 1 pixel/seconde par `username` — vérifié côté serveur dans `apps/socket-server/src/index.js` |
| 2.8 | Architecture MVC documentée | ❌ | Toujours à expliciter dans le rapport (features/ = contrôleurs, Zustand store = modèles, React = vues) — non trouvé dans `docs/rapport.md` actuel, à ajouter |

---

## 3. DevOps & Tests (`04_devops_testing.md`)

| # | Critère | Statut | Notes |
|---|---------|--------|-------|
| 3.1 | Docker (conteneurisation) | ✅ | 4 services dans `docker-compose.yml` : `voxelplace-web`, `voxelplace-api`, `voxelplace-db`, `voxelplace-nginx` (reverse proxy ajouté) |
| 3.2 | GitFlow (branches feature/develop/main) | ✅ | Branches `feature/backend`, `feature/frontend`, `feature/game-integrations` mergées directement sur `main` — pas de branche `develop`, mais suffisant pour un projet solo (décision assumée, pas de surcharge de process inutile) |
| 3.3 | CI/CD | ✅ | GitHub Actions dans `.github/workflows/deploy.yml` — SSH via Tailscale après push sur `main` |
| 3.4 | Tests unitaires | ✅ | Suite `node:test` dans `apps/socket-server/tests/` (auth, grid, validation) |
| 3.5 | Captures d'écran tests pour rapport | ❌ | À faire : `npx turbo run test --filter=@voxelplace/socket-server` puis screenshot terminal |

---

## 4. Frontend — Accessibilité (`05_frontend_accessibilite.md`)

| # | Critère | Statut | Notes |
|---|---------|--------|-------|
| 4.1 | `alt` sur toutes les images | 🔄 | Pas d'images bitmap dans l'app pour l'instant (HUD en CSS/SVG inline) — non applicable en l'état, à revérifier si des `<img>` sont ajoutées |
| 4.2 | `<label>` sur tous les champs | 🔄 | Présent dans le code (`AuthModal.tsx` lignes 106/119) mais pas encore branché/affiché sur le front réellement utilisé — à confirmer une fois le front rattrapé |
| 4.3 | Attributs ARIA (`aria-label`, `aria-live`) | 🔄 | `aria-label` présent dans le code mais front pas encore à jour — `aria-live` absent partout. **Groupé avec `:focus-visible`, à faire ensemble lors de la prochaine session front** |
| 4.4 | Navigation clavier (`:focus-visible`) | ❌ | Aucune règle `:focus-visible` trouvée — à faire en même temps que `aria-live`, lors de la prochaine session sur le front |
| 4.5 | Contraste couleurs ≥ 4.5:1 (WCAG AA) | ✅ | Confirmé par l'audit Lighthouse (`docs/lighthouse.md`) — score Accessibilité 95/100 desktop et mobile sur le thème Tokyo Night |

---

## 5. Tests Frontend (`06_frontend_tests_devtools.md`)

| # | Critère | Statut | Notes |
|---|---------|--------|-------|
| 5.1 | Audit Lighthouse ≥ 90 (Performance) | 🔄 | Desktop **97/100** ✅ — Mobile **~75/100** ❌ (sous le seuil), optimisations `next/dynamic` déjà faites (TBT 480ms → 64ms), reste à pousser le mobile au-dessus de 90 |
| 5.2 | Audit Lighthouse ≥ 90 (Accessibilité) | ✅ | 95/100 desktop et mobile — `docs/lighthouse.md` |
| 5.3 | Audit Lighthouse ≥ 90 (SEO) | ✅ | 100/100 desktop et mobile |
| 5.4 | Audit Lighthouse ≥ 90 (Bonnes pratiques) | ✅ | 100/100 desktop et mobile |
| 5.5 | Captures DevTools pour le rapport | ❌ | Network (frames WebSocket), Console, Elements — toujours à capturer pour les annexes du rapport |

---

## 6. RGPD (`07_frontend_rgpd.md`)

| # | Critère | Statut | Notes |
|---|---------|--------|-------|
| 6.1 | Bandeau cookies / consentement | ✅ | `apps/web/features/rgpd/CookieBanner.tsx` — consentement persisté en `localStorage` (`voxelplace:cookies-consent`), boutons Accepter/Refuser, `role="dialog"` |
| 6.2 | Lien vers politique de confidentialité | ✅ | Lien intégré dans `CookieBanner.tsx` vers `/privacy` |
| 6.3 | Politique de confidentialité | ✅ | `apps/web/app/privacy/page.tsx` — 8 sections (responsable de traitement, données collectées, finalité, localStorage, durée de conservation, droits RGPD, sécurité, contact) |
| 6.4 | Données personnelles protégées | ✅ | Documenté dans `apps/web/app/privacy/page.tsx` et `docs/rapport.md` : bcrypt, JWT, rate limiting, pas de tracking tiers |

---

## 7. Conception UML (`08_conception_uml.md`)

| # | Critère | Statut | Notes |
|---|---------|--------|-------|
| 7.1 | Diagramme de classes | ✅ | `docs/uml/class-diagram.md` — ⚠️ modifications en cours non commitées (ajout `DashboardService`, `AuthStore`, `CanvasEngine`, `AdminDashboard`) — **à committer** |
| 7.2 | Diagramme de cas d'utilisation | ✅ | `docs/uml/use-case.md` |
| 7.3 | Diagramme de séquence | ✅ | `docs/uml/sequence-diagram.md` |
| 7.4 | Diagramme de déploiement | ✅ | `docs/uml/deployment-diagram.md` — Next.js standalone + Fastify + PostgreSQL + Redis (hors Docker) |
| 7.5 | ERD / MLD (Merise) | ✅ | `docs/uml/erd-merise.md` — MCD textuel + MLD + ERD Mermaid |

---

## 8. SEO (`12_frontend_seo.md`)

| # | Critère | Statut | Notes |
|---|---------|--------|-------|
| 8.1 | `<title>` pertinent | ✅ | Template dynamique par page dans `apps/web/app/layout.tsx` |
| 8.2 | `<meta description>` | ✅ | `"Canvas collaboratif multijoueur en temps réel"` |
| 8.3 | `<h1>` unique par page | ✅ | `apps/web/app/(game)/page.tsx:59` — `<h1 className="sr-only">VoxelPlace — Canvas collaboratif multijoueur</h1>`, idem `app/dashboard/page.tsx` |
| 8.4 | Open Graph tags | ✅ | `og:title`, `og:description`, `og:image`, `og:type`, `og:locale` + Twitter Card dans `apps/web/app/layout.tsx` |
| 8.5 | `<meta robots>` | ✅ | Next.js génère `index, follow` par défaut |

---

## 9. Maquettage & Responsive (`11_frontend_maquettage_css.md`)

| # | Critère | Statut | Notes |
|---|---------|--------|-------|
| 9.1 | Wireframes réalisés avant le dev | ✅ | Présents dans `docs/dossier/05_specifications_fonctionnelles.md` |
| 9.2 | Design responsive (media queries) | 🔄 | Tailwind CSS 4 utilisé — le score Lighthouse Performance mobile (~75) suggère un rendu mobile encore à affiner ; canvas fixe `100vw×100vh` à revalider sur petits écrans |
| 9.3 | Canvas responsive / touch | ✅ | Pan souris + zoom molette — touch events à ajouter pour mobile |
| 9.4 | Flexbox / Grid documentés | ✅ | Documenté dans `docs/rapport.md` §3 et `docs/dossier/06_specifications_techniques.md` — `GameFrame` (`fixed inset-6` + Flexbox HUD) |

---

## 10. Rendus obligatoires (`13_presentation_attendus.md`, `14`, `15`, `16`)

| # | Rendu | Deadline | Statut | Notes |
|---|-------|----------|--------|-------|
| 10.1 | **Rapport écrit** (40-60 pages, plan REV2) | J-7 | 🔄 | Contenu rédigé en brouillon dans `docs/rapport.md` (532 lignes, 5 sections : Présentation, Conception, Réalisation, Tests & qualité, Bilan) — **mise en forme finale prévue sur Office, hors dépôt Git** ; le `.md` reste une source de travail, pas le livrable final |
| 10.2 | **Dossier Professionnel** (template officiel CDA) | S-2 | 🔄 | Contenu rédigé en brouillon dans `docs/dossier/` (12 fichiers : compétences, cahier des charges, spécifications, réalisations, tests, veille) — **mise en forme finale prévue sur Canva/Office, hors dépôt Git** ; signatures, numérotation et annexes à faire dans l'outil final |
| 10.3 | **Support de présentation** (slides) | S-1 | ❌ | Pas encore commencé |
| 10.4 | Questionnaire professionnel (révision) | Jour J | ❌ | Révision à planifier — voir `09_questionnaire_professionnel.md` |
| 10.5 | Entretien final non-technique (révision) | Jour J | ❌ | Révision à planifier — voir `01_simulation_entretien_final.md` |

---

## Priorités recommandées

### Critique — bloquant pour le jury

1. ❌ **Support de présentation** — créer les slides sur Canva (rien commencé)
2. 🔄 **Finaliser rapport + dossier sur Canva/Office** — reprendre les brouillons `.md` et les mettre en forme dans l'outil final (mise en page, annexes, captures d'écran, signatures) ; le contenu de fond est déjà rédigé

### Important — à faire lors de la prochaine session front

3. ❌ **`:focus-visible` + `aria-live`** — à coder ensemble dans `packages/styles/src/globals.css` / composants HUD, une fois le front rattrapé sur les boutons
4. 🔄 **Lighthouse mobile Performance** — passer de ~75 à ≥90 (le desktop est déjà à 97), pas prioritaire (site pensé PC)
5. 🔄 **Responsive mobile du canvas** — touch events, vérifier sur petits écrans (lié au point précédent)

### Secondaire — bonus

6. 🔄 **Committer le diff de `docs/uml/class-diagram.md`** (DashboardService, AuthStore, CanvasEngine, AdminDashboard) — uniquement ce fichier UML, pas le rapport/dossier qui restent hors dépôt
7. ❌ **Révisions questionnaire + entretien final** — à planifier dans les dernières semaines

### Non-problèmes (clarifiés, pas d'action requise)

- ✅ **Architecture MVC** — déjà en place dans le code (features/routes = contrôleurs, stores = modèles, React = vues), juste à savoir l'expliquer à l'oral
- ✅ **HTTPS / nginx** — fonctionne (nginx = reverse proxy interne, HTTPS géré par Tailscale Funnel en amont), choix d'architecture assumé, rien à corriger
- ✅ **Branche `develop`** — pas nécessaire en solo, 3 branches `feature/*` suffisent
- 🚫 **Captures DevTools + tests** — concernent uniquement le rapport (hors scope code)

---

## Future Features

> Évolutions prévues pour VoxelPlace, classées par complexité.

| Fonctionnalité | Difficulté | Statut | Composants impactés |
|:---|:---:|:---:|:---|
| **HUD complet** (BottomDrawer, StatusPills, StatsModal, SettingsModal, SupportModal, LeaderboardModal) | ⭐ | ✅ | `apps/web/features/hud/` |
| **RGPD** (bandeau + privacy) | ⭐ | ✅ | `apps/web/features/rgpd/`, `apps/web/app/privacy/` |
| **SEO** (Open Graph + h1 sr-only) | ⭐ | ✅ | `apps/web/app/layout.tsx` |
| **Auth** (modale + JWT) | ⭐⭐ | ✅ | `apps/web/features/auth/` |
| **Dashboard admin** | ⭐⭐ | ✅ | `apps/web/app/dashboard/`, `DashboardService` (en cours dans le diagramme de classes) |
| **Heatmap + Timelapse** | ⭐⭐ | ❌ | `apps/web/features/stats/` |
| **Client Roblox (Lua)** | ⭐⭐ | ❌ | `apps/game-bridges/roblox/` |
| **Client Hytale** | ⭐⭐ | ❌ | `apps/game-bridges/hytale/` |
| **Vue 3D (Three.js)** | ⭐⭐⭐⭐ | ❌ | `apps/web/features/canvas/` |

---

## État des branches (22 juin 2026)

| Composant | Statut |
|---|---|
| Migration Turborepo monorepo (`apps/`, `packages/`) | ✅ |
| `apps/web` — Next.js 16 App Router + Turbopack | ✅ |
| `apps/socket-server` — Fastify 5 refactorisé en `features/` | ✅ |
| `packages/db` — Drizzle ORM (`users` + `pixel_history`) | ✅ |
| `packages/types` — interfaces TypeScript partagées | ✅ |
| `packages/styles` — Tailwind CSS 4 + tokens Tokyo Night (dark/light) | ✅ |
| Moteur PixiJS v8 (`BufferImageSource`, zoom molette, pan espace+glisser) | ✅ |
| Zustand `canvasStore`, `cockpitStore`, `hud/store`, `auth/store` | ✅ |
| HUD complet (`GameFrame`, `BottomDrawer`, `StatusPills`, modales) | ✅ |
| Authentification (modale + JWT) | ✅ |
| Dashboard admin | ✅ |
| `voxelplace-nginx` (reverse proxy) ajouté au `docker-compose.yml` | ✅ |
| CI/CD GitHub Actions mis à jour | ✅ |
| RGPD (bandeau cookies + privacy) | ✅ |
| Accessibilité (ARIA, labels, focus-visible) | 🔄 (labels + aria-label faits, `:focus-visible` et `aria-live` manquants) |
| Rapport écrit (`docs/rapport.md`) | 🔄 (brouillon de contenu rédigé — mise en forme finale prévue sur Office, hors Git) |
| Dossier professionnel (`docs/dossier/`) | 🔄 (brouillon de contenu rédigé — mise en forme finale prévue sur Canva/Office, hors Git) |
| Branches actuelles | `feature/backend`, `feature/frontend`, `feature/game-integrations` → mergées directement sur `main`, **pas de `develop`** |

> **Prochaines étapes** : committer le diff de `class-diagram.md` (sans toucher au statut des `.md` rapport/dossier, qui restent des brouillons de travail) ; ajouter `:focus-visible` + `aria-live` ; pousser le score Lighthouse mobile au-dessus de 90 ; reprendre le contenu de `docs/rapport.md` et `docs/dossier/` dans Office/Canva pour la mise en forme finale ; démarrer le support de présentation (slides) sur Canva ; créer la branche `develop`.
