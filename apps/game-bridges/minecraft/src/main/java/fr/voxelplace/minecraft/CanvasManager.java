package fr.voxelplace.minecraft;

import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.World;
import org.bukkit.block.Block;
import org.bukkit.scheduler.BukkitRunnable;
import org.json.JSONArray;

import java.util.HashMap;
import java.util.Map;

public class CanvasManager {

    private final VoxelPlacePlugin plugin;

    private static final int GRID_SIZE = 2048;
    private static final int GRID_HALF = GRID_SIZE / 2; // 1024 = math (0,0)

    private World  world;
    private int    cornerX, cornerY, cornerZ;
    private int    width, height;
    private int    offsetX, offsetZ; // coin de la fenêtre dans l'espace grille 0-2047
    private boolean configured = false;

    // Cache local de la grille (colorId par pixel)
    private byte[] grid;

    // colorId (0-7) → Material à afficher dans le monde
    static final Material[] COLOR_MATERIALS = {
        Material.WHITE_CONCRETE,    // 0 — blanc
        Material.BLACK_CONCRETE,    // 1 — noir
        Material.RED_CONCRETE,      // 2 — rouge
        Material.GREEN_CONCRETE,    // 3 — vert
        Material.BLUE_CONCRETE,     // 4 — bleu
        Material.YELLOW_CONCRETE,   // 5 — jaune
        Material.ORANGE_CONCRETE,   // 6 — orange
        Material.PURPLE_CONCRETE,   // 7 — violet
    };

    // Material → colorId (accepte concrete ET wool)
    private static final Map<Material, Integer> MATERIAL_TO_COLOR = new HashMap<>();
    static {
        MATERIAL_TO_COLOR.put(Material.WHITE_CONCRETE,   0);
        MATERIAL_TO_COLOR.put(Material.WHITE_WOOL,       0);
        MATERIAL_TO_COLOR.put(Material.BLACK_CONCRETE,   1);
        MATERIAL_TO_COLOR.put(Material.BLACK_WOOL,       1);
        MATERIAL_TO_COLOR.put(Material.RED_CONCRETE,     2);
        MATERIAL_TO_COLOR.put(Material.RED_WOOL,         2);
        MATERIAL_TO_COLOR.put(Material.GREEN_CONCRETE,   3);
        MATERIAL_TO_COLOR.put(Material.GREEN_WOOL,       3);
        MATERIAL_TO_COLOR.put(Material.BLUE_CONCRETE,    4);
        MATERIAL_TO_COLOR.put(Material.BLUE_WOOL,        4);
        MATERIAL_TO_COLOR.put(Material.YELLOW_CONCRETE,  5);
        MATERIAL_TO_COLOR.put(Material.YELLOW_WOOL,      5);
        MATERIAL_TO_COLOR.put(Material.ORANGE_CONCRETE,  6);
        MATERIAL_TO_COLOR.put(Material.ORANGE_WOOL,      6);
        MATERIAL_TO_COLOR.put(Material.PURPLE_CONCRETE,  7);
        MATERIAL_TO_COLOR.put(Material.PURPLE_WOOL,      7);
    }

    public CanvasManager(VoxelPlacePlugin plugin) {
        this.plugin = plugin;
        loadFromConfig();
    }

    private void loadFromConfig() {
        var cfg     = plugin.getConfig();
        String wName = cfg.getString("canvas.world", "world");
        world    = Bukkit.getWorld(wName);
        cornerX  = cfg.getInt("canvas.x",      0);
        cornerY  = cfg.getInt("canvas.y",      64);
        cornerZ  = cfg.getInt("canvas.z",      0);
        width    = Math.min(cfg.getInt("canvas.width",   64), GRID_SIZE);
        height   = Math.min(cfg.getInt("canvas.height",  64), GRID_SIZE);
        offsetX  = cfg.getInt("canvas.offsetX", GRID_HALF);
        offsetZ  = cfg.getInt("canvas.offsetZ", GRID_HALF);
        grid     = new byte[width * height];
        configured = (world != null);

        if (!configured) {
            plugin.getLogger().warning("Monde '" + wName + "' introuvable. Faites /vp setup en jeu.");
        }
    }

    // ── API publique ────────────────────────────────────────────────────────

    /** Définit le coin du canvas à la position du joueur et sauvegarde dans config.yml */
    public void setCorner(Location loc) {
        world   = loc.getWorld();
        cornerX = loc.getBlockX();
        cornerY = loc.getBlockY();
        cornerZ = loc.getBlockZ();
        configured = true;

        var cfg = plugin.getConfig();
        cfg.set("canvas.world",   world.getName());
        cfg.set("canvas.x",       cornerX);
        cfg.set("canvas.y",       cornerY);
        cfg.set("canvas.z",       cornerZ);
        cfg.set("canvas.offsetX", offsetX);
        cfg.set("canvas.offsetZ", offsetZ);
        plugin.saveConfig();
    }

    /**
     * Met à jour un pixel depuis les coordonnées locales (0-based dans la fenêtre).
     * Utilisé pour la mise à jour optimiste depuis CanvasListener.
     */
    public void setPixelLocal(int dx, int dz, int colorId) {
        if (!configured || dx < 0 || dx >= width || dz < 0 || dz >= height) return;
        grid[dz * width + dx] = (byte) colorId;
        Material mat = COLOR_MATERIALS[colorId & 0x07];
        Bukkit.getScheduler().runTask(plugin, () -> {
            Block block = world.getBlockAt(cornerX + dx, cornerY, cornerZ + dz);
            if (block.getType() != mat) block.setType(mat, false);
        });
    }

    /**
     * Met à jour un pixel depuis les coordonnées grille (0-2047).
     * Utilisé par les événements socket pixel:update.
     */
    public void setPixelFromGrid(int gridX, int gridY, int colorId) {
        setPixelLocal(gridX - offsetX, gridY - offsetZ, colorId);
    }

    /**
     * Charge la fenêtre de la grille depuis le JSONArray renvoyé par grid:init (socket).
     * Le tableau contient toute la grille GRID_SIZE×GRID_SIZE — on extrait la fenêtre.
     */
    public void initGrid(JSONArray gridData) {
        if (!configured) return;
        Bukkit.getScheduler().runTask(plugin, () -> {
            for (int dz = 0; dz < height; dz++) {
                for (int dx = 0; dx < width; dx++) {
                    int serverIdx = (offsetZ + dz) * GRID_SIZE + (offsetX + dx);
                    int colorId   = serverIdx < gridData.length() ? gridData.optInt(serverIdx, 0) : 0;
                    grid[dz * width + dx] = (byte) colorId;
                    world.getBlockAt(cornerX + dx, cornerY, cornerZ + dz)
                         .setType(COLOR_MATERIALS[colorId & 0x07], false);
                }
            }
            plugin.getLogger().info("[Canvas] " + (width * height) + " blocs dessinés.");
        });
    }

    /**
     * Charge la fenêtre depuis le JSONArray renvoyé par /api/grid/window.
     * Les blocs sont posés par lots (ROWS_PER_TICK lignes/tick) pour éviter le lag.
     */
    public void initGridWindow(JSONArray windowData) {
        if (!configured) return;
        final int ROWS_PER_TICK = 2; // ~width*2 blocs/tick, ajuster selon les perfs
        final int[] currentRow  = {0};

        new BukkitRunnable() {
            @Override
            public void run() {
                int endRow = Math.min(currentRow[0] + ROWS_PER_TICK, height);
                for (int dz = currentRow[0]; dz < endRow; dz++) {
                    for (int dx = 0; dx < width; dx++) {
                        int idx     = dz * width + dx;
                        int colorId = idx < windowData.length() ? windowData.optInt(idx, 0) : 0;
                        grid[idx]   = (byte) colorId;
                        world.getBlockAt(cornerX + dx, cornerY, cornerZ + dz)
                             .setType(COLOR_MATERIALS[colorId & 0x07], false);
                    }
                }
                currentRow[0] = endRow;

                if (currentRow[0] >= height) {
                    plugin.getLogger().info("[Canvas] " + (width * height) + " blocs dessinés.");
                    cancel();
                } else if (currentRow[0] % 128 == 0) {
                    plugin.getLogger().info("[Canvas] " + currentRow[0] + "/" + height + " lignes...");
                }
            }
        }.runTaskTimer(plugin, 0L, 1L);
    }

    /** Retourne les coordonnées canvas {x, y} si le bloc est sur le canvas, sinon null */
    public int[] getCanvasCoords(Block block) {
        if (!configured) return null;
        if (block.getY() != cornerY) return null;
        int px = block.getX() - cornerX;
        int py = block.getZ() - cornerZ;
        if (px < 0 || px >= width || py < 0 || py >= height) return null;
        return new int[]{px, py};
    }

    /** Retourne le colorId actuellement en cache pour ce pixel */
    public int getColorAt(int x, int y) {
        if (x < 0 || x >= width || y < 0 || y >= height) return 0;
        return grid[y * width + x] & 0xFF;
    }

    /** Retourne le colorId correspondant à un Material, ou -1 si hors palette */
    public int materialToColorId(Material mat) {
        return MATERIAL_TO_COLOR.getOrDefault(mat, -1);
    }

    /** Recharge la configuration depuis config.yml (appelé par /vp reload). */
    public void reload() {
        loadFromConfig();
    }

    /** Définit le décalage de la fenêtre dans l'espace grille 0-2047 et sauvegarde. */
    public void setOffset(int ox, int oz) {
        offsetX = Math.max(0, Math.min(GRID_SIZE - width,  ox));
        offsetZ = Math.max(0, Math.min(GRID_SIZE - height, oz));
        var cfg = plugin.getConfig();
        cfg.set("canvas.offsetX", offsetX);
        cfg.set("canvas.offsetZ", offsetZ);
        plugin.saveConfig();
    }

    /** Convertit des coords locales (dx,dz) en coordonnées mathématiques (-1024 à +1023). */
    public int[] localToMath(int dx, int dz) {
        return new int[]{ offsetX + dx - GRID_HALF, offsetZ + dz - GRID_HALF };
    }

    /** Convertit des coords locales (dx,dz) en coordonnées grille (0-2047). */
    public int[] localToGrid(int dx, int dz) {
        return new int[]{ offsetX + dx, offsetZ + dz };
    }

    public boolean isConfigured() { return configured; }
    public int getWidth()         { return width; }
    public int getHeight()        { return height; }
    public int getCornerX()       { return cornerX; }
    public int getCornerY()       { return cornerY; }
    public int getCornerZ()       { return cornerZ; }
    public int getOffsetX()       { return offsetX; }
    public int getOffsetZ()       { return offsetZ; }
}
