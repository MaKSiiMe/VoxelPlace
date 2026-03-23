-- Schéma VoxelPlace — comptes utilisateurs
-- Redis reste responsable de la grille de pixels et du temps réel

CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(32) UNIQUE NOT NULL,
    password_hash VARCHAR(72) NOT NULL,
    source        VARCHAR(20) NOT NULL DEFAULT 'web',
    created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index pour accélerer les lookups par username (login)
CREATE INDEX IF NOT EXISTS idx_users_username ON users (LOWER(username));
