package fr.voxelplace.minecraft;

import io.socket.client.IO;
import io.socket.client.Socket;
import org.bukkit.Bukkit;
import org.json.JSONArray;
import org.json.JSONObject;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public class SocketManager {

    private final VoxelPlacePlugin plugin;
    private final CanvasManager    canvasManager;

    private Socket  socket;
    private boolean connected = false;
    private String  serverUrl;

    public SocketManager(VoxelPlacePlugin plugin, CanvasManager canvasManager) {
        this.plugin        = plugin;
        this.canvasManager = canvasManager;
    }

    // ── Connexion ───────────────────────────────────────────────────────────

    public void connect() {
        serverUrl = plugin.getConfig().getString("server-url", "http://localhost:3001");
        try {
            IO.Options opts = IO.Options.builder()
                .setReconnection(true)
                .setReconnectionDelay(3000)
                .setReconnectionAttempts(Integer.MAX_VALUE)
                .build();

            socket = IO.socket(URI.create(serverUrl), opts);

            socket.on(Socket.EVENT_CONNECT, args -> {
                connected = true;
                plugin.getLogger().info("[Socket] Connecté à " + serverUrl);
                try {
                    JSONObject joinData = new JSONObject();
                    joinData.put("username", "MC-Server");
                    joinData.put("source", "minecraft");
                    socket.emit("player:join", joinData);
                } catch (Exception ignored) {}
            });

            socket.on(Socket.EVENT_DISCONNECT, args ->  {
                connected = false;
                plugin.getLogger().warning("[Socket] Déconnecté du serveur VoxelPlace.");
            });

            socket.on(Socket.EVENT_CONNECT_ERROR, args -> {
                String msg = args.length > 0 ? args[0].toString() : "inconnue";
                plugin.getLogger().warning("[Socket] Erreur de connexion : " + msg);
            });

            // Grille complète à la connexion
            socket.on("grid:init", args -> {
                try {
                    JSONObject data = (JSONObject) args[0];
                    canvasManager.initGrid(data.getJSONArray("grid"));
                } catch (Exception e) {
                    plugin.getLogger().severe("[Socket] grid:init : " + e.getMessage());
                }
            });

            // Mise à jour d'un pixel (broadcast de tous les clients)
            socket.on("pixel:update", args -> {
                try {
                    JSONObject data = (JSONObject) args[0];
                    canvasManager.setPixel(data.getInt("x"), data.getInt("y"), data.getInt("colorId"));
                } catch (Exception e) {
                    plugin.getLogger().warning("[Socket] pixel:update : " + e.getMessage());
                }
            });

            socket.connect();

        } catch (Exception e) {
            plugin.getLogger().severe("[Socket] Impossible de se connecter : " + e.getMessage());
        }
    }

    public void disconnect() {
        if (socket != null) {
            socket.disconnect();
            socket.off();
        }
        connected = false;
    }

    // ── Émission pixel:place ────────────────────────────────────────────────

    public void emitPixelPlace(int x, int y, int colorId, String username, AckCallback callback) {
        if (!connected) {
            if (callback != null) callback.onAck(null);
            return;
        }
        JSONObject data;
        try {
            data = new JSONObject();
            data.put("x",        x);
            data.put("y",        y);
            data.put("colorId",  colorId);
            data.put("username", username);
            data.put("source",   "minecraft");
        } catch (Exception e) {
            plugin.getLogger().warning("[Socket] Erreur construction JSON : " + e.getMessage());
            return;
        }

        socket.emit("pixel:place", new Object[]{data}, ackArgs -> {
            if (callback == null) return;
            JSONObject ack = (ackArgs != null && ackArgs.length > 0 && ackArgs[0] instanceof JSONObject j)
                ? j : null;
            callback.onAck(ack);
        });
    }

    // ── Rechargement via REST ───────────────────────────────────────────────

    /** Recharge la grille complète depuis l'API REST (utilisé par /vp fill) */
    public void requestGridRefresh() {
        String url = serverUrl + "/api/grid";
        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> {
            try {
                HttpClient client = HttpClient.newHttpClient();
                HttpRequest req   = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(java.time.Duration.ofSeconds(5))
                    .build();
                HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
                JSONObject data = new JSONObject(resp.body());
                canvasManager.initGrid(data.getJSONArray("grid"));
            } catch (Exception e) {
                plugin.getLogger().severe("[API] Erreur rechargement grille : " + e.getMessage());
            }
        });
    }

    // ── Getters ─────────────────────────────────────────────────────────────

    public boolean isConnected() { return connected; }

    @FunctionalInterface
    public interface AckCallback {
        void onAck(JSONObject ack);
    }
}
