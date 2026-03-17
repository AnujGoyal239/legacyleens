# ============================================================
# LegacyLens — Multi-stage Dockerfile for GCP Cloud Run
# Builds frontend (Vite) + backend (Fastify/tRPC) in one image.
# Worker runs from the same image with a different CMD.
# ============================================================

# --- Stage 1: Install dependencies ---
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci --ignore-scripts
RUN npx prisma generate

# --- Stage 2: Build frontend + backend ---
FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY . .

# Build Vite frontend
RUN npm run build:client

# Build server (TypeScript → JS)
RUN npm run build:server

# --- Stage 3: Production image ---
FROM node:20-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    git ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

# Copy production node_modules
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma

# Copy built frontend
COPY --from=builder /app/dist/client ./dist/client

# Copy built server
COPY --from=builder /app/dist ./dist

# Copy package.json for start scripts
COPY package.json ./

# Create uploads directory
RUN mkdir -p uploads/meetings

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Default: run the API server
# Override CMD in Cloud Run for the worker service
CMD ["node", "dist/server/index.js"]
