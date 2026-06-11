# Full-stack production image: Express API + built Vite frontend in one
# container. `npm run build` emits both dist/ (frontend) and api/_server.cjs
# (esbuild CJS bundle of server/index.ts — no tsx/ts-node needed at runtime).
# The server binds 0.0.0.0:$PORT (platform-injected; falls back to 3001) and
# serves dist/ itself, so no separate static layer is required or wanted —
# a static SPA fallback in front of this container would shadow /api/*.
# Primary deployment is Vercel (serverless); this image is for self-hosting
# (Cantila, Docker, etc.).

# Stage 1: build frontend + server bundle
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: lean runtime
FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

# Production deps only — the server bundle inlines its imports, but optional
# externals (pg-native, bufferutil) and any runtime file reads resolve from
# the real dependency tree when present.
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Server bundle + frontend build + runtime-read assets.
COPY --from=builder /app/api ./api
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/public ./public

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --quiet --tries=1 --spider "http://localhost:${PORT:-3001}/api/health" || exit 1

CMD ["node", "api/_server.cjs"]
