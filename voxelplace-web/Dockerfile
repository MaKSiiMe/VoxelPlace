FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Génère un certificat auto-signé (valable 1 an)
RUN apk add --no-cache openssl && \
    mkdir -p /etc/nginx/certs && \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout /etc/nginx/certs/server.key \
      -out    /etc/nginx/certs/server.crt \
      -subj   "/C=FR/ST=Occitanie/L=Toulouse/O=VoxelPlace/CN=voxelplace" \
      -addext "subjectAltName=IP:192.168.68.51,IP:100.124.153.20,IP:127.0.0.1"

EXPOSE 80 443
