#!/usr/bin/env bash
# ── Sauvegarde PostgreSQL — VoxelPlace ───────────────────────────────────────
# Usage : bash scripts/backup-db.sh
# Crée un dump dans ./backups/ avec horodatage.
# Variables lues depuis l'environnement (ou .env si présent).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Charge .env si présent
ENV_FILE="$ROOT_DIR/.env"
if [ -f "$ENV_FILE" ]; then
  set -o allexport
  source "$ENV_FILE"
  set +o allexport
fi

# Extraire les paramètres depuis DATABASE_URL si défini
if [ -n "${DATABASE_URL:-}" ]; then
  PGHOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:/]*\).*|\1|p')
  PGPORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
  PGDATABASE=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
  PGUSER=$(echo "$DATABASE_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
  PGPASSWORD=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
  export PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD
fi

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGDATABASE="${PGDATABASE:-voxelplace}"
PGUSER="${PGUSER:-voxelplace}"

BACKUP_DIR="$SCRIPT_DIR/../backups"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/voxelplace_${TIMESTAMP}.sql.gz"

echo "Sauvegarde de ${PGDATABASE}@${PGHOST}:${PGPORT}..."
pg_dump \
  --host="$PGHOST" \
  --port="$PGPORT" \
  --username="$PGUSER" \
  --no-password \
  --format=plain \
  --no-owner \
  --no-acl \
  "$PGDATABASE" | gzip > "$BACKUP_FILE"

SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
echo "✅ Backup créé : $BACKUP_FILE ($SIZE)"

# Nettoyer les backups de plus de 7 jours
find "$BACKUP_DIR" -name "voxelplace_*.sql.gz" -mtime +7 -delete 2>/dev/null || true
echo "Anciens backups (>7j) supprimés."
