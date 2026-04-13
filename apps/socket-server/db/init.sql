-- Schéma VoxelPlace
-- Redis : grille de pixels et temps réel
-- PostgreSQL : comptes utilisateurs + historique complet des pixels

-- ── Comptes utilisateurs ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(32) UNIQUE NOT NULL,
    password_hash   VARCHAR(72) NOT NULL,
    source          VARCHAR(20) NOT NULL DEFAULT 'web',
    role            VARCHAR(20) NOT NULL DEFAULT 'user',  -- user | superuser | admin | superadmin
    streak_hours    INT       NOT NULL DEFAULT 0,
    last_pixel_hour TIMESTAMP,
    last_pixel_at   TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users (LOWER(username));

-- ── Historique des pixels (append-only) ──────────────────────────────────────
-- Chaque pose de pixel = une ligne. Permet heatmap, timelapse, stats, git-blame pixel.
CREATE TABLE IF NOT EXISTS pixel_history (
    id         BIGSERIAL PRIMARY KEY,
    x          SMALLINT NOT NULL,
    y          SMALLINT NOT NULL,
    color_id   SMALLINT NOT NULL,
    username   VARCHAR(32),
    source     VARCHAR(20),
    placed_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ph_coords    ON pixel_history (x, y);
CREATE INDEX IF NOT EXISTS idx_ph_placed_at ON pixel_history (placed_at);
CREATE INDEX IF NOT EXISTS idx_ph_username  ON pixel_history (username);

-- ── Zones partagées ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shared_zones (
    id         CHAR(8)  PRIMARY KEY,         -- identifiant court ex: "a3f9b2c1"
    x          SMALLINT NOT NULL,
    y          SMALLINT NOT NULL,
    w          SMALLINT NOT NULL,
    h          SMALLINT NOT NULL,
    label      VARCHAR(64),                  -- nom optionnel donné par l'utilisateur
    created_by VARCHAR(32),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP                     -- NULL = permanent
);

CREATE INDEX IF NOT EXISTS idx_sz_created_at ON shared_zones (created_at);

-- ── Bans ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bans (
    username   VARCHAR(32) PRIMARY KEY,
    reason     VARCHAR(256),
    banned_by  VARCHAR(32),
    banned_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP                     -- NULL = permanent
);

-- ── Logs de modération ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS moderation_logs (
    id         SERIAL PRIMARY KEY,
    action     VARCHAR(16) NOT NULL,         -- 'ban' | 'unban' | 'clear_pixel' | 'clear_all'
    target     VARCHAR(32),                  -- username concerné (NULL pour clear_all)
    admin      VARCHAR(32) NOT NULL,
    reason     VARCHAR(256),
    metadata   JSONB,                        -- infos supplémentaires (ex: coordonnées pixel)
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Signalements ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
    id              SERIAL PRIMARY KEY,
    reporter        VARCHAR(32),                          -- NULL = anonyme
    target_type     VARCHAR(10) NOT NULL,                 -- 'pixel' | 'player'
    target_username VARCHAR(32),                          -- joueur signalé
    x               SMALLINT,                             -- coordonnées (si pixel)
    y               SMALLINT,
    reason          VARCHAR(256),
    status          VARCHAR(10) NOT NULL DEFAULT 'pending', -- 'pending' | 'reviewed'
    reviewed_by     VARCHAR(32),
    reviewed_at     TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports (status);

-- ── Stats joueur ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_stats (
    username           VARCHAR(32) PRIMARY KEY,
    pixels_placed      INT  NOT NULL DEFAULT 0,
    pixels_lost        INT  NOT NULL DEFAULT 0,
    pixels_overwritten INT  NOT NULL DEFAULT 0,
    zones_visited      JSONB NOT NULL DEFAULT '[]',
    days_played        JSONB NOT NULL DEFAULT '[]'
);

-- ── Compteurs de couleurs par joueur ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_color_counts (
    username  VARCHAR(32) NOT NULL,
    color_id  SMALLINT    NOT NULL,
    count     INT         NOT NULL DEFAULT 0,
    PRIMARY KEY (username, color_id)
);

-- ── Nœuds débloqués (skill tree) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_unlocks (
    username    VARCHAR(32) NOT NULL,
    node_id     VARCHAR(64) NOT NULL,
    unlocked_at TIMESTAMP   NOT NULL DEFAULT NOW(),
    PRIMARY KEY (username, node_id)
);

-- ── Messages de pixel chat ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pixel_messages (
    id         SERIAL PRIMARY KEY,
    x          INT NOT NULL,
    y          INT NOT NULL,
    username   VARCHAR(32),
    message    VARCHAR(500) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pixel_messages_xy ON pixel_messages (x, y);
