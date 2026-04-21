<div align="center">

# VoxelPlace

**Canvas collaboratif en temps réel — inspiré de r/place**

*Projet de fin d'année — Holberton School · Validation RNCP 6 (CDA)*

[![Deploy](https://github.com/MaKSiiMe/VoxelPlace/actions/workflows/deploy.yml/badge.svg)](https://github.com/MaKSiiMe/VoxelPlace/actions/workflows/deploy.yml)
[![Tests](https://img.shields.io/badge/tests-35%20passing-brightgreen)](#tests)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)](https://nextjs.org)
[![Fastify](https://img.shields.io/badge/Fastify-5-000000?logo=fastify)](https://fastify.dev)
[![Socket.io](https://img.shields.io/badge/Socket.io-4-010101?logo=socket.io)](https://socket.io)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://docker.com)
[![Turborepo](https://img.shields.io/badge/Turborepo-2-EF4444?logo=turborepo&logoColor=white)](https://turborepo.dev)

**Site public :** [https://s56c-srv.tailedae07.ts.net](https://s56c-srv.tailedae07.ts.net)

</div>

---

## Vision du projet

r/place a démontré en 2017 et 2022 qu'une contrainte simple — *un pixel par personne, par période* — suffit à générer une dynamique sociale fascinante. VoxelPlace reproduit ce mécanisme en y ajoutant une dimension cross-platform : un joueur Minecraft pose un bloc coloré, ce pixel apparaît instantanément dans le navigateur d'un utilisateur web. La toile est le langage commun entre ces univers.

---

## Architecture système

```mermaid
graph TB
    subgraph Clients
        WEB["🌐 Navigateur (Next.js + PixiJS)"]
        MC["⛏ Minecraft (Plugin Paper)"]
    end

    subgraph Internet
        TF["Tailscale Funnel — HTTPS auto"]
        PG_NET["Playit.gg — Tunnel TCP 25565"]
    end

    subgraph Backend["Backend — Docker Compose"]
        API["Fastify 5 — REST API"]
        SIO["Socket.io 4 — Temps réel"]
        REDIS[("Redis 7 — Grille pixels")]
        PG[("PostgreSQL 16 — Historique · Auth")]
    end

    WEB -->|HTTPS / WSS| TF --> API
    WEB <-->|WebSocket| SIO
    MC <-->|WebSocket| SIO
    PG_NET --> MC
    SIO <-->|SETRANGE / HSET| REDIS
    API <-->|INSERT / SELECT| PG
```

| Service | Rôle |
|---------|------|
| **Tailscale Funnel** | Expose le frontend (port 80) en HTTPS public — sans IP fixe ni ouverture de port |
| **Playit.gg** | Expose le serveur Minecraft (port 25565) publiquement — même principe |
| **Tailscale mesh** | Réseau privé CI/CD — déploiement SSH depuis GitHub Actions |

---

## Stack technique

| Couche | Technologie | Justification |
|--------|-------------|---------------|
| Monorepo | **Turborepo 2** | Build orchestré, cache partagé |
| Runtime | **Node.js 20** | ESM natif, performances I/O async |
| Framework HTTP | **Fastify 5** | 2× plus rapide qu'Express |
| Temps réel | **Socket.io 4** | WebSocket avec fallback, rooms |
| Grille pixels | **Redis 7** | Lecture O(1), buffer binaire 4 Mo |
| Base de données | **PostgreSQL 16** | ACID, requêtes préparées, historique complet |
| Auth | **bcryptjs + JWT** | Hachage 10 rounds, tokens 7 jours |
| Frontend | **Next.js 16 App Router** | SSR/CSR hybride, Turbopack |
| Rendu canvas | **PixiJS v8** | GPU-accelerated, texture mise à jour par frame |
| État UI | **Zustand** | Store léger, subscriptions sans re-render React |
| Styles | **Tailwind CSS 4** | Thème Tokyo Night |

---

## Stratégie Redis + PostgreSQL

Le canvas est un **buffer binaire** de 4 194 304 octets (2048 × 2048 × 1 octet).

```
Clé Redis : voxelplace:grid
Taille    : 4 194 304 octets
Index     : y * 2048 + x
Valeur    : colorId (0–15), 1 octet par pixel

Lecture   : GET voxelplace:grid           → O(1)
Écriture  : SETRANGE voxelplace:grid <i>  → O(1)
Métadatas : HSET voxelplace:pixels "x,y"  → hover sans SQL
```

PostgreSQL stocke **tout ce qui nécessite de l'historique ou des requêtes complexes** : `pixel_history` (log append-only), comptes utilisateurs, skill tree, modération, signalements.

En cas de perte Redis, le script `scripts/restore-canvas.js` reconstruit le buffer depuis `pixel_history`.

---

## Palette de couleurs

16 couleurs canoniques synchronisées entre le serveur, le frontend et le plugin Minecraft.
Source de vérité : `apps/socket-server/src/shared/palette.js`

| ID | Nom | Hex | ID | Nom | Hex |
|----|-----|-----|----|-----|-----|
| 0 | Blanc | `#FFFFFF` | 8 | Vert clair | `#88CC22` |
| 1 | Gris clair | `#AAAAAA` | 9 | Vert | `#00AA00` |
| 2 | Gris | `#888888` | 10 | Cyan | `#00AAAA` |
| 3 | Noir | `#000000` | 11 | Bleu clair | `#44AAFF` |
| 4 | Marron | `#884422` | 12 | Bleu | `#4444FF` |
| 5 | Rouge | `#FF4444` | 13 | Violet | `#AA00AA` |
| 6 | Orange | `#FF8800` | 14 | Magenta | `#FF44FF` |
| 7 | Jaune | `#FFFF00` | 15 | Rose | `#FF88AA` |

Les couleurs sont débloquées progressivement via le **skill tree**.

---

## Fonctionnalités

### Canvas
- Grille 2048×2048 pixels, rendu GPU via PixiJS v8
- Zoom centré curseur, pan, placement optimiste avec rollback
- Cooldown selon le rôle (réduit par le streak jusqu'à 20 s)
- Historique complet de chaque pixel (git blame pixel)
- Partage de zone rectangulaire par lien court
- Timelapse + export GIF (global et personnel)
- Heatmap des zones actives
- Minimap cliquable (256×256)

### Authentification
- Inscription / Connexion avec bcrypt 10 rounds + JWT 7 jours
- Droit à l'effacement RGPD (`DELETE /api/auth/account`)
- Rate limiting 10 req/min par IP sur les endpoints d'auth

### Skill tree (27 nœuds)
- 16 couleurs débloquées progressivement (4 niveaux de streak)
- 11 features débloquées par des conditions de gameplay
- Niveau 1 : 5 couleurs de base offertes à la création du compte
- Niveau 2 : mélanges primaires (2 h streak)
- Niveau 3 : couleurs secondaires (3 h streak)
- Niveau 4 : teintes (5 h streak + prérequis couleur)

### Social
- Chat global (éphémère en mémoire)
- Thread de conversation par pixel (supprimé si le pixel est écrasé)
- Profil public joueur (`GET /api/profile/:username`)
- Leaderboard top joueurs

### Admin & Modération
- Dashboard admin (stats globales, activité par plateforme)
- Suppression pixel, vidage canvas, restauration depuis PostgreSQL
- Bannissement / débannissement utilisateur
- Queue de signalements avec workflow de traitement
- Logs de modération publics

### OG Image dynamique
- `/opengraph-image` — snapshot du canvas réel, régénéré toutes les 24h, 1200×630px

---

## Diagrammes UML

| Diagramme | Fichier |
|-----------|---------|
| Classes | [docs/uml/class-diagram.md](docs/uml/class-diagram.md) |
| ERD / Merise | [docs/uml/erd-merise.md](docs/uml/erd-merise.md) |
| Cas d'utilisation | [docs/uml/use-case.md](docs/uml/use-case.md) |
| Séquences | [docs/uml/sequence-diagram.md](docs/uml/sequence-diagram.md) |
| Déploiement | [docs/uml/deployment-diagram.md](docs/uml/deployment-diagram.md) |

---

## API REST

**Base URL :** `https://s56c-srv.tailedae07.ts.net` (prod) · `http://localhost:3001` (dev)

### Authentification

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/api/auth/register` | — | Créer un compte |
| POST | `/api/auth/login` | — | Se connecter → JWT |
| DELETE | `/api/auth/account` | JWT | Supprimer son compte (RGPD) |

### Canvas

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/grid` | Grille complète (buffer + palette) |
| GET | `/api/grid/window?x=&z=&w=&h=` | Fenêtre de la grille |
| GET | `/api/pixel/:x/:y` | Métadonnées d'un pixel |
| GET | `/api/pixel/:x/:y/history` | Historique d'un pixel |
| GET | `/api/heatmap` | Zones les plus actives |
| GET | `/api/history?limit=` | Historique complet (timelapse) |
| GET | `/api/stats` | Stats globales (pixels par plateforme) |
| GET | `/api/pulse` | Activité par minute (3 dernières heures) |

### Joueurs & Profils

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/players` | Joueurs connectés par plateforme |
| GET | `/api/profile/:username` | Profil public joueur |
| GET | `/api/leaderboard` | Top joueurs (limit 100) |

### Zones & Partage

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/zone` | Pixels d'une zone rectangulaire |
| POST | `/api/share` | Créer un lien de partage |
| GET | `/api/share/:id` | Récupérer une zone partagée |
| GET | `/api/zone/gif` | Timelapse GIF d'une zone |
| GET | `/api/timelapse/gif` | Timelapse GIF global |

### Skill tree

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/unlocks` | JWT | Unlocks + streak du joueur |
| GET | `/api/unlocks/tree` | — | Arbre complet avec statuts |
| GET | `/api/unlocks/available` | JWT | Nœuds débloquables maintenant |
| POST | `/api/unlocks/:nodeId` | JWT | Débloquer un nœud |

### Dashboard & Signalement

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/dashboard` | — | Stats globales du canvas |
| GET | `/api/players/:username/dashboard` | — | Stats personnelles |
| POST | `/api/report` | JWT (optionnel) | Signaler un pixel ou un joueur |

### Admin

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/api/admin/login` | — | Connexion admin → JWT |
| GET | `/api/admin/dashboard` | JWT | Stats admin globales |
| DELETE | `/api/admin/pixel/clear` | JWT | Supprimer un pixel |
| DELETE | `/api/admin/canvas` | JWT | Vider le canvas |
| POST | `/api/admin/restore-canvas` | JWT | Reconstruire Redis depuis PostgreSQL |
| POST | `/api/admin/ban/:username` | JWT | Bannir un joueur |
| DELETE | `/api/admin/ban/:username` | JWT | Débannir un joueur |
| GET | `/api/admin/reports` | JWT | Queue des signalements |
| PATCH | `/api/admin/reports/:id` | JWT | Marquer un signalement traité |
| GET | `/api/admin/logs` | JWT | Logs de modération |

---

## API Socket.io

**Connexion :** `io("http://localhost:3001", { transports: ['websocket'] })`

### Serveur → Client

| Événement | Payload |
|-----------|---------|
| `grid:init` | `{ grid, size, colors, players, stats }` |
| `pixel:update` | `{ x, y, colorId, username, source }` |
| `players:update` | `{ count, byPlatform }` |
| `unlocks:new` | `[{ nodeId, name }]` |
| `chat:message` | `{ username, message, room, timestamp }` |
| `pixel:chat:message` | `{ x, y, username, message }` |
| `banned` | — |

### Client → Serveur

| Événement | Payload |
|-----------|---------|
| `player:join` | `{ username, source }` |
| `pixel:place` | `{ x, y, colorId, username, source }` → ack `{ ok, cooldown }` |
| `chat:send` | `{ room, message }` |
| `pixel:chat:send` | `{ x, y, message }` |
| `grid:request` | — |

---

## Sécurité

| Vecteur | Contre-mesure |
|---------|--------------|
| XSS | `sanitizeUsername()` — supprime `< > " ' \`` et chars de contrôle |
| SQL Injection | Requêtes préparées `$1, $2` — aucune interpolation de chaîne |
| Spam auth | Rate limiting 10 req/min par IP (`/register` et `/login`) |
| CORS | `ALLOWED_ORIGINS` — origines explicitement autorisées (env var) |
| Spam pixels | Cooldown serveur par username + vérification JWT |
| Coords invalides | `Number.isInteger()` + bornes 0–2047 strictes |
| Mots de passe | bcrypt 10 rounds — min 6 caractères |
| Sessions | JWT signé `JWT_SECRET`, expiration 7 jours |
| CSRF | Non applicable — auth par header `Authorization: Bearer`, jamais par cookie |
| HTTPS | Tailscale Funnel — certificat TLS automatique en production |
| Secrets | `.env` dans `.gitignore`, `.env.example` fourni |

---

## Tests

```bash
cd apps/socket-server
npm test
```

**35 tests unitaires** — Node.js test runner natif, zéro dépendance externe :

| Fichier | Tests | Couvre |
|---------|-------|--------|
| `auth.test.js` | 10 | `hashPassword`, `verifyPassword`, `signToken`, `verifyToken` |
| `validation.test.js` | 18 | `isValidCoord`, `sanitizeUsername`, `validatePixel` |
| `report.test.js` | 6 | `validateReport` — pixel, joueur, champs optionnels |
| `grid.test.js` | 7 | `GRID_SIZE`, `getPixelIndex` |

Les tests s'exécutent automatiquement dans le pipeline CI/CD avant chaque déploiement.

---

## Déploiement & CI/CD

### Infrastructure (Docker Compose)

| Service | Image | Port | Rôle |
|---------|-------|------|------|
| `voxelplace-web` | node:20-alpine | 80 | Next.js standalone |
| `voxelplace-api` | node:20-alpine | 3001 | Fastify + Socket.io |
| `voxelplace-db` | postgres:16-alpine | 5432 (interne) | PostgreSQL |
| `voxelplace-redis` | redis:7-alpine | 6379 (interne) | Redis (RDB + AOF) |
| Paper 1.21.1 | JVM — **hors Docker** | 25565 via Playit.gg | Serveur Minecraft |

### Pipeline GitHub Actions

```
git push main
  → job test   : node --test tests/*.test.js (35 tests)
  → job deploy : Tailscale VPN → SSH → git reset --hard → docker compose up --build
```

Le déploiement est bloqué si les tests échouent.

### HTTPS

Exposé via **Tailscale Funnel** — pas d'IP publique, certificat TLS automatique.

```bash
sudo tailscale funnel --bg --https=443 http://127.0.0.1:80
```

---

## Installation locale

### Prérequis

- Node.js ≥ 20
- Docker + Docker Compose

### Cloner & Installer

```bash
git clone https://github.com/MaKSiiMe/VoxelPlace.git
cd VoxelPlace
npm install
```

### Variables d'environnement

```bash
cp apps/socket-server/.env.example apps/socket-server/.env
```

```dotenv
PORT=3001
REDIS_URL=redis://127.0.0.1:6379
DATABASE_URL=postgresql://voxelplace:changeme@localhost:5432/voxelplace
ADMIN_PASSWORD=changeme
JWT_SECRET=une_cle_generee_avec_openssl_rand_hex_32
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

### Développement

```bash
# Backend
cd apps/socket-server && npm run dev   # → http://localhost:3001

# Frontend
cd apps/web && npm run dev             # → http://localhost:3000
```

### Production

```bash
docker compose up --build -d
```

---

## Structure du projet

```
VoxelPlace/
├── apps/
│   ├── socket-server/              # Backend Fastify + Socket.io
│   │   ├── src/
│   │   │   ├── index.js            # Point d'entrée — routes + socket events
│   │   │   ├── features/
│   │   │   │   ├── auth/           # Register, Login, Delete account
│   │   │   │   ├── admin/          # Dashboard, ban, modération
│   │   │   │   ├── canvas/         # Grid Redis, validation pixel
│   │   │   │   ├── chat/           # Chat global + threads pixel
│   │   │   │   ├── dashboard/      # Stats joueur + global
│   │   │   │   ├── players/        # Joueurs connectés
│   │   │   │   ├── profile/        # Profil public
│   │   │   │   ├── report/         # Signalements
│   │   │   │   ├── share/          # Partage de zones
│   │   │   │   ├── timelapse/      # Timelapse + export GIF
│   │   │   │   ├── unlocks/        # Skill tree
│   │   │   │   └── zone/           # Sélection de zone
│   │   │   └── shared/
│   │   │       ├── db.js           # Pool PostgreSQL + retry
│   │   │       └── palette.js      # Palette canonique 16 couleurs
│   │   ├── db/init.sql             # Schéma PostgreSQL (10 tables)
│   │   ├── scripts/
│   │   │   └── restore-canvas.js   # Reconstruit Redis depuis pixel_history
│   │   └── tests/                  # 35 tests unitaires
│   │
│   ├── web/                        # Frontend Next.js 16
│   │   ├── app/
│   │   │   ├── layout.tsx          # Métadonnées + OpenGraph
│   │   │   ├── opengraph-image.tsx # OG image dynamique (snapshot canvas)
│   │   │   ├── (game)/             # Page canvas principale
│   │   │   └── dashboard/          # Dashboard admin (protégé AdminGuard)
│   │   ├── features/
│   │   │   ├── auth/               # AuthModal, helpers JWT, API login/register
│   │   │   ├── admin/              # AdminGuard, AdminDashboard
│   │   │   ├── canvas/             # PixiJS, store Zustand, Minimap
│   │   │   ├── hud/                # GameFrame, BottomDrawer, Notch, modales
│   │   │   ├── realtime/           # Socket.io client singleton + hook
│   │   │   └── unlocks/            # UnlockPanel, arbre de compétences
│   │   └── shared/
│   │       └── api.ts              # API_URL — source unique (NEXT_PUBLIC_API_URL)
│   │
│   └── game-bridges/
│       └── minecraft/              # Plugin Paper 1.21.1
│           ├── src/main/java/fr/voxelplace/minecraft/
│           │   ├── VoxelPlacePlugin.java   # Cycle de vie du plugin
│           │   ├── CanvasManager.java      # Grille locale + 16 couleurs béton
│           │   ├── SocketManager.java      # Client Socket.io
│           │   ├── CanvasListener.java     # Événements bloc (place/break/interact)
│           │   └── VoxelCommand.java       # Commandes /vp
│           └── pom.xml
│
├── docs/
│   ├── uml/                        # Diagrammes UML (Mermaid)
│   └── skill-tree.md               # Arbre de compétences (27 nœuds)
├── .github/workflows/deploy.yml    # CI/CD — test + deploy SSH
├── docker-compose.yml
├── turbo.json
└── package.json
```

---

## Plugin Minecraft

Connecte un serveur **Paper 1.21.1** au backend via Socket.io WebSocket.

- Reçoit `grid:init` au démarrage → dessine le canvas en blocs béton (16 couleurs)
- Clic droit avec un bloc coloré → `pixel:place` + mise à jour optimiste locale
- `pixel:update` reçus → blocs mis à jour en temps réel
- Rollback automatique si le serveur refuse (ban, cooldown, coords invalides)
- Exposé via **Playit.gg** (tunnel sans IP publique)

**Correspondance palette ↔ blocs :**

| ID | Couleur | Bloc Minecraft |
|----|---------|---------------|
| 0 | Blanc | `WHITE_CONCRETE` |
| 1 | Gris clair | `LIGHT_GRAY_CONCRETE` |
| 2 | Gris | `GRAY_CONCRETE` |
| 3 | Noir | `BLACK_CONCRETE` |
| 4 | Marron | `BROWN_CONCRETE` |
| 5 | Rouge | `RED_CONCRETE` |
| 6 | Orange | `ORANGE_CONCRETE` |
| 7 | Jaune | `YELLOW_CONCRETE` |
| 8 | Vert clair | `LIME_CONCRETE` |
| 9 | Vert | `GREEN_CONCRETE` |
| 10 | Cyan | `CYAN_CONCRETE` |
| 11 | Bleu clair | `LIGHT_BLUE_CONCRETE` |
| 12 | Bleu | `BLUE_CONCRETE` |
| 13 | Violet | `PURPLE_CONCRETE` |
| 14 | Magenta | `MAGENTA_CONCRETE` |
| 15 | Rose | `PINK_CONCRETE` |

```bash
cd apps/game-bridges/minecraft
/tmp/apache-maven-3.9.9/bin/mvn clean package -q
# → target/VoxelPlace.jar
```

---

<div align="center">

**VoxelPlace** — Holberton School · Projet de fin d'année · RNCP 6 CDA

*Un pixel à la fois.*

</div>
