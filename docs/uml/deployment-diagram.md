# Diagramme de Déploiement — VoxelPlace

```mermaid
graph TB
    subgraph EXT["Utilisateurs externes"]
        Browser["🌐 Navigateur Web\nHTTP port 80"]
        MCClient["⛏ Client Minecraft 1.21.1\nTCP port 25565"]
        RBStudio["🎮 Roblox Studio\nhébergé Roblox Inc"]
        HYClient["🏔 Client Hytale\n(futur)"]
    end

    subgraph GH["GitHub"]
        Repo["Repository\nbranch main"]
        Actions["GitHub Actions\nCI/CD"]
    end

    subgraph Server["Serveur Debian — Tailscale 100.124.153.20"]
        subgraph Docker["Docker Engine"]
            ContainerFront["voxelplace-web\nNext.js 16 standalone\nNode 20-alpine · port 80→3000"]
            ContainerAPI["voxelplace-api\nFastify 5 + Socket.io 4\nNode 20-alpine · port 3001"]
            ContainerDB["voxelplace-db\nPostgreSQL 16-alpine\nport 5432 (interne)"]
            ContainerMC["minecraft-paper\nPaper 1.21.1\nport 25565"]
        end
        Redis[("Redis 7\nport 6379\n(externe Docker)")]
    end

    subgraph Dev["Développeur — WSL2"]
        LocalDev["VS Code + Claude Code\nnpm run dev (Turbopack)"]
    end

    Browser -->|"HTTP GET /"| ContainerFront
    Browser -->|"WebSocket /socket.io"| ContainerAPI
    MCClient -->|"TCP"| ContainerMC
    RBStudio -->|"WebSocket"| ContainerAPI
    HYClient -.->|"WebSocket (futur)"| ContainerAPI

    ContainerFront -->|"NEXT_PUBLIC_API_URL\nhttp://voxelplace-api:3001"| ContainerAPI
    ContainerMC -->|"socket.io-client"| ContainerAPI
    ContainerAPI -->|"SETRANGE / HGET"| Redis
    ContainerAPI -->|"INSERT / SELECT\nDATABASE_URL"| ContainerDB

    LocalDev -->|"git push"| Repo
    Repo --> Actions
    Actions -->|"SSH via Tailscale\ngit pull + docker compose up"| Server
```

---

## Description des conteneurs

| Conteneur | Image | Port exposé | Rôle |
|-----------|-------|-------------|------|
| `voxelplace-web` | `node:20-alpine` (Next.js standalone) | `80 → 3000` | Serveur SSR/CSR Next.js — sert les pages React + assets statiques |
| `voxelplace-api` | `node:20-alpine` | `3001` | Fastify 5 + Socket.io 4 — API REST + WebSocket temps réel |
| `voxelplace-db` | `postgres:16-alpine` | `5432` (interne) | PostgreSQL — tables `users` + `pixel_history` |
| `minecraft-paper` | Manuel | `25565` | Serveur Paper 1.21.1 avec plugin VoxelPlace |

> **Redis** tourne en dehors de Docker sur le même serveur (`192.168.68.51:6379`).

## Build Next.js — Multi-stage Dockerfile

```
Stage 1 : deps     → npm ci (workspace node_modules)
Stage 2 : builder  → npx turbo build --filter=@voxelplace/web → .next/standalone
Stage 3 : runner   → node:20-alpine, node apps/web/server.js
```

La sortie `output: 'standalone'` de Next.js produit un bundle autonome sans `node_modules` complet, ce qui réduit l'image finale à ~150 Mo.
