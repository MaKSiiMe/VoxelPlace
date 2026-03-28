<div align="center">

# 🎨 VoxelPlace

**Canvas collaboratif en temps réel — inspiré de r/place**

*Projet de fin d'année — Holberton School · Validation RNCP*

[![Deploy](https://github.com/MaKSiiMe/VoxelPlace/actions/workflows/deploy.yml/badge.svg)](https://github.com/MaKSiiMe/VoxelPlace/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Turborepo](https://img.shields.io/badge/Turborepo-2-EF4444?logo=turborepo&logoColor=white)](https://turborepo.dev)
[![Docker](https://img.shields.io/badge/Docker-multi--stage-2496ED?logo=docker&logoColor=white)](https://docker.com)

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)](https://nextjs.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![PixiJS](https://img.shields.io/badge/PixiJS-8-E72264?logo=pixijs&logoColor=white)](https://pixijs.com)

[![Fastify](https://img.shields.io/badge/Fastify-5-000000?logo=fastify)](https://fastify.dev)
[![Socket.io](https://img.shields.io/badge/Socket.io-4-010101?logo=socket.io)](https://socket.io)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://postgresql.org)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle-ORM-C5F74F?logo=drizzle&logoColor=black)](https://orm.drizzle.team)
[![Java](https://img.shields.io/badge/Java-21-ED8B00?logo=openjdk&logoColor=white)](https://openjdk.org)
[![Lua](https://img.shields.io/badge/Lua-5.1-2C2D72?logo=lua&logoColor=white)](https://www.lua.org)

[![Minecraft](https://img.shields.io/badge/Minecraft-Paper%201.21.1-62B47A?logo=minecraft&logoColor=white)](https://papermc.io)
[![Roblox](https://img.shields.io/badge/Roblox-Lua-00A2FF?logo=roblox&logoColor=white)](https://create.roblox.com)
[![Hytale](https://img.shields.io/badge/Hytale-à_venir-8B5CF6)](https://hytale.com)

![VoxelPlace demo](assets/demo-seamless.gif)

---

> VoxelPlace est une expérience sociale et technique qui permet à des utilisateurs de **plateformes hétérogènes** — navigateur web, Minecraft, Roblox, Hytale — de collaborer en temps réel sur une toile de **64×64 pixels** partagée et persistée.

</div>

---

## 📋 Sommaire

1. [Vision du projet](#-vision-du-projet)
2. [Architecture système](#-architecture-système)
3. [Stack technique](#-stack-technique)
4. [Stratégie Redis](#-stratégie-redis)
5. [API REST](#-api-rest)
6. [API Socket.io](#-api-socketio)
7. [Palette de couleurs](#-palette-de-couleurs)
8. [Sécurité](#-sécurité)
9. [Mode Admin](#-mode-admin)
10. [Plugin Minecraft](#-plugin-minecraft)
11. [Déploiement & CI/CD](#-déploiement--cicd)
12. [Installation & Lancement](#-installation--lancement)
13. [Structure du projet](#-structure-du-projet)
14. [Roadmap](#-roadmap)

---

## 🌍 Vision du projet

r/place a démontré en 2017 et 2022 qu'une contrainte simple — *un pixel par personne, par période* — suffit à générer une dynamique sociale fascinante. VoxelPlace reproduit ce mécanisme en y ajoutant une dimension technique supplémentaire : la **convergence cross-platform**.

Un joueur Minecraft pose un bloc coloré. Ce pixel apparaît instantanément dans le navigateur d'un utilisateur web, dans un monde Roblox, et dans Hytale. La toile est le langage commun entre ces univers.

**Enjeux techniques :**
- Propagation temps réel à N clients hétérogènes (Web, Minecraft, Roblox, Hytale) via Socket.io
- Persistance haute performance avec Redis (lecture O(1) de la grille entière)
- Architecture extensible pensée pour l'ajout de nouveaux clients sans modifier le cœur

---

## 🏗 Architecture système

```mermaid
graph TB
    subgraph Clients
        WEB["🌐 Browser\n(Next.js + PixiJS)"]
        MC["⛏ Minecraft\n(Plugin Paper)"]
        RB["🎮 Roblox\n(Script Lua)"]
        HY["🏔 Hytale\n(Mod API)"]
    end

    subgraph Backend["Backend — apps/socket-server"]
        API["⚡ Fastify\nREST API"]
        SIO["🔌 Socket.io\nTemps réel"]
    end

    subgraph Storage["Stockage"]
        REDIS[("🗄 Redis\nGrille pixels · Temps réel")]
        PG[("🐘 PostgreSQL\nHistorique · Utilisateurs")]
    end

    WEB  <-->|"WebSocket"| SIO
    MC   <-->|"WebSocket"| SIO
    RB   <-->|"WebSocket"| SIO
    HY   <-->|"WebSocket"| SIO
    WEB  <-->|"GET /api/grid"| API
    WEB  <-->|"POST /api/auth/*"| API
    SIO  <-->|"SETRANGE / HSET"| REDIS
    API  <-->|"GET / GETRANGE"| REDIS
    API  <-->|"SELECT / INSERT"| PG
```

### Rôle de chaque composant

| Composant | Rôle |
|-----------|------|
| **Fastify** | Chef d'orchestre HTTP — expose les routes REST, valide les données entrantes, applique le rate limiting et les règles de sécurité |
| **Socket.io** | Bus d'événements temps réel — reçoit les pixels des clients, les persiste via Redis, puis les diffuse à **tous** les clients connectés simultanément |
| **Redis** | Source de vérité pour la grille — buffer binaire 4 096 octets pour une lecture O(1), métadonnées par pixel dans un Hash |
| **PostgreSQL** | Persistance des comptes utilisateurs et historique — tables `users` + `pixel_history` (append-only), requêtes préparées anti-injection SQL |
| **PixiJS v8** | Rendu GPU-accelerated de la grille 64×64 — zoom/pan, placement de pixels, texture dynamique via `BufferImageSource` |

---

## ⚙️ Stack technique

| Couche | Technologie | Justification |
|--------|-------------|---------------|
| Monorepo | **Turborepo 2** | Build orchestré, cache partagé, dev en parallèle |
| Runtime | **Node.js 20** | Support ESM natif, performances I/O async |
| Framework HTTP | **Fastify 5** | 2× plus rapide qu'Express, validation JSON Schema intégrée |
| Temps réel | **Socket.io 4** | Abstraction WebSocket avec fallback, rooms, acknowledgements |
| Grille pixels | **Redis 7** | Lecture O(1) du buffer binaire, sub-milliseconde |
| BDD | **PostgreSQL 16** | BDD relationnelle ACID, requêtes préparées, Merise |
| ORM | **Drizzle ORM** | Type-safe, migrations versionnées, zero-overhead |
| Authentification | **bcryptjs + JWT** | Hachage sécurisé (10 rounds), tokens signés 7 jours |
| Frontend | **Next.js 16 App Router** | SSR/CSR hybride, routing, Turbopack |
| Rendu canvas | **PixiJS v8** | GPU-accelerated, texture dynamique, pixel-perfect |
| État UI | **Zustand** | Store léger, subscriptions sélectives hors React |
| Styles | **Tailwind CSS 4** | Design tokens Caelestia, glassmorphism |

---

## 🗄 Stratégie Redis

Le stockage des pixels utilise une architecture **duale** optimisée pour deux cas d'usage distincts.

### Structure 1 — Buffer binaire (`voxelplace:grid`)

```
Type Redis : String (binaire)
Taille     : 4 096 octets (64 × 64 × 1 octet)
Index      : y * 64 + x
Valeur     : colorId (0–7), 1 octet par pixel
```

**Lecture de la grille complète** — envoyée à chaque nouvelle connexion :
```
GET voxelplace:grid   → Buffer<4096>   O(1)
```

**Écriture d'un pixel** — mise à jour atomique d'un seul octet :
```
SETRANGE voxelplace:grid <index> <Buffer[colorId]>   O(1)
```

> L'avantage clé : envoyer la grille entière à un nouveau client ne coûte qu'**un seul appel Redis**, indépendamment du nombre de pixels modifiés.

### Structure 2 — Hash de métadonnées (`voxelplace:pixels`)

```
Type Redis : Hash
Clé champ  : "x,y"       (ex : "12,34")
Valeur     : JSON string  { x, y, colorId, username, source, updatedAt }
```

**Lecture des infos d'un pixel** — utilisée par l'API REST et le mode admin :
```
HGET voxelplace:pixels "12,34"   O(1)
```

**Écriture des métadonnées** :
```
HSET voxelplace:pixels "12,34" '{"username":"Steve","source":"minecraft",...}'
```

### Diagramme de séquence — Trajet d'un pixel

```mermaid
sequenceDiagram
    actor MC as ⛏ Joueur Minecraft
    participant Plugin as Plugin Paper
    participant SIO as Socket.io Server
    participant Redis as Redis
    actor WEB as 🌐 Navigateur Web
    actor RB as 🎮 Roblox
    actor HY as 🏔 Hytale

    MC->>Plugin: Pose un bloc coloré en (12, 34)
    Plugin->>SIO: emit("pixel:place", {x:12, y:34, colorId:3, username:"Steve", source:"minecraft"})
    SIO->>SIO: Validation (coords, colorId, username, rate limit)
    SIO->>Redis: SETRANGE voxelplace:grid 2252 &#60;Buffer[3]&#62;
    SIO->>Redis: HSET voxelplace:pixels "12,34" '{"username":"Steve",...}'
    Redis-->>SIO: OK

    par Diffusion simultanée à tous les clients
        SIO->>WEB: emit("pixel:update", {x:12, y:34, colorId:3, username:"Steve"})
        SIO->>RB: emit("pixel:update", {x:12, y:34, colorId:3, username:"Steve"})
        SIO->>HY: emit("pixel:update", {x:12, y:34, colorId:3, username:"Steve"})
    end

    WEB->>WEB: bufferSource.update() → PixiJS redraw
    RB->>RB: UpdatePart(12, 34, Color3.new(...))
    HY->>HY: SetBlock(12, 34, blockType)

    Note over WEB,HY: Le pixel apparaît instantanément sur toutes les plateformes
```

---

## 📡 API REST

**Base URL :** `http://localhost:3001`

---

### `POST /api/auth/register` — Créer un compte

```json
// Body
{ "username": "Alice", "password": "monmotdepasse" }

// Réponse 201
{ "token": "<JWT>", "username": "Alice" }

// Erreurs : 400 (validation), 409 (pseudo déjà pris)
```

### `POST /api/auth/login` — Se connecter

```json
// Body
{ "username": "Alice", "password": "monmotdepasse" }

// Réponse 200
{ "token": "<JWT>", "username": "Alice" }

// Erreurs : 400 (champs manquants), 401 (identifiants incorrects)
```

---

### `GET /api/grid`

Retourne l'état complet de la grille.

**Réponse `200 OK`**

```json
{
  "size": 64,
  "colors": ["#FFFFFF", "#000000", "#FF4444", "#00AA00", "#4444FF", "#FFFF00", "#FF8800", "#AA00AA"],
  "grid": [0, 0, 3, 0, 1, 2, ...]
}
```

---

### `GET /api/stats`

```json
{ "total": 1420, "byPlatform": { "web": 980, "minecraft": 440 } }
```

---

### `GET /api/heatmap`

Nombre de modifications par coordonnée.

```json
{ "heatmap": [{ "x": 12, "y": 34, "count": 47 }, ...] }
```

---

### `GET /api/history?limit=50000`

Historique complet des pixels (timelapse).

```json
{ "history": [{ "x": 0, "y": 0, "colorId": 2, "username": "Alice", "placedAt": "..." }, ...] }
```

---

### `GET /api/pulse`

Activité par minute sur les 3 dernières heures.

```json
{ "pulse": [{ "t": "2026-03-24T14:00:00Z", "count": 12 }, ...] }
```

---

### `GET /api/snapshot?at=<ISO>`

État exact du canvas à un timestamp donné.

```json
{ "grid": [0, 2, 0, ...], "size": 64, "at": "2026-03-24T14:00:00Z" }
```

---

### `GET /api/conflicts`

Pixels écrasés par un utilisateur différent (zones de conflit).

```json
{ "conflicts": [{ "x": 5, "y": 10, "count": 8 }, ...] }
```

---

### `GET /api/pixel/:x/:y`

Métadonnées du dernier pixel posé en `(x, y)`.

```json
{
  "x": 12, "y": 34,
  "colorId": 3,
  "username": "Steve",
  "source": "minecraft",
  "updatedAt": 1710000000000
}
```

---

### `GET /api/pixel/:x/:y/history`

Historique complet d'un pixel (git blame).

```json
{ "x": 12, "y": 34, "history": [{ "colorId": 3, "username": "Steve", "placedAt": "..." }, ...] }
```

---

## 🔌 API Socket.io

**Connexion :** `io("http://localhost:3001")`

### Événements reçus par le client

| Événement | Déclencheur | Payload |
|-----------|-------------|---------|
| `grid:init` | Connexion initiale | `{ size, colors, grid, players, stats }` |
| `pixel:update` | Tout pixel posé ou supprimé | `{ x, y, colorId, username, source }` |
| `players:update` | Connexion/déconnexion | `{ count, byPlatform }` |
| `stats:update` | Après chaque pixel posé | `{ total, byPlatform }` |

### Événements émis par le client

#### `player:join` — Annoncer sa connexion

```js
socket.emit("player:join", { username: "Steve", source: "web" })
```

#### `pixel:place` — Poser un pixel

```js
socket.emit("pixel:place", {
  x: 12, y: 34,
  colorId: 3,
  username: "Steve",
  source: "web"   // "web" | "minecraft" | "roblox" | "hytale"
}, (ack) => {
  if (ack.ok)       console.log("Pixel posé !")
  if (ack.error)    console.warn(ack.error)
  if (ack.cooldown) console.log(`Retry dans ${ack.cooldown}s`)
})
```

#### `admin:auth` — Authentification admin

```js
socket.emit("admin:auth", "mot_de_passe", (ack) => {
  // ack.ok    → session admin active
  // ack.error → "Mot de passe incorrect"
})
```

#### `admin:clear` — Supprimer un pixel *(admin requis)*

```js
socket.emit("admin:clear", { x: 12, y: 34 }, (ack) => { ... })
```

#### `admin:clearAll` — Vider toute la toile *(admin requis)*

```js
socket.emit("admin:clearAll", null, (ack) => { ... })
```

---

## 🎨 Palette de couleurs

| ID | Nom | Hex | Swatch |
|----|-----|-----|--------|
| `0` | Blanc  | `#FFFFFF` | ⬜ |
| `5` | Jaune  | `#FFFF00` | 🟨 |
| `6` | Orange | `#FF8800` | 🟧 |
| `2` | Rouge  | `#FF4444` | 🟥 |
| `3` | Vert   | `#00AA00` | 🟩 |
| `4` | Bleu   | `#4444FF` | 🟦 |
| `7` | Violet | `#AA00AA` | 🟪 |
| `1` | Noir   | `#000000` | ⬛ |

---

## 🔒 Sécurité

| Vecteur d'attaque | Contre-mesure |
|-------------------|---------------|
| **XSS via pseudo** | Suppression des caractères `< > " ' \`` et des caractères de contrôle côté serveur |
| **Spam de pixels** | Rate limit 1 pixel / seconde / `username` en mémoire, vérifié exclusivement côté serveur |
| **Coordonnées invalides** | `Number.isInteger()` + bornes 0–63 strictes |
| **Accès admin non autorisé** | Mot de passe vérifié sur le serveur (`ADMIN_PASSWORD`), autorisation liée à la session Socket.io |
| **Injection SQL** | Requêtes préparées `pg` (`$1, $2`) — aucune interpolation dans les requêtes PostgreSQL |
| **Injection Redis** | API `ioredis` avec paramètres typés |
| **Mots de passe en clair** | Hachage `bcryptjs` 10 rounds |
| **Sessions volées** | JWT signé avec `JWT_SECRET` (512 bits), expiration 7 jours |
| **Secrets exposés** | `.env` dans `.gitignore` — jamais commité |

---

## 👑 Mode Admin

### Activation

1. **Cliquer 5 fois rapidement** sur le logo `VoxelPlace`
2. Saisir le mot de passe (`ADMIN_PASSWORD` du `.env`)

### Utilisation

En mode admin, cliquer sur n'importe quel pixel ouvre une fiche :

```
┌─────────────────────────────┐
│  ■  Pixel (12, 34)          │
│     #00AA00                 │
│                             │
│  Posé par    Steve          │
│  Source      minecraft      │
│  Date        22/03/2026     │
│                             │
│  [ 🗑 Remettre à blanc ]    │
└─────────────────────────────┘
```

---

## ⛏ Plugin Minecraft

Le plugin connecte un serveur **Paper 1.21.1** au backend via Socket.io.

### Fonctionnement

- Au démarrage, reçoit `grid:init` et dessine le canvas en blocs dans le monde
- **Clic droit** avec un bloc de la palette → `pixel:place` envoyé au serveur
- Les `pixel:update` reçus mettent à jour les blocs correspondants en jeu

### Palette Minecraft

| colorId | Béton | Laine |
|---------|-------|-------|
| `0` Blanc  | `WHITE_CONCRETE`  | `WHITE_WOOL`  |
| `1` Noir   | `BLACK_CONCRETE`  | `BLACK_WOOL`  |
| `2` Rouge  | `RED_CONCRETE`    | `RED_WOOL`    |
| `3` Vert   | `GREEN_CONCRETE`  | `GREEN_WOOL`  |
| `4` Bleu   | `BLUE_CONCRETE`   | `BLUE_WOOL`   |
| `5` Jaune  | `YELLOW_CONCRETE` | `YELLOW_WOOL` |
| `6` Orange | `ORANGE_CONCRETE` | `ORANGE_WOOL` |
| `7` Violet | `PURPLE_CONCRETE` | `PURPLE_WOOL` |

### Commandes

| Commande | Description |
|----------|-------------|
| `/vp setup` | Définit le coin Nord-Ouest du canvas à la position actuelle |
| `/vp fill` | Recharge la grille depuis le serveur |
| `/vp reload` | Reconnecte le plugin au serveur |
| `/vp info` | Affiche l'état de la connexion |

### Build & Installation

```bash
cd apps/game-bridges/minecraft
mvn clean package -q
# → target/VoxelPlace.jar
cp target/VoxelPlace.jar /chemin/vers/plugins/
```

---

## 🐳 Déploiement & CI/CD

### Infrastructure

| Service | Technologie | Accès |
|---------|-------------|-------|
| Frontend | `voxelplace-web` — Next.js 16 standalone, Node 20-alpine (port 80→3000) | `http://100.124.153.20` |
| Socket Server | `voxelplace-api` — Fastify 5 + Socket.io 4, Node 20-alpine (port 3001) | `http://100.124.153.20:3001` |
| PostgreSQL | `voxelplace-db` — postgres:16-alpine (port 5432, interne) | `voxelplace-db:5432` |
| Redis | Externe au Docker Compose | `redis://100.124.153.20:6379` |

### Déployer avec Docker

```bash
# Depuis la racine du projet
docker compose up --build -d
```

### CI/CD — GitHub Actions

Chaque push sur `main` déclenche automatiquement un redéploiement :

```
git push → GitHub Actions → Tailscale VPN → SSH → git pull + docker compose up
```

| Secret GitHub | Description |
|---------------|-------------|
| `TAILSCALE_AUTHKEY` | Clé d'accès au réseau Tailscale |
| `SSH_PRIVATE_KEY` | Clé privée SSH |
| `SSH_USER` | Utilisateur SSH du serveur |

---

## 🚀 Installation & Lancement

### Prérequis

- **Node.js ≥ 20**
- **Redis** accessible (par défaut `redis://100.124.153.20:6379`)

### Cloner & Installer

```bash
git clone <url-du-repo>
cd VoxelPlace
npm install   # installe tous les workspaces via Turborepo
```

### Configurer les `.env`

```bash
# Root (docker-compose)
cp .env.example .env

# Socket server
cp apps/socket-server/.env.example apps/socket-server/.env
```

Éditer `apps/socket-server/.env` :

```dotenv
PORT=3001
REDIS_URL=redis://100.124.153.20:6379
DATABASE_URL=postgresql://voxelplace:motdepasse@localhost:5432/voxelplace
ADMIN_PASSWORD=changeme
JWT_SECRET=une_cle_secrete_longue_generee_avec_openssl
TEST_USERNAMES=testbot,devmax
```

### Lancer en développement

```bash
npm run dev
# Lance tous les workspaces en parallèle via Turbo
# → Socket server : http://localhost:3001
# → Web           : http://localhost:3000
```

Ou workspace par workspace :

```bash
npx turbo run dev --filter=@voxelplace/socket-server
npx turbo run dev --filter=@voxelplace/web
```

### Build de production

```bash
npm run build
docker compose up --build -d
```

---

## 📁 Structure du projet

```
VoxelPlace/                              # Monorepo Turborepo
├── apps/
│   ├── socket-server/                   # @voxelplace/socket-server
│   │   ├── src/
│   │   │   ├── index.js                 # Fastify + Socket.io + routes REST
│   │   │   ├── features/
│   │   │   │   ├── auth/routes.js       # Register / Login — bcrypt + JWT
│   │   │   │   └── canvas/
│   │   │   │       ├── grid.js          # Couche Redis (buffer binaire + HSET)
│   │   │   │       └── utils.js         # Validation, sanitisation XSS
│   │   │   └── shared/db.js             # Pool PostgreSQL + connectWithRetry()
│   │   ├── db/init.sql                  # Schéma PostgreSQL (users + pixel_history)
│   │   ├── tests/                       # Tests unitaires (auth, grid, validation)
│   │   └── Dockerfile
│   │
│   ├── web/                             # @voxelplace/web — Next.js 16 App Router
│   │   ├── app/
│   │   │   ├── layout.tsx               # Root layout + styles
│   │   │   ├── (game)/page.tsx          # Page principale — canvas + HUD
│   │   │   └── dashboard/page.tsx       # Dashboard admin (Phase 5)
│   │   ├── features/
│   │   │   ├── canvas/
│   │   │   │   ├── components/CanvasEngine.tsx   # Shell React du moteur
│   │   │   │   ├── hooks/usePixiCanvas.ts        # Moteur PixiJS v8 complet
│   │   │   │   └── store.ts                      # Zustand — grid, couleur, hover
│   │   │   ├── hud/
│   │   │   │   ├── components/GameFrame.tsx      # Cadre fixe autour du canvas
│   │   │   │   ├── components/SidebarLeft.tsx    # Navigation gauche
│   │   │   │   ├── components/StatusPills.tsx    # Pills flottantes en haut
│   │   │   │   ├── components/ColorDock.tsx      # Palette flottante en bas
│   │   │   │   └── store.ts                      # Zustand — état UI cockpit
│   │   │   ├── realtime/
│   │   │   │   ├── socket.ts                     # Singleton Socket.io client
│   │   │   │   └── hooks/useSocket.ts            # Connexion + événements
│   │   │   ├── admin/                            # (Phase 5) Modération
│   │   │   ├── stats/                            # (Phase 5) Analytics
│   │   │   └── platforms/                        # (Phase 7) Bridges UI
│   │   └── shared/lib/utils.ts          # cn() — Tailwind class merging
│   │
│   └── game-bridges/
│       ├── minecraft/                   # Plugin Paper 1.21.1 (Java)
│       │   ├── src/main/java/fr/voxelplace/minecraft/
│       │   │   ├── VoxelPlacePlugin.java
│       │   │   ├── CanvasManager.java
│       │   │   ├── SocketManager.java
│       │   │   ├── CanvasListener.java
│       │   │   └── VoxelCommand.java
│       │   └── pom.xml
│       ├── roblox/                      # (prévu) Script Lua
│       └── hytale/                      # (prévu) Mod API
│
├── packages/
│   ├── db/                              # @voxelplace/db — Drizzle ORM
│   │   ├── src/schema/
│   │   │   ├── canvas.ts               # pixel_history
│   │   │   └── users.ts                # users
│   │   ├── migrations/
│   │   │   └── 0000_initial_schema.sql
│   │   └── drizzle.config.ts
│   ├── types/                           # @voxelplace/types — Interfaces TS partagées
│   │   └── src/ (pixel, user, platform)
│   ├── styles/                          # @voxelplace/styles — Tailwind + tokens Caelestia
│   │   └── src/globals.css
│   └── config/                          # @voxelplace/config — tsconfig partagés
│       └── tsconfig/ (base, nextjs)
│
├── docs/uml/                            # Diagrammes UML (Mermaid)
├── docker-compose.yml
├── turbo.json
└── package.json                         # Workspaces npm
```

---

## 🗺 Roadmap

```mermaid
gantt
    title VoxelPlace — Roadmap
    dateFormat  YYYY-MM-DD
    section Phase 1 — Architecture
    Monorepo Turborepo + migration     :done, 2026-03-01, 2026-03-15
    Drizzle ORM + PostgreSQL Docker    :done, 2026-03-15, 2026-03-20
    section Phase 2 — Canvas PixiJS
    Moteur PixiJS v8 (GPU)             :done, 2026-03-20, 2026-03-27
    Socket.io temps réel               :done, 2026-03-20, 2026-03-27
    section Phase 3 — HUD & Cockpit
    GameFrame + SidebarLeft            :active, 2026-03-27, 2026-04-10
    ColorDock + StatusPills            :active, 2026-03-27, 2026-04-10
    section Phase 4 — Auth Clerk
    Inscription / Connexion            :2026-04-10, 2026-04-20
    Cooldown Redis par utilisateur     :2026-04-10, 2026-04-20
    section Phase 5 — Analytics
    Dashboard admin                    :2026-04-20, 2026-05-01
    Heatmap + Timelapse                :2026-04-20, 2026-05-01
    section Phase 6 — Cross-Game
    Plugin Minecraft                   :done, 2026-02-01, 2026-03-01
    Client Roblox (Lua)                :2026-05-01, 2026-06-01
    Client Hytale                      :2026-05-01, 2026-06-01
```

### Détail des phases

<details>
<summary>✅ Phase 1 — Monorepo & Infrastructure</summary>

- Migration vers Turborepo (`apps/`, `packages/`)
- `apps/socket-server` : Fastify 5 + Socket.io + Redis + PostgreSQL
- `packages/db` : Drizzle ORM, schémas `pixel_history` + `users`
- `packages/types` : interfaces TypeScript partagées
- Docker Compose mis à jour, CI/CD GitHub Actions

</details>

<details>
<summary>✅ Phase 2 — Moteur Canvas PixiJS v8</summary>

- Rendu GPU via `BufferImageSource` + `Texture` PixiJS v8
- Zoom centré sur le curseur (molette), pan (clic molette ou Espace+glisser)
- Clic → `pixel:place` via Socket.io avec acknowledgement
- Connexion Socket.io avec username persisté en localStorage
- Zustand pour la grille, la couleur sélectionnée, les joueurs connectés

</details>

<details>
<summary>🔄 Phase 3 — HUD & Interface Cockpit</summary>

- `GameFrame` : cadre fixe autour du canvas (header, sidebars, footer continus)
- `ColorDock` : palette 8 couleurs flottante
- `StatusPills` : stats temps réel en haut
- `SidebarLeft` : navigation features
- Thème Light/Dark via `next-themes`

</details>

<details>
<summary>📋 Phase 4 — Authentification Clerk</summary>

- Comptes utilisateurs via Clerk
- Cooldown Redis par compte authentifié
- Protection des routes admin

</details>

<details>
<summary>📋 Phase 5 — Analytics & Admin</summary>

- Dashboard admin : heatmap, timelapse, pulse, git-blame pixel
- Modération : suppression pixel, vider le canvas
- Stats cross-platform en temps réel

</details>

<details>
<summary>📋 Phase 6 — Cross-Game</summary>

- Client Roblox en Lua
- Client Hytale via Mod API

</details>

---

<div align="center">

**VoxelPlace** — Holberton School · Projet de fin d'année · Validation RNCP

*Un pixel à la fois.*

</div>
