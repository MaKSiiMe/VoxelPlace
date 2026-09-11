#!/usr/bin/env bash
# ── Secret partagé entre l'API et le plugin Minecraft ────────────────────────
#
# À lancer sur le serveur, depuis /opt/voxelplace, AVANT de déployer la version
# qui authentifie le pont de jeu. Sans ce secret des deux côtés, le serveur
# refuse les pixels posés depuis Minecraft.
#
#   bash apps/socket-server/scripts/setup-bridge-token.sh
#
# Le script :
#   1. écrit BRIDGE_TOKEN dans .env (réutilise la valeur existante s'il y en a une) ;
#   2. écrit la même valeur en bridge-token dans le config.yml du plugin, dans
#      le conteneur Minecraft — le nouveau jar n'ajoute pas cette clé à un
#      config.yml déjà présent.
#
# Il est idempotent, et n'affiche jamais le secret.

set -euo pipefail

ENV_FILE="${ENV_FILE:-.env}"
MC_CONTAINER="${MC_CONTAINER:-minecraft-paper}"
MC_VOLUME="${MC_VOLUME:-minecraft-server_mc_data}"
PLACEHOLDER="change_this_to_a_random_secret"

[ -f "$ENV_FILE" ] || { echo "Fichier $ENV_FILE introuvable — lancer depuis /opt/voxelplace." >&2; exit 1; }

# ── 1. Côté serveur : .env ───────────────────────────────────────────────────
existing="$(grep -E '^BRIDGE_TOKEN=' "$ENV_FILE" | tail -n 1 | cut -d= -f2- || true)"
if [ -n "$existing" ] && [ "$existing" != "$PLACEHOLDER" ]; then
  TOKEN="$existing"
  echo "[1/2] BRIDGE_TOKEN déjà présent dans $ENV_FILE — valeur conservée."
else
  TOKEN="$(openssl rand -hex 32)"
  if grep -qE '^BRIDGE_TOKEN=' "$ENV_FILE"; then
    sed -i "s|^BRIDGE_TOKEN=.*|BRIDGE_TOKEN=${TOKEN}|" "$ENV_FILE"
  else
    printf '\nBRIDGE_TOKEN=%s\n' "$TOKEN" >> "$ENV_FILE"
  fi
  echo "[1/2] BRIDGE_TOKEN généré et écrit dans $ENV_FILE."
fi

# ── 2. Côté plugin : config.yml dans le conteneur ────────────────────────────
mc_dest="$(docker inspect "$MC_CONTAINER" \
  --format "{{range .Mounts}}{{if eq .Name \"${MC_VOLUME}\"}}{{.Destination}}{{end}}{{end}}")"
mc_dest="${mc_dest:-/data}"
config="${mc_dest}/plugins/VoxelPlace/config.yml"

if ! docker exec "$MC_CONTAINER" test -f "$config"; then
  echo "config.yml du plugin introuvable : $config" >&2
  echo "Le plugin a-t-il déjà démarré une fois sur ce serveur ?" >&2
  exit 1
fi

# Écrit en tant que propriétaire du fichier, pour que Paper puisse encore le lire.
owner="$(docker exec "$MC_CONTAINER" stat -c '%u:%g' "$config")"

# Le secret passe par l'entrée standard, jamais par la ligne de commande : il
# n'apparaît ni dans « ps », ni dans la configuration d'exec du conteneur.
printf '%s' "$TOKEN" | docker exec -i -u "$owner" "$MC_CONTAINER" sh -c '
  TOKEN="$(cat)"
  CFG="$1"
  if grep -q "^bridge-token:" "$CFG"; then
    sed -i "s|^bridge-token:.*|bridge-token: \"$TOKEN\"|" "$CFG"
  else
    printf "\n# Secret partagé avec le serveur (BRIDGE_TOKEN dans le .env)\nbridge-token: \"%s\"\n" "$TOKEN" >> "$CFG"
  fi
' sh "$config"
echo "[2/2] bridge-token écrit dans $config."

echo
echo "Configuration terminée. Étapes suivantes :"
echo "  - merger la PR : le déploiement recrée l'API avec BRIDGE_TOKEN et redémarre"
echo "    le serveur Minecraft avec le nouveau plugin ;"
echo "  - vérifier : docker logs voxelplace-api 2>&1 | grep -c 'BRIDGE_TOKEN absent'   (attendu : 0)"
echo "               docker logs minecraft-paper 2>&1 | grep -c 'bridge-token absent'  (attendu : 0)"
