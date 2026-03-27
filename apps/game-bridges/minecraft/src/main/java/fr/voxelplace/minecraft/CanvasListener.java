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
        "Blanc", "Noir", "Rouge", "Vert", "Bleu", "Jaune", "Orange", "Violet"
    };

    private static final TextColor[] COLOR_CHAT = {
        TextColor.color(0xFFFFFF), // blanc
        TextColor.color(0x555555), // noir
        TextColor.color(0xB02E26), // rouge
        TextColor.color(0x5E7C16), // vert
        TextColor.color(0x3C44AA), // bleu
        TextColor.color(0xFED83D), // jaune
        TextColor.color(0xF9801D), // orange
        TextColor.color(0x8932B8), // violet
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

        int px = coords[0];
        int py = coords[1];
        String username = event.getPlayer().getName();

        // Mise à jour optimiste immédiate
        int prevColorId = canvasManager.getColorAt(px, py);
        canvasManager.setPixel(px, py, colorId);

        socketManager.emitPixelPlace(px, py, colorId, username, ack -> {
            if (ack != null && ack.has("error")) {
                String err = ack.optString("error", "Erreur inconnue");
                canvasManager.setPixel(px, py, prevColorId);
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

        int px      = coords[0];
        int py      = coords[1];
        int colorId = canvasManager.getColorAt(px, py) & 0x07;

        var bar = Component.text()
            .append(Component.text("(" + px + ", " + py + ")", NamedTextColor.WHITE))
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
