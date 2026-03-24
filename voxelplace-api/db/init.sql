-- Schéma VoxelPlace
-- Redis : grille de pixels et temps réel
-- PostgreSQL : comptes utilisateurs + historique complet des pixels

-- ── Comptes utilisateurs ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(32) UNIQUE NOT NULL,
    password_hash VARCHAR(72) NOT NULL,
    source        VARCHAR(20) NOT NULL DEFAULT 'web',
    created_at    TIMESTAMP NOT NULL DEFAULT NOW()
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
