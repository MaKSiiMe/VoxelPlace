# Diagramme de Classes — VoxelPlace

```mermaid
classDiagram

    %% ─── Entités métier ───────────────────────────────────────────────────────

    class User {
        +int id
        +string username
        -string passwordHash
        +string source
        +timestamp createdAt
        +register(username, password) User
        +login(username, password) Token
        +hashPassword(password) string
        +verifyPassword(password) boolean
    }

    class Pixel {
        +int x
        +int y
        +int colorId
        +string username
        +string source
        +timestamp placedAt
    }

    class Color {
        +int id
        +string name
        +string hexCode
    }

    %% ─── Backend — Fastify + Socket.io ───────────────────────────────────────

    class VoxelPlaceServer {
        -Fastify app
        -Server io
        -Redis redis
        -Pool pgPool
        -Map connectedPlayers
        +start(port) void
        +broadcastPlayers() void
        +getPlayersPayload() PlayersPayload
        +getStats() StatsPayload
    }

    class GridService {
        +loadGrid(redis) Buffer
        +setPixel(redis, pixel) PixelMeta
        +getPixelMeta(redis, x, y) PixelMeta
        +getPixelIndex(x, y) int
        +GRID_SIZE int
    }

    class ValidationUtils {
        +isValidCoord(v) boolean
        +sanitizeUsername(raw) string
        +validatePixel(data) Pixel
    }

    class AuthRoutes {
        +register(fastify, opts) void
        +POST_register(username, password) Token
        +POST_login(username, password) Token
    }

    class DatabasePool {
        -Pool pgPool
        +connectWithRetry() Pool
        +query(sql, params) Result
    }

    %% ─── Frontend — Next.js App Router ───────────────────────────────────────

    class GamePage {
        -string username
        +getOrCreateUsername() string
        +render() JSX
    }

    class CanvasEngine {
        -RefObject containerRef
        +render() JSX
    }

    class usePixiCanvas {
        -Application app
        -BufferImageSource bufferSource
        -Sprite gridSprite
        -boolean isPanning
        -boolean isSpaceDown
        +init() Promise~void~
        +fitAndCenter(app, sprite, size) void
        +gridToRGBA(grid, size) Uint8Array
        +onWheel(e) void
        +onKeyDown(e) void
    }

    class CanvasStore {
        +Uint8Array grid
        +int gridSize
        +int selectedColor
        +hoveredPixel object
        +string[] colors
        +players PlayersPayload
        +int cooldownUntil
        +setGrid(grid) void
        +setSelectedColor(colorId) void
        +setHoveredPixel(pixel) void
        +setCooldown(seconds) void
        +updatePixel(x, y, colorId) void
        +placePixel(x, y, username) void
    }

    class GameFrame {
        +render() JSX
    }

    class ColorDock {
        +render() JSX
    }

    class SidebarLeft {
        +render() JSX
    }

    class StatusPills {
        +render() JSX
    }

    class CockpitStore {
        +boolean isSidebarOpen
        +string activeNavItem
        +toggleSidebar() void
        +setActiveNavItem(item) void
    }

    class useSocket {
        +connect(username) void
        +on_grid_init(payload) void
        +on_pixel_update(payload) void
        +on_players_update(payload) void
        +disconnect() void
    }

    class SocketClient {
        -string API_URL
        +socket Socket
        +autoConnect boolean
    }

    %% ─── Plugin Minecraft ────────────────────────────────────────────────────

    class VoxelPlacePlugin {
        -CanvasManager canvasManager
        -SocketManager socketManager
        +onEnable() void
        +onDisable() void
    }

    class CanvasManager {
        -World world
        -int cornerX
        -int cornerY
        -int cornerZ
        -byte[] grid
        +setPixel(x, y, colorId) void
        +initGrid(data) void
        +getCanvasCoords(block) int[]
    }

    class SocketManager {
        -Socket socket
        +connect() void
        +disconnect() void
        +emitPixelPlace(x, y, colorId, username) void
    }

    class CanvasListener {
        +onPlayerInteract(event) void
        +onBlockBreak(event) void
    }

    class VoxelCommand {
        +onCommand(sender, cmd, args) boolean
    }

    %% ─── Relations ───────────────────────────────────────────────────────────

    User       "1" --> "n" Pixel    : place
    Pixel      "n" --> "1" Color    : utilise

    VoxelPlaceServer --> GridService      : utilise
    VoxelPlaceServer --> ValidationUtils  : utilise
    VoxelPlaceServer --> AuthRoutes       : enregistre
    VoxelPlaceServer --> DatabasePool     : utilise

    GamePage        --> CanvasEngine   : render
    GamePage        --> GameFrame      : render
    GamePage        --> useSocket      : hook
    CanvasEngine    --> usePixiCanvas  : hook
    usePixiCanvas   --> CanvasStore    : subscribe
    GameFrame       --> SidebarLeft    : render
    GameFrame       --> ColorDock      : render
    GameFrame       --> StatusPills    : render
    ColorDock       --> CanvasStore    : selectedColor / setSelectedColor
    StatusPills     --> CanvasStore    : players / hoveredPixel
    SidebarLeft     --> CockpitStore   : activeNavItem
    useSocket       --> CanvasStore    : setGrid / updatePixel / setPlayers
    useSocket       --> SocketClient   : socket

    VoxelPlacePlugin  *-- CanvasManager   : composition
    VoxelPlacePlugin  *-- SocketManager   : composition
    CanvasListener    --> CanvasManager   : utilise
    CanvasListener    --> SocketManager   : utilise
    VoxelCommand      --> CanvasManager   : utilise
    VoxelCommand      --> SocketManager   : utilise

    SocketManager  ..> VoxelPlaceServer  : WebSocket
    SocketClient   ..> VoxelPlaceServer  : WebSocket
```

---

## Notes sur l'architecture

### Zustand vs React state
Les stores **CanvasStore** et **CockpitStore** sont des singletons Zustand avec `subscribeWithSelector`. Le moteur PixiJS (`usePixiCanvas`) s'abonne directement à `CanvasStore` **sans passer par React** : il n'y a aucun re-render React lors d'un `pixel:update` entrant — seule la texture GPU est mise à jour.

### Séparation des responsabilités (features)

| Feature | Responsabilité |
|---------|----------------|
| `canvas/` | Moteur PixiJS, store grille, zoom/pan, placement pixel |
| `hud/` | Chrome UI (GameFrame, ColorDock, StatusPills, SidebarLeft), store UI |
| `realtime/` | Socket.io client singleton + hook de connexion |
| `stats/` | Dashboard analytics (Phase 5) |
| `admin/` | Modération (Phase 5) |
| `platforms/` | UI spécifique par plateforme (Phase 6) |
