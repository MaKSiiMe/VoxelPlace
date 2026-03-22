package fr.voxelplace.minecraft;

import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.World;
import org.bukkit.block.Block;
import org.json.JSONArray;

import java.util.HashMap;
import java.util.Map;

public class CanvasManager {

    private final VoxelPlacePlugin plugin;

    private World  world;
    private int    cornerX, cornerY, cornerZ;
    private int    width, height;
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
        width    = Math.min(cfg.getInt("canvas.width",  16), 64);
        height   = Math.min(cfg.getInt("canvas.height", 16), 64);
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
        cfg.set("canvas.world", world.getName());
        cfg.set("canvas.x", cornerX);
        cfg.set("canvas.y", cornerY);
        cfg.set("canvas.z", cornerZ);
        plugin.saveConfig();
    }

    /**
     * Met à jour un pixel dans le cache ET dans le monde (thread-safe).
     * Peut être appelé depuis n'importe quel thread.
     */
    public void setPixel(int x, int y, int colorId) {
        if (!configured || x < 0 || x >= width || y < 0 || y >= height) return;
        grid[y * width + x] = (byte) colorId;
        Material mat = COLOR_MATERIALS[colorId & 0x07];
        Bukkit.getScheduler().runTask(plugin, () -> {
            Block block = world.getBlockAt(cornerX + x, cornerY, cornerZ + y);
            if (block.getType() != mat) block.setType(mat, false);
        });
    }

    /**
     * Charge toute la grille depuis le JSONArray renvoyé par grid:init.
     * La grille serveur est toujours 64 colonnes ; on prend les width×height
     * premiers pixels (coin haut-gauche).
     */
    public void initGrid(JSONArray gridData) {
        if (!configured) return;
        Bukkit.getScheduler().runTask(plugin, () -> {
            for (int py = 0; py < height; py++) {
                for (int px = 0; px < width; px++) {
                    int serverIdx = py * 64 + px;  // grille serveur = 64 colonnes
                    int colorId   = serverIdx < gridData.length() ? gridData.optInt(serverIdx, 0) : 0;
                    grid[py * width + px] = (byte) colorId;
                    world.getBlockAt(cornerX + px, cornerY, cornerZ + py)
                         .setType(COLOR_MATERIALS[colorId & 0x07], false);
                }
            }
            plugin.getLogger().info("[Canvas] " + (width * height) + " blocs dessinés.");
        });
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

    public boolean isConfigured() { return configured; }
    public int getWidth()         { return width; }
    public int getHeight()        { return height; }
    public int getCornerX()       { return cornerX; }
    public int getCornerY()       { return cornerY; }
    public int getCornerZ()       { return cornerZ; }
}
