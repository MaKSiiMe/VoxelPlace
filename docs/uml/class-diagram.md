# Diagramme de Classes — VoxelPlace

```mermaid
classDiagram

    %% ── Backend ──────────────────────────────────────────────────────────────

    class VoxelPlaceServer {
        +start(port)
        +broadcastPlayers()
    }

    class GridService {
        +GRID_SIZE : int
        +loadGrid(redis) Buffer
        +setPixel(redis, pixel)
        +getPixelIndex(x, y) int
    }

    class AuthRoutes {
        +POST_register()
        +POST_login()
        +DELETE_account()
    }

    class AdminRoutes {
        +POST_ban()
        +DELETE_canvas()
        +POST_restoreCanvas()
    }

    class UnlockEngine {
        +processPixelPlaced()
        +checkFeatureUnlocks()
    }

    %% ── Frontend ─────────────────────────────────────────────────────────────

    class GamePage {
        +getStoredAuth()
        +handleAuthSuccess()
    }

    class CanvasStore {
        +grid : Uint8Array
        +selectedColor : int
        +cooldownEnd : number
        +role : string
        +updatePixel(x, y, colorId)
        +setCooldown(ms)
    }

    class usePixiCanvas {
        +gridToRGBA(grid) Uint8Array
        +handleClick(e)
    }

    class useSocket {
        +connect(username)
        +emit_pixel_place(x, y, colorId)
    }

    class AuthModal {
        +handleSubmit()
    }

    class AdminGuard {
        +getRole() string
    }

    %% ── Plugin Minecraft ─────────────────────────────────────────────────────

    class VoxelPlacePlugin {
        +onEnable()
        +onDisable()
    }

    class CanvasManager {
        +COLOR_MATERIALS : Material[16]
        +setPixelLocal(dx, dz, colorId)
        +materialToColorId(mat) int
    }

    class SocketManager {
        +connect()
        +emitPixelPlace(x, y, colorId, username)
    }

    class CanvasListener {
        +onPlayerInteract(event)
    }

    %% ── Relations ────────────────────────────────────────────────────────────

    VoxelPlaceServer --> GridService    : utilise
    VoxelPlaceServer --> AuthRoutes     : enregistre
    VoxelPlaceServer --> AdminRoutes    : enregistre
    VoxelPlaceServer --> UnlockEngine   : utilise

    GamePage        --> useSocket       : hook
    GamePage        --> AuthModal       : affiche
    useSocket       --> CanvasStore     : setGrid / updatePixel
    usePixiCanvas   --> CanvasStore     : subscribe
    AdminGuard      ..> GamePage        : protège /dashboard

    VoxelPlacePlugin *-- CanvasManager  : composition
    VoxelPlacePlugin *-- SocketManager  : composition
    VoxelPlacePlugin *-- CanvasListener : composition
    CanvasListener   --> CanvasManager  : utilise
    CanvasListener   --> SocketManager  : utilise

    SocketManager  ..> VoxelPlaceServer : WebSocket
    useSocket      ..> VoxelPlaceServer : WebSocket
```

---

## Architecture en couches

| Couche | Technologie | Rôle |
|--------|-------------|------|
| **Frontend** | Next.js 16 + Pixi.js + Zustand | Canvas GPU, HUD, auth |
| **Backend** | Fastify 5 + Socket.io 4 | API REST + WebSocket |
| **Stockage** | Redis + PostgreSQL | Grille temps réel + historique |
| **Minecraft** | Paper 1.21.1 + socket.io-client | Pont jeu ↔ canvas |
