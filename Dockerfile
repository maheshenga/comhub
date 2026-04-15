# ============================================
# Stage 1: Base image with Node.js + pnpm
# ============================================
FROM node:22-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

# Install system dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

# ============================================
# Stage 2: Install dependencies + build
# ============================================
FROM base AS builder

WORKDIR /app

# Copy full source (no lockfile available, so no selective copy optimization)
COPY . .

# Install dependencies
RUN pnpm install --no-frozen-lockfile

# Set build environment
ENV DOCKER=true
ENV NODE_OPTIONS="--max-old-space-size=8192"
ARG SHA
ENV NEXT_PUBLIC_BUILD_SHA=${SHA}

# Build: SPA + Mobile + copy + Next.js + sitemap
RUN pnpm run build:spa
RUN pnpm run build:spa:mobile || true
RUN pnpm run build:spa:copy
RUN pnpm exec next build
RUN pnpm run build-sitemap || true

# ============================================
# Stage 3: Production runner (standalone)
# ============================================
FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3210

# Install minimal runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 lobehub

# Copy standalone build output
COPY --from=builder --chown=lobehub:nodejs /app/.next/standalone ./
COPY --from=builder --chown=lobehub:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=lobehub:nodejs /app/public ./public

# Copy database migrations (needed at runtime for auto-migration)
COPY --from=builder --chown=lobehub:nodejs /app/packages/database/migrations ./packages/database/migrations

USER lobehub

EXPOSE 3210

CMD ["node", "server.js"]
