package fr.voxelplace.minecraft;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabCompleter;
import org.bukkit.entity.Player;

import java.util.List;

public class VoxelCommand implements CommandExecutor, TabCompleter {

    private final VoxelPlacePlugin plugin;
    private final CanvasManager    canvasManager;
    private final SocketManager    socketManager;

    public VoxelCommand(VoxelPlacePlugin plugin, CanvasManager cm, SocketManager sm) {
        this.plugin        = plugin;
        this.canvasManager = cm;
        this.socketManager = sm;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (args.length == 0) { sendHelp(sender); return true; }

        switch (args[0].toLowerCase()) {
            case "setup"  -> cmdSetup(sender);
            case "offset" -> cmdOffset(sender, args);
            case "fill"   -> cmdFill(sender);
            case "reload" -> cmdReload(sender);
            case "info"   -> cmdInfo(sender);
            case "help"   -> sendHelp(sender);
            default       -> sendHelp(sender);
        }
        return true;
    }

    // ── Sous-commandes ──────────────────────────────────────────────────────

    private void cmdSetup(CommandSender sender) {
        if (!(sender instanceof Player player)) {
            sender.sendMessage("Cette commande est réservée aux joueurs en jeu.");
            return;
        }
        var loc = player.getLocation();
        canvasManager.setCorner(loc);

        player.sendMessage(Component.text()
            .append(prefix())
            .append(Component.text("Canvas défini en (", NamedTextColor.GREEN))
            .append(Component.text(loc.getBlockX() + ", " + loc.getBlockY() + ", " + loc.getBlockZ(), NamedTextColor.WHITE))
            .append(Component.text(")  —  taille ", NamedTextColor.GREEN))
            .append(Component.text(canvasManager.getWidth() + "×" + canvasManager.getHeight(), NamedTextColor.WHITE))
            .build());

        player.sendMessage(Component.text()
            .append(prefix())
            .append(Component.text("Faites ", NamedTextColor.GRAY))
            .append(Component.text("/vp fill", NamedTextColor.YELLOW))
            .append(Component.text(" pour charger la grille depuis le serveur.", NamedTextColor.GRAY))
            .build());
    }

    private void cmdOffset(CommandSender sender, String[] args) {
        if (!sender.isOp()) {
            sender.sendMessage(Component.text().append(prefix())
                .append(Component.text("Permission insuffisante.", NamedTextColor.RED)).build());
            return;
        }
        if (args.length < 3) {
            sender.sendMessage(Component.text().append(prefix())
                .append(Component.text("Usage : /vp offset <x> <z>  (coords grille 0-2047)", NamedTextColor.YELLOW)).build());
            return;
        }
        try {
            int ox = Integer.parseInt(args[1]);
            int oz = Integer.parseInt(args[2]);
            canvasManager.setOffset(ox, oz);
            sender.sendMessage(Component.text().append(prefix())
                .append(Component.text("Offset défini : grille (" + canvasManager.getOffsetX() + ", " + canvasManager.getOffsetZ() + ")  →  math ("
                    + (canvasManager.getOffsetX() - 1024) + ", " + (canvasManager.getOffsetZ() - 1024) + ")", NamedTextColor.GREEN)).build());
            sender.sendMessage(Component.text().append(prefix())
                .append(Component.text("Faites /vp fill pour redessiner.", NamedTextColor.GRAY)).build());
        } catch (NumberFormatException e) {
            sender.sendMessage(Component.text().append(prefix())
                .append(Component.text("Valeurs invalides.", NamedTextColor.RED)).build());
        }
    }

    private void cmdFill(CommandSender sender) {
        if (!canvasManager.isConfigured()) {
            sender.sendMessage(Component.text()
                .append(prefix())
                .append(Component.text("Canvas non configuré. Faites /vp setup d'abord.", NamedTextColor.RED))
                .build());
            return;
        }
        if (!socketManager.isConnected()) {
            sender.sendMessage(Component.text()
                .append(prefix())
                .append(Component.text("Non connecté au serveur VoxelPlace.", NamedTextColor.RED))
                .build());
            return;
        }
        socketManager.requestGridRefresh();
        sender.sendMessage(Component.text()
            .append(prefix())
            .append(Component.text("Rechargement de la grille en cours…", NamedTextColor.GREEN))
            .build());
    }

    private void cmdReload(CommandSender sender) {
        sender.sendMessage(Component.text()
            .append(prefix())
            .append(Component.text("Reconnexion au serveur…", NamedTextColor.YELLOW))
            .build());
        socketManager.disconnect();
        plugin.reloadConfig();
        canvasManager.reload();
        socketManager.connect();
    }

    private void cmdInfo(CommandSender sender) {
        boolean conn = socketManager.isConnected();
        boolean cfg  = canvasManager.isConfigured();

        sender.sendMessage(Component.text()
            .append(prefix())
            .append(Component.text("Connexion : ", NamedTextColor.GRAY))
            .append(Component.text(conn ? "✔ connecté" : "✘ déconnecté",
                conn ? NamedTextColor.GREEN : NamedTextColor.RED))
            .build());

        sender.sendMessage(Component.text()
            .append(prefix())
            .append(Component.text("Canvas : ", NamedTextColor.GRAY))
            .append(Component.text(cfg ? "✔ configuré" : "✘ non configuré",
                cfg ? NamedTextColor.GREEN : NamedTextColor.RED))
            .build());

        if (cfg) {
            sender.sendMessage(Component.text()
                .append(prefix())
                .append(Component.text("Taille : " + canvasManager.getWidth() + "×" + canvasManager.getHeight()
                    + "  coin (" + canvasManager.getCornerX() + ", "
                    + canvasManager.getCornerY() + ", " + canvasManager.getCornerZ() + ")", NamedTextColor.GRAY))
                .build());
            sender.sendMessage(Component.text()
                .append(prefix())
                .append(Component.text("Offset grille : (" + canvasManager.getOffsetX() + ", " + canvasManager.getOffsetZ() + ")"
                    + "  →  math (" + (canvasManager.getOffsetX() - 1024) + ", " + (canvasManager.getOffsetZ() - 1024) + ")", NamedTextColor.GRAY))
                .build());
        }
    }

    private void sendHelp(CommandSender sender) {
        sender.sendMessage(Component.text("─── VoxelPlace ──────────────────────", NamedTextColor.GOLD));
        sender.sendMessage(Component.text("  Commandes joueur", NamedTextColor.YELLOW));
        sender.sendMessage(help("/vp help", "Affiche cette aide"));
        sender.sendMessage(help("/vp info", "État de la connexion et du canvas"));

        if (sender.isOp()) {
            sender.sendMessage(Component.text("  Commandes admin (OP)", NamedTextColor.RED));
            sender.sendMessage(help("/vp setup",          "Définit le coin du canvas à ta position"));
            sender.sendMessage(help("/vp offset <x> <z>", "Déplace la fenêtre dans la grille 2048×2048"));
            sender.sendMessage(help("/vp fill",           "Redessine le canvas depuis le serveur"));
            sender.sendMessage(help("/vp reload",         "Reconnecte au serveur VoxelPlace"));
        }
        sender.sendMessage(Component.text("─────────────────────────────────────", NamedTextColor.GOLD));
    }

    private Component help(String cmd, String desc) {
        return Component.text()
            .append(Component.text("  " + cmd, NamedTextColor.YELLOW))
            .append(Component.text(" — " + desc, NamedTextColor.GRAY))
            .build();
    }

    private Component prefix() {
        return Component.text("[VoxelPlace] ", NamedTextColor.GOLD);
    }

    @Override
    public List<String> onTabComplete(CommandSender sender, Command command, String alias, String[] args) {
        if (args.length == 1) {
            return List.of("help", "info", "setup", "offset", "fill", "reload").stream()
                .filter(s -> s.startsWith(args[0].toLowerCase()))
                .toList();
        }
        return List.of();
    }
}
