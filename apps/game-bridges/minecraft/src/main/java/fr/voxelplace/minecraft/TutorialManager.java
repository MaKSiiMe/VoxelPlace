package fr.voxelplace.minecraft;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextDecoration;
import org.bukkit.Material;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.inventory.ItemStack;
import org.bukkit.scheduler.BukkitRunnable;

import java.io.File;
import java.io.IOException;
import java.util.List;
import java.util.UUID;

public class TutorialManager implements Listener {

    private final VoxelPlacePlugin plugin;

    // Palette dans le même ordre que CanvasManager.COLOR_MATERIALS (IDs 0-15)
    private static final Material[] PALETTE = CanvasManager.COLOR_MATERIALS;

    private final File dataFile;
    private final YamlConfiguration data;

    public TutorialManager(VoxelPlacePlugin plugin) {
        this.plugin   = plugin;
        this.dataFile = new File(plugin.getDataFolder(), "tutorial_seen.yml");
        this.data     = YamlConfiguration.loadConfiguration(dataFile);
    }

    // ── Event ────────────────────────────────────────────────────────────────

    @EventHandler
    public void onPlayerJoin(PlayerJoinEvent event) {
        Player player = event.getPlayer();
        if (hasSeenTutorial(player)) return;

        // Petit délai pour laisser le temps au joueur de charger le monde
        new BukkitRunnable() {
            @Override public void run() {
                startTutorial(player);
            }
        }.runTaskLater(plugin, 40L); // 2 secondes
    }

    // ── Public API ───────────────────────────────────────────────────────────

    public void startTutorial(Player player) {
        List<Runnable> steps = List.of(
            () -> sendHeader(player),
            () -> sendLine(player, "§eBienvenue sur §6VoxelPlace§e !", NamedTextColor.YELLOW),
            () -> sendLine(player, "Ce serveur est connecté en temps réel à notre site web.", NamedTextColor.GRAY),
            () -> sendLine(player, "Chaque bloc que tu poses ici apparaît instantanément sur le canvas du site.", NamedTextColor.GRAY),
            () -> sendLine(player, "▶ §fClic droit§7 sur le canvas pour peindre un pixel.", NamedTextColor.GRAY),
            () -> sendLine(player, "▶ Utilise les §fblocs en béton coloré§7 comme palette.", NamedTextColor.GRAY),
            () -> sendLine(player, "▶ Tape §e/vp help§7 pour voir toutes les commandes.", NamedTextColor.GRAY),
            () -> {
                givePalette(player);
                sendLine(player, "§a✔ Palette offerte !§7 Regarde dans ton inventaire.", NamedTextColor.GREEN);
            },
            () -> sendFooter(player)
        );

        for (int i = 0; i < steps.size(); i++) {
            final Runnable step = steps.get(i);
            new BukkitRunnable() {
                @Override public void run() { step.run(); }
            }.runTaskLater(plugin, i * 30L); // 1,5s entre chaque ligne
        }

        markSeen(player);
    }

    // ── Helpers visuels ──────────────────────────────────────────────────────

    private void sendHeader(Player player) {
        player.sendMessage(Component.text(
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
            NamedTextColor.GOLD, TextDecoration.BOLD));
        player.sendMessage(Component.text()
            .append(Component.text("     ◆ ", NamedTextColor.GOLD))
            .append(Component.text("VOXELPLACE", NamedTextColor.WHITE, TextDecoration.BOLD))
            .append(Component.text(" — Canvas collaboratif ◆", NamedTextColor.GOLD))
            .build());
        player.sendMessage(Component.text(
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
            NamedTextColor.GOLD, TextDecoration.BOLD));
    }

    private void sendFooter(Player player) {
        player.sendMessage(Component.text(
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
            NamedTextColor.GOLD));
        player.sendMessage(Component.text()
            .append(Component.text("[VoxelPlace] ", NamedTextColor.GOLD))
            .append(Component.text("Bonne création, ", NamedTextColor.GRAY))
            .append(Component.text(player.getName(), NamedTextColor.WHITE))
            .append(Component.text(" !", NamedTextColor.GRAY))
            .build());
        player.sendMessage(Component.text(
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
            NamedTextColor.GOLD));
        player.sendActionBar(Component.text("Bienvenue sur VoxelPlace ! Tape /vp help pour commencer.", NamedTextColor.GOLD));
    }

    private void sendLine(Player player, String legacy, NamedTextColor fallback) {
        player.sendMessage(Component.text()
            .append(Component.text("[VoxelPlace] ", NamedTextColor.GOLD))
            .append(Component.text(legacy))
            .build());
    }

    // ── Palette ──────────────────────────────────────────────────────────────

    private void givePalette(Player player) {
        for (Material mat : PALETTE) {
            ItemStack stack = new ItemStack(mat, 16);
            player.getInventory().addItem(stack);
        }
    }

    // ── Persistance ─────────────────────────────────────────────────────────

    private boolean hasSeenTutorial(Player player) {
        return data.getBoolean("seen." + player.getUniqueId().toString(), false);
    }

    private void markSeen(Player player) {
        data.set("seen." + player.getUniqueId().toString(), true);
        try {
            data.save(dataFile);
        } catch (IOException e) {
            plugin.getLogger().warning("Impossible de sauvegarder tutorial_seen.yml : " + e.getMessage());
        }
    }

    public void resetTutorial(Player player) {
        data.set("seen." + player.getUniqueId().toString(), false);
        try {
            data.save(dataFile);
        } catch (IOException e) {
            plugin.getLogger().warning("Impossible de sauvegarder tutorial_seen.yml : " + e.getMessage());
        }
    }
}
