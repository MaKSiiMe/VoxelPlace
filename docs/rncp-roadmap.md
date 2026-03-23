# Roadmap RNCP 6 — CDA — VoxelPlace

> **Deadline finale : 30 juillet 2025**
> Ce fichier suit l'avancement des critères RNCP 6 (Holberton Toulouse).
> Mettre à jour au fur et à mesure.

---

## Récapitulatif

| # | Catégorie | Fait | Partiel | À faire | Total | Avancement |
|---|-----------|------|---------|---------|-------|-----------|
| 1 | Base de données | 2 | 1 | 2 | 5 | 🟨 40% |
| 2 | Sécurité | 6 | 1 | 1 | 8 | 🟩 75% |
| 3 | DevOps & Tests | 3 | 0 | 2 | 5 | 🟩 60% |
| 4 | Accessibilité | 4 | 0 | 1 | 5 | 🟩 80% |
| 5 | Tests Frontend | 0 | 0 | 5 | 5 | 🟥 0% |
| 6 | RGPD | 2 | 1 | 1 | 4 | 🟨 50% |
| 7 | Conception UML | 4 | 1 | 0 | 5 | 🟩 80% |
| 8 | SEO | 4 | 0 | 1 | 5 | 🟩 80% |
| 9 | Maquettage & Responsive | 0 | 1 | 3 | 4 | 🟥 10% |
| 10 | Rendus obligatoires | 0 | 0 | 5 | 5 | 🟥 0% |
| — | **TOTAL** | **23** | **5** | **23** | **51** | **~45%** |

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
| 1.1 | Méthode Merise : MCD → MLD → MPD | 🔄 | MLD + ERD Mermaid dans `docs/uml/erd-merise.md` — MCD avec losanges à refaire avec Mocodo/Draw.io |
| 1.2 | ERD avant le code | ✅ | `docs/uml/erd-merise.md` |
| 1.3 | BDD SQL (MySQL/PostgreSQL) | ❌ | Redis uniquement — PostgreSQL pour comptes utilisateurs prévu |
| 1.4 | Requêtes préparées anti-injection | 🚫 | Redis (pas SQL) — justification Redis documentée dans erd-merise.md |
| 1.5 | BDD hébergée ou démarche documentée | ✅ | Redis sur serveur Debian |

---

## 2. Sécurité (`03_backend_securite_infrastructure.md`)

| # | Critère | Statut | Notes |
|---|---------|--------|-------|
| 2.1 | Hachage des mots de passe (bcrypt) | ✅ | `voxelplace-api/src/auth.js` — bcryptjs + JWT, endpoints `/api/auth/register` et `/api/auth/login` |
| 2.2 | Protection CSRF (tokens) | ❌ | Auth JWT en place — CSRF non critique pour une API stateless |
| 2.3 | Protection XSS | ✅ | `sanitizeUsername()` dans `voxelplace-api/src/utils.js` |
| 2.4 | HTTPS en production | ✅ | Certificat auto-signé nginx — `voxelplace-web/Dockerfile` + `nginx.conf` (port 443, redirect 80→443) |
| 2.5 | Secrets hors dépôt Git | ✅ | `.env` dans `.gitignore` |
| 2.6 | Principe de moindre privilège | ✅ | Mode admin protégé par mot de passe |
| 2.7 | Rate limiting | ✅ | Cooldown 5 min par pixel |
| 2.8 | Architecture MVC documentée | 🔄 | Séparation utils/service implicite — à expliciter dans le rapport |

---

## 3. DevOps & Tests (`04_devops_testing.md`)

| # | Critère | Statut | Notes |
|---|---------|--------|-------|
| 3.1 | Docker (conteneurisation) | ✅ | API + Frontend + Minecraft dans `docker-compose.yml` |
| 3.2 | GitFlow (branches feature/develop/main) | ❌ | Tout sur `main` — à adopter dès maintenant |
| 3.3 | CI/CD | ✅ | GitHub Actions dans `.github/workflows/deploy.yml` |
| 3.4 | Tests unitaires | ✅ | 24/24 tests — `voxelplace-api/tests/` avec `node:test` |
| 3.5 | Captures d'écran tests pour rapport | ❌ | À faire avec `npm test` et screenshot terminal |

---

## 4. Frontend — Accessibilité (`05_frontend_accessibilite.md`)

| # | Critère | Statut | Notes |
|---|---------|--------|-------|
| 4.1 | `alt` sur toutes les images | ✅ | Pas d'images — icônes emoji/texte |
| 4.2 | `<label>` sur tous les champs | ✅ | `voxelplace-web/src/App.jsx` — sr-only labels |
| 4.3 | Attributs ARIA (`aria-label`, `aria-live`) | ✅ | `aria-live`, `aria-label`, `aria-hidden`, `role="banner"` |
| 4.4 | Navigation clavier (`:focus-visible`) | ✅ | `voxelplace-web/src/index.css` |
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
| 6.2 | Lien vers politique de confidentialité | 🔄 | Lien CNIL présent — page dédiée manquante |
| 6.3 | Politique de confidentialité | ❌ | Page ou section à créer |
| 6.4 | Pas de données personnelles sensibles stockées | ✅ | Pseudo libre, pas de mot de passe (pour l'instant) |

---

## 7. Conception UML (`08_conception_uml.md`)

| # | Critère | Statut | Notes |
|---|---------|--------|-------|
| 7.1 | Diagramme de classes | ✅ | `docs/uml/class-diagram.md` |
| 7.2 | Diagramme de cas d'utilisation | ✅ | `docs/uml/use-case.md` |
| 7.3 | Diagramme de séquence | ✅ | `docs/uml/sequence-diagram.md` |
| 7.4 | Diagramme de déploiement | ✅ | `docs/uml/deployment-diagram.md` |
| 7.5 | ERD / MLD (Merise) | 🔄 | Textuel + Mermaid dans `docs/uml/erd-merise.md` — MCD visuel à refaire |

---

## 8. SEO (`12_frontend_seo.md`)

| # | Critère | Statut | Notes |
|---|---------|--------|-------|
| 8.1 | `<title>` pertinent | ✅ | "VoxelPlace — Canvas collaboratif en temps réel" |
| 8.2 | `<meta description>` | ✅ | Description avec Minecraft / Hytale / Roblox |
| 8.3 | `<h1>` unique par page | ❌ | À vérifier — peut manquer dans `App.jsx` |
| 8.4 | Open Graph tags | ✅ | `og:title`, `og:description`, `og:type` |
| 8.5 | `<meta robots>` | ✅ | `index, follow` |

---

## 9. Maquettage & Responsive (`11_frontend_maquettage_css.md`)

| # | Critère | Statut | Notes |
|---|---------|--------|-------|
| 9.1 | Wireframes réalisés avant le dev | ❌ | À créer rétrospectivement pour le rapport (Figma / draw.io) |
| 9.2 | Design responsive (media queries) | 🔄 | CSS media `max-width: 600px` pour UI — canvas non responsive |
| 9.3 | Canvas responsive / touch | ❌ | Pas de support pinch-to-zoom / touch events |
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

1. ❌ **Authentification bcrypt** — comptes utilisateurs (attendu par tous les jurés CDA)
2. ❌ **HTTPS** — Let's Encrypt / Caddy (1-2h)
3. ❌ **GitFlow** — adopter maintenant : branches `feature/`, `develop`
4. ❌ **Rapport écrit** — commencer tôt (le plus long)
5. ❌ **Dossier Professionnel** — template RNCP à remplir

### Important — questions fréquentes jury

6. 🔄 **MCD Merise avec losanges** — Mocodo (en ligne) ou Draw.io
7. ❌ **Lighthouse ≥ 90** — captures pour le rapport
8. ❌ **Page politique de confidentialité** — RGPD
9. ❌ **Wireframes** — rétrospectivement pour le rapport
10. ❌ **`<h1>` unique** — vérifier App.jsx

### Secondaire — bonus

11. ❌ **PostgreSQL** pour comptes utilisateurs (montrerait la maîtrise SQL+NoSQL)
12. ❌ **CSRF tokens** (si auth implémentée)
13. ❌ **Touch events** sur canvas mobile
14. ❌ **Captures DevTools** (Network, Console) pour le rapport
