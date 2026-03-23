<div align="center">

# 🎨 VoxelPlace

**Canvas collaboratif en temps réel — inspiré de r/place**

*Projet de fin d'année — Holberton School · Validation RNCP*

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io)
[![Socket.io](https://img.shields.io/badge/Socket.io-4-010101?logo=socket.io)](https://socket.io)
[![Fastify](https://img.shields.io/badge/Fastify-4-000000?logo=fastify)](https://fastify.dev)
[![Minecraft](https://img.shields.io/badge/Minecraft-Paper%201.21.1-62B47A?logo=minecraft&logoColor=white)](https://papermc.io)

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
        WEB["🌐 Browser\n(React + Canvas)"]
        MC["⛏ Minecraft\n(Plugin Spigot)"]
        RB["🎮 Roblox\n(Script Lua)"]
        HY["🏔 Hytale\n(Mod API)"]
    end

    subgraph Backend["Backend — Node.js"]
        API["⚡ Fastify\nREST API"]
        SIO["🔌 Socket.io\nTemps réel"]
    end

    subgraph Storage["Stockage"]
        REDIS[("🗄 Redis\n192.168.68.51:6379")]
    end

    WEB  <-->|"WebSocket"| SIO
    MC   <-->|"WebSocket"| SIO
    RB   <-->|"WebSocket"| SIO
    HY   <-->|"WebSocket"| SIO
    WEB  <-->|"GET /api/grid"| API
    SIO  <-->|"SETRANGE / HSET"| REDIS
    API  <-->|"GET / GETRANGE"| REDIS
```

### Rôle de chaque composant

| Composant | Rôle |
|-----------|------|
| **Fastify** | Chef d'orchestre HTTP — expose les routes REST, valide les données entrantes, applique le rate limiting et les règles de sécurité |
| **Socket.io** | Bus d'événements temps réel — reçoit les pixels des clients, les persiste via Redis, puis les diffuse à **tous** les clients connectés simultanément (Web, Minecraft, Roblox, Hytale) |
| **Redis** | Source de vérité unique — stocke la grille sous forme de buffer binaire pour une lecture ultra-rapide, et les métadonnées par pixel dans un Hash |
| **React + Canvas API** | Interface web — rendu de la grille 64×64 avec zoom/pan, palette de couleurs, connexion Socket.io pour les mises à jour en direct |

---

## ⚙️ Stack technique

| Couche | Technologie | Justification |
|--------|-------------|---------------|
| Runtime | **Node.js 18+** | Support ESM natif, performances I/O async |
| Framework HTTP | **Fastify 4** | 2× plus rapide qu'Express, validation JSON Schema intégrée |
| Temps réel | **Socket.io 4** | Abstraction WebSocket avec fallback, rooms, acknowledgements |
| Base de données | **Redis 7** | Structures de données natives, sub-milliseconde, pub/sub |
| Frontend | **React 18 + Vite** | HMR instantané en dev, build optimisé |
| Rendu | **Canvas API (HTML5)** | Rendu pixel-perfect, zoom/pan sans re-render React |
| Env | **dotenv** | Séparation configuration / code |

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

Ce diagramme illustre le trajet complet d'un pixel posé depuis Minecraft jusqu'à sa propagation simultanée sur **toutes les plateformes connectées**.

```mermaid
sequenceDiagram
    actor MC as ⛏ Joueur Minecraft
    participant Plugin as Plugin Spigot
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

    WEB->>WEB: drawPixel(12, 34, "#00AA00")
    RB->>RB: UpdatePart(12, 34, Color3.new(...))
    HY->>HY: SetBlock(12, 34, blockType)

    Note over WEB,HY: Le pixel apparaît instantanément sur toutes les plateformes
```

---

## 📡 API REST

**Base URL :** `http://localhost:3001`

---

### `GET /api/grid`

Retourne l'état complet de la grille. Appelé une seule fois au chargement initial par les clients non-WebSocket.

**Réponse `200 OK`**

```json
{
  "size": 64,
  "colors": ["#FFFFFF", "#000000", "#FF4444", "#00AA00", "#4444FF", "#FFFF00", "#FF8800", "#AA00AA"],
  "grid": [0, 0, 3, 0, 1, 2, ...]
}
```

| Champ | Type | Description |
|-------|------|-------------|
| `size` | `number` | Côté de la grille (64) |
| `colors` | `string[8]` | Palette : `colors[colorId]` → code hex |
| `grid` | `number[4096]` | Un entier par pixel ; accès : `grid[y * 64 + x]` |

---

### `GET /api/pixel/:x/:y`

Retourne les métadonnées complètes du dernier pixel posé en `(x, y)`.
Utilisé par le mode admin et les clients qui souhaitent inspecter un pixel.

**Paramètres**

| Paramètre | Type | Contrainte |
|-----------|------|------------|
| `x` | entier | 0 ≤ x ≤ 63 |
| `y` | entier | 0 ≤ y ≤ 63 |

**Réponse `200 OK`**

```json
{
  "x": 12,
  "y": 34,
  "colorId": 3,
  "username": "Steve",
  "source": "minecraft",
  "updatedAt": 1710000000000
}
```

**Réponse `400 Bad Request`**

```json
{ "error": "Coordonnées invalides" }
```

---

## 🔌 API Socket.io

**Connexion :** `io("http://localhost:3001")`

### Événements reçus par le client

| Événement | Déclencheur | Payload |
|-----------|-------------|---------|
| `grid:init` | Connexion initiale | `{ size, colors, grid }` — grille complète |
| `pixel:update` | Tout pixel posé ou supprimé | `{ x, y, colorId, username, source }` |

### Événements émis par le client

#### `pixel:place` — Poser un pixel

```js
socket.emit("pixel:place", {
  x: 12,             // entier strict 0–63
  y: 34,             // entier strict 0–63
  colorId: 3,        // entier strict 0–7
  username: "Steve", // max 32 caractères
  source: "web"      // "web" | "minecraft" | "roblox" | "hytale"
}, (ack) => {
  if (ack.ok)       console.log("Pixel posé !")
  if (ack.error)    console.warn(ack.error)    // ex : "Trop vite ! Attends 1s."
  if (ack.cooldown) console.log(`Retry dans ${ack.cooldown}s`)
})
```

#### `admin:auth` — Authentification admin

```js
socket.emit("admin:auth", "mot_de_passe", (ack) => {
  // ack.ok    → session admin active jusqu'à déconnexion
  // ack.error → "Mot de passe incorrect"
})
```

#### `admin:clear` — Supprimer un pixel *(admin requis)*

```js
socket.emit("admin:clear", { x: 12, y: 34 }, (ack) => {
  // ack.ok    → pixel remis à blanc, pixel:update diffusé à tous
  // ack.error → "Non autorisé" | "Coordonnées invalides"
})
```

#### `admin:clearAll` — Vider toute la toile *(admin requis)*

```js
socket.emit("admin:clearAll", null, (ack) => {
  // ack.ok    → tous les pixels remis à blanc, pixel:update diffusé pour chaque pixel
  // ack.error → "Non autorisé"
})
```

> Accessible via le bouton **"🗑 Vider le canvas"** dans le mode admin du site web.

---

## 🎨 Palette de couleurs

Les 8 couleurs sont ordonnées du clair au sombre en suivant le spectre visible.

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
| **XSS via pseudo** | Suppression des caractères `< > " ' \`` et des caractères de contrôle `\x00–\x1F` côté serveur avant toute persistance |
| **Spam de pixels** | Rate limit 1 pixel / seconde / `username` en mémoire (Map JS), vérifié exclusivement côté serveur |
| **Coordonnées invalides** | `Number.isInteger()` + bornes 0–63 strictes ; les floats, `NaN` et `Infinity` sont rejetés |
| **Accès admin non autorisé** | Mot de passe vérifié sur le serveur (`process.env.ADMIN_PASSWORD`) ; l'autorisation est liée à la connexion Socket.io, pas au client |
| **Injection Redis** | Utilisation de l'API `ioredis` avec paramètres typés — aucune interpolation de chaîne dans les commandes Redis |

---

## 👑 Mode Admin

L'interface de modération permet d'inspecter n'importe quel pixel et de le supprimer.

### Activation

1. **Cliquer 5 fois rapidement** sur le logo `VoxelPlace` (dans un délai de 3 secondes)
2. Saisir le mot de passe (`ADMIN_PASSWORD` du `.env`)
3. Le logo devient **👑 VoxelPlace** et un badge **MODE ADMIN** apparaît

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

Le bouton remet le pixel à `colorId 0` (blanc) et propage l'événement à **tous les clients connectés** (Web, Minecraft, Roblox, Hytale) en temps réel.

Un second bouton **"🗑 Vider le canvas"** remet **toute la toile** à zéro en une seule action (avec confirmation).

### Désactivation

Cliquer à nouveau 5 fois sur le logo → retour en mode normal.

---

## ⛏ Plugin Minecraft

Le plugin connecte un serveur **Paper 1.21.1** au backend VoxelPlace via Socket.io. Il matérialise la toile en blocs dans le monde Minecraft et propage chaque changement en temps réel vers tous les autres clients.

### Fonctionnement

- Au démarrage, le plugin reçoit `grid:init` et dessine le canvas en blocs dans le monde
- Un **clic droit** avec un bloc de la palette sur le canvas envoie `pixel:place` au serveur
- Les `pixel:update` reçus depuis le serveur mettent à jour les blocs correspondants en jeu
- La destruction de blocs du canvas est bloquée

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
| `/vp fill` | Recharge la grille depuis le serveur via l'API REST |
| `/vp reload` | Reconnecte le plugin au serveur VoxelPlace |
| `/vp info` | Affiche l'état de la connexion et la taille du canvas |

### Configuration (`plugins/VoxelPlace/config.yml`)

```yaml
server-url: "http://<IP_SERVEUR>:3001"
canvas:
  world: "world"
  x: 0        # coin Nord-Ouest — défini par /vp setup
  y: 65       # hauteur du canvas
  z: 0
  width: 16   # largeur (max 64)
  height: 16  # profondeur (max 64)
```

### Build & Installation

```bash
# Prérequis : Java 21+, Maven
cd voxelplace-minecraft
mvn clean package -q
# → target/VoxelPlace.jar

# Copier dans le dossier plugins du serveur Paper
cp target/VoxelPlace.jar /chemin/vers/plugins/
```

---

## 🐳 Déploiement & CI/CD

### Infrastructure

Le backend tourne en production sur un serveur Linux via Docker, accessible à distance via **Tailscale** (VPN mesh).

| Service | Technologie | Accès |
|---------|-------------|-------|
| API VoxelPlace | Docker (image Node.js 20 Alpine) | `http://<TAILSCALE_IP>:3001` |
| Redis | Docker (existant) | `redis://<IP_SERVEUR>:6379` |
| Minecraft | Docker (`itzg/minecraft-server` Paper 1.21.1) | `<TAILSCALE_IP>:25565` |
| Portainer | Docker | `https://<TAILSCALE_IP>:9443` |

### Déployer l'API avec Docker

```bash
# Depuis la racine du projet
docker compose up --build -d
```

L'API se connecte automatiquement à Redis via `REDIS_URL` défini dans `voxelplace-api/.env`.

### CI/CD — GitHub Actions

Chaque push sur `main` déclenche automatiquement un redéploiement :

```
git push → GitHub Actions → Tailscale VPN → SSH → git pull + docker compose up
```

Le workflow `.github/workflows/deploy.yml` nécessite trois secrets GitHub :

| Secret | Description |
|--------|-------------|
| `TAILSCALE_AUTHKEY` | Clé d'accès au réseau Tailscale |
| `SSH_PRIVATE_KEY` | Clé privée SSH pour accéder au serveur |
| `SSH_USER` | Utilisateur SSH du serveur |

---

## 🚀 Installation & Lancement

### Prérequis

- **Node.js ≥ 18** — [nodejs.org](https://nodejs.org)
- **Redis ≥ 6** accessible depuis la machine hébergeant le backend

```bash
# Vérifier Node.js
node --version    # v18.x.x ou supérieur

# Tester la connectivité Redis
redis-cli -h 192.168.68.51 -p 6379 ping
# Réponse attendue : PONG
```

**Installer Node.js si nécessaire :**

```bash
# Ubuntu / Debian / WSL
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# macOS
brew install node
```

### Cloner & Installer

```bash
git clone <url-du-repo>
cd VoxelPlace

cd voxelplace-api && npm install && cd ..
cd voxelplace-web && npm install && cd ..
```

### Configurer le `.env`

```bash
cp voxelplace-api/.env.example voxelplace-api/.env
```

Éditer `voxelplace-api/.env` :

```dotenv
REDIS_URL=redis://192.168.68.51:6379
PORT=3001
ADMIN_PASSWORD=changeme
```

> 💡 Si le backend tourne sur une autre machine, créer `voxelplace-web/.env` :
> ```dotenv
> VITE_API_URL=http://<IP_SERVEUR>:3001
> ```

### Lancer en développement

```bash
# Terminal 1 — Backend
cd voxelplace-api && npm run dev
# ✓ [Fastify] Serveur démarré sur http://0.0.0.0:3001
# ✓ [Redis] Connecté à redis://192.168.68.51:6379

# Terminal 2 — Frontend
cd voxelplace-web && npm run dev
# ✓ VITE ready on http://localhost:5173
```

Ouvrir [http://localhost:5173](http://localhost:5173) 🎉

### Build de production

```bash
cd voxelplace-web && npm run build
cd voxelplace-api && npm start
```

---

## 📁 Structure du projet

```
VoxelPlace/
├── .github/workflows/
│   └── deploy.yml                   # CI/CD — déploiement automatique sur push main
├── docker-compose.yml               # Orchestration Docker (API + frontend)
├── docs/
│   └── uml/
│       ├── class-diagram.md         # Diagramme de classes (MermaidJS)
│       ├── use-case.md              # Diagramme de cas d'utilisation
│       ├── sequence-diagram.md      # Diagrammes de séquence (3 scénarios)
│       ├── deployment-diagram.md    # Architecture de déploiement
│       └── erd-merise.md            # ERD + MCD/MLD Merise + justification Redis
├── voxelplace-api/                  # Backend Fastify + Socket.io
│   ├── src/
│   │   ├── index.js                 # Serveur, routes REST, événements Socket.io
│   │   ├── grid.js                  # Couche Redis (buffer binaire + HSET)
│   │   └── utils.js                 # Fonctions pures : validation, sanitisation
│   ├── tests/
│   │   ├── validation.test.js       # 18 tests — isValidCoord, sanitize, validatePixel
│   │   └── grid.test.js             # 6 tests — getPixelIndex, GRID_SIZE
│   ├── .env                         # REDIS_URL, PORT, ADMIN_PASSWORD, TEST_USERNAMES
│   ├── .env.example
│   └── package.json                 # script: npm test
│
├── voxelplace-web/                  # Frontend React + Vite
│   ├── src/
│   │   ├── App.jsx                  # Composant racine, socket, admin, RGPD banner
│   │   ├── socket.js                # Instance Socket.io partagée
│   │   └── components/
│   │       ├── GridCanvas.jsx       # Canvas HTML5, zoom/pan, hover tooltip
│   │       ├── ColorPicker.jsx      # Palette 8 couleurs avec raccourcis clavier
│   │       └── PixelModal.jsx       # Fiche pixel (inspection + suppression admin)
│   ├── Dockerfile                   # Build Vite → nginx
│   ├── nginx.conf                   # Proxy /api et /socket.io vers l'API
│   ├── index.html                   # SEO : title, meta description, Open Graph
│   ├── vite.config.js
│   └── package.json
│
└── voxelplace-minecraft/            # Plugin Paper 1.21.1
    ├── src/main/java/fr/voxelplace/minecraft/
    │   ├── VoxelPlacePlugin.java    # Point d'entrée Bukkit
    │   ├── CanvasManager.java       # Dessin des blocs, mapping colorId ↔ Material
    │   ├── SocketManager.java       # Client Socket.io, events grid:init / pixel:update
    │   ├── CanvasListener.java      # Clic droit, destruction, action bar (PlayerMove)
    │   └── VoxelCommand.java        # /vp setup|fill|reload|info|help
    ├── src/main/resources/
    │   ├── plugin.yml
    │   └── config.yml
    └── pom.xml                      # Maven + maven-shade-plugin
```

---

## 🗺 Roadmap

```mermaid
gantt
    title VoxelPlace — Roadmap
    dateFormat  YYYY-MM-DD
    section Phase 1 — MVP Web
    Serveur Fastify + Redis          :done, 2025-01-01, 2025-01-15
    Canvas React + Socket.io         :done, 2025-01-10, 2025-01-20
    section Phase 2 — UX & Sécurité
    Zoom / Pan Canvas                :done, 2025-01-20, 2025-01-25
    Rate limiting + XSS              :done, 2025-01-22, 2025-01-28
    section Phase 3 — Intégration Minecraft
    Plugin Paper 1.21.1 (Java)       :done, 2025-02-01, 2025-03-01
    Mapping blocs ↔ colorId          :done, 2025-02-15, 2025-03-01
    section Phase 4 — Admin & Modération
    Dashboard admin                  :done, 2025-03-01, 2025-03-15
    Inspection & suppression pixels  :done, 2025-03-01, 2025-03-15
    section Phase 4b — DevOps
    Dockerisation API                :done, 2025-03-15, 2025-03-20
    CI/CD GitHub Actions             :done, 2025-03-15, 2025-03-20
    Accès distant Tailscale          :done, 2025-03-15, 2025-03-20
    section Phase 5 — Cross-Game
    Client Roblox (Lua)              :2025-04-01, 2025-05-01
    Client Hytale (Mod API)          :2025-04-01, 2025-05-01
```

### Détail des phases

<details>
<summary>✅ Phase 1 — MVP Web & Backend</summary>

- Serveur Fastify avec routes REST (`/api/grid`, `/api/pixel/:x/:y`)
- Persistance Redis duale (buffer binaire + HSET métadonnées)
- Frontend React avec Canvas HTML5 et connexion Socket.io
- Diffusion temps réel des pixels à tous les clients connectés

</details>

<details>
<summary>✅ Phase 2 — Polissage UX & Sécurité</summary>

- Zoom (molette) et pan (clic+glisser) sur le canvas, centré sur le curseur
- Rate limiting serveur : 1 pixel/seconde/username
- Sanitisation XSS des pseudos et sources
- Validation stricte des coordonnées (`Number.isInteger`, bornes 0–63)
- Layout plein écran avec barre de palette en bas

</details>

<details>
<summary>✅ Phase 3 — Intégration Minecraft</summary>

- Plugin **Paper 1.21.1** avec client Socket.io Java (socket.io-client 2.1.0 shadé)
- **Clic droit** sur un bloc du canvas → `pixel:place` envoyé au serveur avec rate limiting
- Réception des `pixel:update` → mise à jour immédiate des blocs en jeu
- Canvas configurable (taille, position, monde) via `config.yml`
- Commandes `/vp setup|fill|reload|info` (permission OP)
- Comptes test sans cooldown via `TEST_USERNAMES` dans `.env`
- Mise à jour optimiste : le bloc est dessiné immédiatement, revert si le serveur refuse

</details>

<details>
<summary>✅ Phase 4 — Dashboard Admin & Modération <em>(RNCP)</em></summary>

- Authentification admin par mot de passe via Socket.io
- Inspection de tout pixel : auteur, source, timestamp
- Suppression (remise à blanc) avec propagation instantanée vers Web, Minecraft, Roblox et Hytale
- Déclencheur discret : 5 clics sur le logo

</details>

<details>
<summary>📋 Phase 5 — Extension Cross-Game</summary>

- Client Roblox en Lua : WebSocket vers le backend, mapping `BrickColor` → `colorId`
- Client Hytale : intégration via Mod API, mapping blocs → `colorId`
- Les deux plateformes reçoivent et émettent des `pixel:update` comme n'importe quel autre client

</details>

---

<div align="center">

**VoxelPlace** — Holberton School · Projet de fin d'année · Validation RNCP

*Un pixel à la fois.*

</div>
