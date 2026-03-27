# Roadmap RNCP 6 — CDA — VoxelPlace

> **Deadline finale : 30 juillet 2025**
> Ce fichier suit l'avancement des critères RNCP 6 (Holberton Toulouse).
> Mettre à jour au fur et à mesure.
>
> ⚠️ **Contexte branche `feature/ui-redesign`** — L'ancien frontend `voxelplace-web` (Vite/React) a été remplacé par `apps/web` (Next.js 16 App Router). Certaines features du frontend (RGPD, accessibilité) sont à réimplémenter dans la nouvelle stack.

---

## Récapitulatif

| # | Catégorie | Fait | Partiel | À faire | Total | Avancement |
|---|-----------|------|---------|---------|-------|-----------|
| 1 | Base de données | 5 | 0 | 0 | 5 | 🟩 100% |
| 2 | Sécurité | 5 | 2 | 1 | 8 | 🟨 63% |
| 3 | DevOps & Tests | 3 | 0 | 2 | 5 | 🟨 60% |
| 4 | Accessibilité | 0 | 1 | 4 | 5 | 🟥 10% |
| 5 | Tests Frontend | 0 | 0 | 5 | 5 | 🟥 0% |
| 6 | RGPD | 0 | 0 | 4 | 4 | 🟥 0% |
| 7 | Conception UML | 5 | 0 | 0 | 5 | 🟩 100% |
| 8 | SEO | 3 | 0 | 2 | 5 | 🟨 60% |
| 9 | Maquettage & Responsive | 1 | 1 | 2 | 4 | 🟨 30% |
| 10 | Rendus obligatoires | 0 | 0 | 5 | 5 | 🟥 0% |
| — | **TOTAL** | **22** | **4** | **25** | **51** | **~43%** |

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
| 2.2 | Protection CSRF (tokens) | 🔄 | API stateless JWT — CSRF non critique, à justifier dans le rapport (API JSON sans cookie de session) |
| 2.3 | Protection XSS | ✅ | `sanitizeUsername()` dans `apps/socket-server/src/features/canvas/utils.js` — suppression `< > " '` et caractères de contrôle |
| 2.4 | HTTPS en production | 🔄 | À configurer sur le reverse proxy ou via Cloudflare — Next.js standalone écoute en HTTP sur port 3000 |
| 2.5 | Secrets hors dépôt Git | ✅ | `.env` dans `.gitignore` — `JWT_SECRET`, `POSTGRES_PASSWORD`, `ADMIN_PASSWORD` — `.env.example` fourni à la racine |
| 2.6 | Principe de moindre privilège | ✅ | Mode admin protégé par `ADMIN_PASSWORD` séparé, vérifié côté serveur — user `nextjs` non-root dans le container Docker web |
| 2.7 | Rate limiting | ✅ | Cooldown 1 pixel/seconde par `username` — vérifié côté serveur dans `apps/socket-server/src/index.js` |
| 2.8 | Architecture MVC documentée | ❌ | À expliciter dans le rapport (features/ = contrôleurs, Zustand store = modèles, React = vues) |

---

## 3. DevOps & Tests (`04_devops_testing.md`)

| # | Critère | Statut | Notes |
|---|---------|--------|-------|
| 3.1 | Docker (conteneurisation) | ✅ | 3 services dans `docker-compose.yml` : `voxelplace-web` (Next.js standalone), `voxelplace-api` (Fastify), `voxelplace-db` (PostgreSQL) |
| 3.2 | GitFlow (branches feature/develop/main) | ✅ | Branche `feature/ui-redesign` active — adopter `develop` pour la suite avant le merge |
| 3.3 | CI/CD | ✅ | GitHub Actions dans `.github/workflows/deploy.yml` — SSH via Tailscale après push sur `main` |
| 3.4 | Tests unitaires | ✅ | 34/34 tests — `node:test` dans `apps/socket-server/tests/` (auth, grid, validation) |
| 3.5 | Captures d'écran tests pour rapport | ❌ | À faire : `npx turbo run test --filter=@voxelplace/socket-server` puis screenshot terminal |

---

## 4. Frontend — Accessibilité (`05_frontend_accessibilite.md`)

> ⚠️ L'ancien `voxelplace-web/src/App.jsx` (qui avait les attributs ARIA et labels) a été supprimé dans la refonte. À réimplémenter dans `apps/web`.

| # | Critère | Statut | Notes |
|---|---------|--------|-------|
| 4.1 | `alt` sur toutes les images | 🔄 | Pas d'images pour l'instant — vérifier si des `<img>` sont ajoutées dans le HUD |
| 4.2 | `<label>` sur tous les champs | ❌ | La page auth `apps/web/app/(auth)/` n'existe pas encore — à implémenter avec labels `sr-only` |
| 4.3 | Attributs ARIA (`aria-label`, `aria-live`) | ❌ | À ajouter sur les composants HUD (ColorDock, StatusPills) et la future page auth |
| 4.4 | Navigation clavier (`:focus-visible`) | ❌ | À ajouter dans `packages/styles/src/globals.css` |
| 4.5 | Contraste couleurs ≥ 4.5:1 (WCAG AA) | ❌ | À vérifier avec DevTools sur le thème Caelestia — tokens définis dans `packages/styles/src/globals.css` |

---

## 5. Tests Frontend (`06_frontend_tests_devtools.md`)

| # | Critère | Statut | Notes |
|---|---------|--------|-------|
| 5.1 | Audit Lighthouse ≥ 90 (Performance) | ❌ | À lancer sur la prod et capturer |
| 5.2 | Audit Lighthouse ≥ 90 (Accessibilité) | ❌ | Idem |
| 5.3 | Audit Lighthouse ≥ 90 (SEO) | ❌ | Idem |
| 5.4 | Audit Lighthouse ≥ 90 (Bonnes pratiques) | ❌ | Idem |
| 5.5 | Captures DevTools pour le rapport | ❌ | Network (WebSocket frames), Console, Elements |

---

## 6. RGPD (`07_frontend_rgpd.md`)

> ⚠️ Les composants `PrivacyModal.jsx` et `CookieBanner` de l'ancien frontend ont été supprimés dans la refonte. À réimplémenter dans `apps/web`.

| # | Critère | Statut | Notes |
|---|---------|--------|-------|
| 6.1 | Bandeau cookies / consentement | ❌ | À créer dans `apps/web/shared/components/CookieBanner.tsx` |
| 6.2 | Lien vers politique de confidentialité | ❌ | Lié au bandeau cookies |
| 6.3 | Politique de confidentialité | ❌ | À créer — page `apps/web/app/privacy/page.tsx` ou modale |
| 6.4 | Données personnelles protégées | ❌ | À documenter dans le rapport : bcrypt, JWT, pas de tracking tiers |

---

## 7. Conception UML (`08_conception_uml.md`)

| # | Critère | Statut | Notes |
|---|---------|--------|-------|
| 7.1 | Diagramme de classes | ✅ | `docs/uml/class-diagram.md` — backend Fastify + frontend Next.js/PixiJS/Zustand + plugin Minecraft |
| 7.2 | Diagramme de cas d'utilisation | ✅ | `docs/uml/use-case.md` |
| 7.3 | Diagramme de séquence | ✅ | `docs/uml/sequence-diagram.md` |
| 7.4 | Diagramme de déploiement | ✅ | `docs/uml/deployment-diagram.md` — Next.js standalone + Fastify + PostgreSQL + Redis (hors Docker) |
| 7.5 | ERD / MLD (Merise) | ✅ | `docs/uml/erd-merise.md` — MCD textuel + MLD + ERD Mermaid |

---

## 8. SEO (`12_frontend_seo.md`)

| # | Critère | Statut | Notes |
|---|---------|--------|-------|
| 8.1 | `<title>` pertinent | ✅ | `"VoxelPlace"` dans `apps/web/app/layout.tsx` — à enrichir par page |
| 8.2 | `<meta description>` | ✅ | `"Canvas collaboratif multijoueur en temps réel"` dans `apps/web/app/layout.tsx` |
| 8.3 | `<h1>` unique par page | ❌ | La page game `apps/web/app/(game)/page.tsx` n'a pas de `<h1>` — à ajouter en `sr-only` |
| 8.4 | Open Graph tags | ❌ | À ajouter dans `apps/web/app/layout.tsx` (`og:title`, `og:description`, `og:image`) |
| 8.5 | `<meta robots>` | ✅ | Next.js génère `index, follow` par défaut |

---

## 9. Maquettage & Responsive (`11_frontend_maquettage_css.md`)

| # | Critère | Statut | Notes |
|---|---------|--------|-------|
| 9.1 | Wireframes réalisés avant le dev | ❌ | À créer rétrospectivement pour le rapport (Figma / Draw.io / Pencil) |
| 9.2 | Design responsive (media queries) | 🔄 | Tailwind CSS 4 utilisé — vérifier sur mobile (le canvas est fixe `100vw×100vh`) |
| 9.3 | Canvas responsive / touch | ✅ | Pan souris + zoom molette — touch events à ajouter pour mobile |
| 9.4 | Flexbox / Grid documentés | ❌ | À mentionner dans le rapport — `GameFrame` utilise `fixed inset-6` + Flexbox pour les éléments HUD |

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

1. ❌ **RGPD** — réimplémenter bandeau cookies + page politique de confidentialité dans `apps/web`
2. ❌ **Accessibilité** — labels `sr-only`, ARIA, `:focus-visible` dans `packages/styles/src/globals.css`
3. ❌ **Rapport écrit** — commencer tôt (le plus long — 40-60 pages)
4. ❌ **Dossier Professionnel** — template RNCP à remplir

### Important — questions fréquentes jury

5. 🔄 **HTTPS** — configurer Cloudflare ou nginx reverse proxy devant Next.js standalone
6. ❌ **Open Graph** — ajouter `og:*` dans `apps/web/app/layout.tsx`
7. ❌ **`<h1>` sr-only** — ajouter dans `apps/web/app/(game)/page.tsx`
8. ❌ **Lighthouse ≥ 90** — captures pour le rapport
9. ❌ **Wireframes** — rétrospectivement pour le rapport

### Secondaire — bonus

10. ❌ **MCD Merise avec losanges** — Mocodo (en ligne) ou Draw.io pour le rapport
11. ❌ **Captures DevTools + tests** — pour le rapport

---

## Future Features

> Évolutions prévues pour VoxelPlace, classées par complexité.

| Fonctionnalité | Difficulté | Statut | Composants impactés |
|:---|:---:|:---:|:---|
| **HUD Phase 3** (ColorDock, StatusPills, SidebarLeft) | ⭐ | 🔄 | `apps/web/features/hud/` |
| **RGPD** (bandeau + privacy) | ⭐ | ❌ | `apps/web/shared/components/` |
| **SEO** (Open Graph + h1 sr-only) | ⭐ | ❌ | `apps/web/app/layout.tsx` |
| **Auth Clerk / JWT** | ⭐⭐ | ❌ | `apps/web/app/(auth)/`, `@clerk/nextjs` |
| **Dashboard admin** | ⭐⭐ | ❌ | `apps/web/features/admin/` |
| **Heatmap + Timelapse** | ⭐⭐ | ❌ | `apps/web/features/stats/` |
| **Client Roblox (Lua)** | ⭐⭐ | ❌ | `apps/game-bridges/roblox/` |
| **Client Hytale** | ⭐⭐ | ❌ | `apps/game-bridges/hytale/` |
| **Vue 3D (Three.js)** | ⭐⭐⭐⭐ | ❌ | `apps/web/features/canvas/` |

---

## État de la branche `feature/ui-redesign` (27 mars 2026)

| Composant | Statut |
|---|---|
| Migration Turborepo monorepo (`apps/`, `packages/`) | ✅ |
| `apps/web` — Next.js 16 App Router + Turbopack | ✅ |
| `apps/socket-server` — Fastify 5 refactorisé en `features/` | ✅ |
| `packages/db` — Drizzle ORM (`users` + `pixel_history`) | ✅ |
| `packages/types` — interfaces TypeScript partagées | ✅ |
| `packages/styles` — Tailwind CSS 4 + tokens Caelestia (dark/light) | ✅ |
| Moteur PixiJS v8 (`BufferImageSource`, zoom molette, pan espace+glisser) | ✅ |
| Zustand `canvasStore` (grille, couleur, hover, cooldown) | ✅ |
| Zustand `cockpitStore` (sidebar, activeNavItem) | ✅ |
| `GameFrame` — cadre HUD fixe `inset-6 rounded-[48px]` | ✅ |
| `ColorDock` — palette 8 couleurs (stub) | 🔄 |
| `SidebarLeft` — navigation icônes (stub) | 🔄 |
| `StatusPills` — stats temps réel (stub) | 🔄 |
| Docker Compose mis à jour (Next.js standalone + PostgreSQL) | ✅ |
| CI/CD GitHub Actions mis à jour | ✅ |
| RGPD (bandeau cookies + privacy) | ❌ |
| Accessibilité (ARIA, labels, focus-visible) | ❌ |

> **Prochaines étapes** : implémenter Phase 3 HUD, puis RGPD + accessibilité, puis merger dans `develop`.
