package fr.voxelplace.minecraft;

import org.bukkit.plugin.java.JavaPlugin;

public class VoxelPlacePlugin extends JavaPlugin {

    private CanvasManager   canvasManager;
    private SocketManager   socketManager;
    private TutorialManager tutorialManager;

    @Override
    public void onEnable() {
        saveDefaultConfig();

        canvasManager   = new CanvasManager(this);
        socketManager   = new SocketManager(this, canvasManager);
        tutorialManager = new TutorialManager(this);

        getServer().getPluginManager().registerEvents(
            new CanvasListener(this, canvasManager, socketManager), this
        );
        getServer().getPluginManager().registerEvents(tutorialManager, this);

        var cmd = getCommand("vp");
        if (cmd != null) {
            var executor = new VoxelCommand(this, canvasManager, socketManager, tutorialManager);
            cmd.setExecutor(executor);
            cmd.setTabCompleter(executor);
        }

        socketManager.connect();
        getLogger().info("VoxelPlace activé — canvas " + canvasManager.getWidth() + "×" + canvasManager.getHeight());
    }

    @Override
    public void onDisable() {
        if (socketManager != null) socketManager.disconnect();
        getLogger().info("VoxelPlace désactivé.");
    }
}
