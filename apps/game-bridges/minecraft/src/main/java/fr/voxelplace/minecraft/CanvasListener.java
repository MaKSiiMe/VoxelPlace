package fr.voxelplace.minecraft;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextColor;
import org.bukkit.block.Block;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.event.block.BlockPlaceEvent;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.event.player.PlayerMoveEvent;
import org.bukkit.inventory.ItemStack;
import org.bukkit.event.block.Action;

public class CanvasListener implements Listener {

    private final VoxelPlacePlugin plugin;
    private final CanvasManager    canvasManager;
    private final SocketManager    socketManager;

    private static final String[] COLOR_NAMES = {
        "Blanc",      "Gris clair", "Gris",    "Noir",
        "Marron",     "Rouge",      "Orange",  "Jaune",
        "Vert clair", "Vert",       "Cyan",    "Bleu clair",
        "Bleu",       "Violet",     "Magenta", "Rose",
    };

    private static final TextColor[] COLOR_CHAT = {
        TextColor.color(0xFFFFFF), // 0  blanc
        TextColor.color(0xAAAAAA), // 1  gris clair
        TextColor.color(0x888888), // 2  gris
        TextColor.color(0x000000), // 3  noir
        TextColor.color(0x884422), // 4  marron
        TextColor.color(0xFF4444), // 5  rouge
        TextColor.color(0xFF8800), // 6  orange
        TextColor.color(0xFFFF00), // 7  jaune
        TextColor.color(0x88CC22), // 8  vert clair
        TextColor.color(0x00AA00), // 9  vert
        TextColor.color(0x00AAAA), // 10 cyan
        TextColor.color(0x44AAFF), // 11 bleu clair
        TextColor.color(0x4444FF), // 12 bleu
        TextColor.color(0xAA00AA), // 13 violet
        TextColor.color(0xFF44FF), // 14 magenta
        TextColor.color(0xFF88AA), // 15 rose
    };

    public CanvasListener(VoxelPlacePlugin plugin, CanvasManager cm, SocketManager sm) {
        this.plugin        = plugin;
        this.canvasManager = cm;
        this.socketManager = sm;
    }

    // ── Clic droit sur le canvas (remplace n'importe quel bloc) ─────────────

    @EventHandler(priority = EventPriority.HIGH)
    public void onPlayerInteract(PlayerInteractEvent event) {
        if (event.getAction() != Action.RIGHT_CLICK_BLOCK) return;

        Block clicked = event.getClickedBlock();
        if (clicked == null) return;

        int[] coords = canvasManager.getCanvasCoords(clicked);
        if (coords == null) return;

        // Annuler l'interaction (empêche de poser un bloc par-dessus)
        event.setCancelled(true);

        ItemStack item = event.getItem();
        if (item == null) return;
        int colorId = canvasManager.materialToColorId(item.getType());

        if (colorId < 0) {
            event.getPlayer().sendMessage(Component.text()
                .append(prefix())
                .append(Component.text("Ce bloc n'est pas dans la palette VoxelPlace !", NamedTextColor.RED))
                .build());
            sendPaletteHint(event.getPlayer());
            return;
        }

        if (!socketManager.isConnected()) {
            event.getPlayer().sendMessage(Component.text()
                .append(prefix())
                .append(Component.text("Non connecté au serveur VoxelPlace.", NamedTextColor.RED))
                .build());
            return;
        }

        int dx = coords[0];
        int dz = coords[1];
        String username = event.getPlayer().getName();

        // Mise à jour optimiste immédiate (coords locales)
        int prevColorId = canvasManager.getColorAt(dx, dz);
        canvasManager.setPixelLocal(dx, dz, colorId);

        // Emission en coords grille (0-2047)
        int[] grid = canvasManager.localToGrid(dx, dz);
        socketManager.emitPixelPlace(grid[0], grid[1], colorId, username, ack -> {
            if (ack != null && ack.has("error")) {
                String err = ack.optString("error", "Erreur inconnue");
                canvasManager.setPixelLocal(dx, dz, prevColorId);
                event.getPlayer().sendMessage(Component.text()
                    .append(prefix())
                    .append(Component.text(err, NamedTextColor.RED))
                    .build());
            }
        });
    }

    // ── Empêcher la pose de blocs sur le canvas ──────────────────────────────

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onBlockPlace(BlockPlaceEvent event) {
        if (canvasManager.getCanvasCoords(event.getBlockPlaced()) != null)
            event.setCancelled(true);
    }

    // ── Empêcher la destruction des blocs du canvas ──────────────────────────

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onBlockBreak(BlockBreakEvent event) {
        int[] coords = canvasManager.getCanvasCoords(event.getBlock());
        if (coords == null) return;

        event.setCancelled(true);
        event.getPlayer().sendMessage(Component.text()
            .append(prefix())
            .append(Component.text("Faites un clic droit avec un bloc coloré pour changer ce pixel.", NamedTextColor.YELLOW))
            .build());
    }

    // ── Action bar quand le joueur marche sur le canvas ──────────────────────

    @EventHandler
    public void onPlayerMove(PlayerMoveEvent event) {
        // Ne fire que lors d'un changement de bloc (pas chaque tick)
        if (event.getFrom().getBlockX() == event.getTo().getBlockX()
            && event.getFrom().getBlockZ() == event.getTo().getBlockZ()
            && event.getFrom().getBlockY() == event.getTo().getBlockY()) return;

        if (!canvasManager.isConfigured()) return;

        var loc   = event.getTo();
        var world = loc.getWorld();
        if (world == null) return;

        // Bloc sous les pieds du joueur
        var below  = world.getBlockAt(loc.getBlockX(), loc.getBlockY() - 1, loc.getBlockZ());
        int[] coords = canvasManager.getCanvasCoords(below);
        if (coords == null) return;

        int dx      = coords[0];
        int dz      = coords[1];
        int colorId = canvasManager.getColorAt(dx, dz) & 0x0F;

        int[] math = canvasManager.localToMath(dx, dz);
        var bar = Component.text()
            .append(Component.text("(" + math[0] + ", " + math[1] + ")", NamedTextColor.WHITE))
            .append(Component.text("  ■  ", COLOR_CHAT[colorId]))
            .append(Component.text(COLOR_NAMES[colorId], COLOR_CHAT[colorId]))
            .build();

        event.getPlayer().sendActionBar(bar);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private Component prefix() {
        return Component.text("[VoxelPlace] ", NamedTextColor.GOLD);
    }

    private void sendPaletteHint(org.bukkit.entity.Player player) {
        player.sendMessage(Component.text()
            .append(prefix())
            .append(Component.text("Palette : blanc, noir, rouge, vert, bleu, jaune, orange, violet", NamedTextColor.GRAY))
            .append(Component.text(" (béton ou laine)", NamedTextColor.DARK_GRAY))
            .build());
    }
}
