# Diagramme de Déploiement — VoxelPlace

```mermaid
graph TB
    Browser["🌐 Navigateur Web"]
    MCClient["⛏ Client Minecraft 1.21.1"]

    subgraph Internet["Internet"]
        Funnel["Tailscale Funnel\nHTTPS auto"]
        Playit["Playit.gg\nTunnel TCP 25565"]
    end

    subgraph Server["Serveur Debian — Docker Compose"]
        Web["voxelplace-web\nNext.js 16 — port 80"]
        API["voxelplace-api\nFastify + Socket.io — port 3001"]
        DB[("voxelplace-db\nPostgreSQL 16")]
        Redis[("voxelplace-redis\nRedis 7")]
        MC["Paper 1.21.1\n+ Plugin VoxelPlace\n(hors Docker)"]
    end

    subgraph CICD["CI/CD"]
        GH["GitHub Actions\ntest → deploy SSH"]
    end

    Browser   -->|HTTPS / WSS| Funnel
    MCClient  -->|TCP| Playit

    Funnel --> Web
    Funnel --> API
    Playit --> MC

    Web --> API
    MC  -->|socket.io-client| API
    API --> Redis
    API --> DB

    GH -->|SSH Tailscale\ngit reset + docker compose up| Server
```

---

| Composant | Image | Port |
|-----------|-------|------|
| `voxelplace-web` | node:20-alpine (Next.js standalone) | 80 |
| `voxelplace-api` | node:20-alpine | 3001 |
| `voxelplace-db` | postgres:16-alpine | 5432 (interne) |
| `voxelplace-redis` | redis:7-alpine (RDB + AOF) | 6379 (interne) |
| Paper 1.21.1 | JVM — hors Docker | 25565 via Playit.gg |
