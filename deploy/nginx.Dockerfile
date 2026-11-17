# nginx avec la configuration du dépôt intégrée : l'image publiée sur ghcr suffit,
# plus besoin de /opt/voxelplace/nginx.conf sur le serveur.
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
