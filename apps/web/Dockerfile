# ─── Stage 1 : dépendances ────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Turbo + workspace need the root manifests
COPY package.json package-lock.json* ./
COPY turbo.json ./

# Packages manifests (pas le code source, juste les package.json)
COPY packages/config/package.json         ./packages/config/
COPY packages/types/package.json          ./packages/types/
COPY packages/styles/package.json         ./packages/styles/
COPY packages/db/package.json             ./packages/db/

# Web app manifest
COPY apps/web/package.json ./apps/web/

RUN npm ci

# ─── Stage 2 : build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Reprend node_modules du stage deps
COPY --from=deps /app/node_modules         ./node_modules

# Source complète (on a besoin des packages locaux)
COPY . .

# Réinstalle dans le contexte workspace complet (résout les symlinks + types TypeScript)
RUN npm install --ignore-scripts

# Variables nécessaires au build Next.js
ARG NEXT_PUBLIC_API_URL=http://localhost
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Build uniquement l'app web via Turbo
RUN npx turbo run build --filter=@voxelplace/web

# ─── Stage 3 : runner (image finale légère) ───────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Output Next.js standalone
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static      ./apps/web/.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
