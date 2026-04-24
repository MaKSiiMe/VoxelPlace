FROM node:20-alpine

WORKDIR /app

# Workspace root (requis pour résoudre @voxelplace/types)
COPY package.json ./
COPY package-lock.json ./

# Package partagé (constants ROLE_COOLDOWNS, SUPERUSER_PREFIXES)
COPY packages/types/package.json ./packages/types/
COPY packages/types/src/roles.js ./packages/types/src/

# Backend
COPY apps/socket-server/package.json ./apps/socket-server/
WORKDIR /app/apps/socket-server
RUN npm install --omit=dev

COPY apps/socket-server/src/     ./src/
COPY apps/socket-server/scripts/ ./scripts/

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/api/stats').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]
