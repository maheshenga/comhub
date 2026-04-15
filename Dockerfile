## Set global build ENV
ARG NODEJS_VERSION="22"

## Base image for all building stages
FROM node:${NODEJS_VERSION}-slim AS base

ENV DEBIAN_FRONTEND="noninteractive"

RUN apt update && \
    apt install ca-certificates proxychains-ng -qy && \
    mkdir -p /distroless/bin /distroless/etc /distroless/etc/ssl/certs /distroless/lib && \
    cp /usr/lib/$(arch)-linux-gnu/libproxychains.so.4 /distroless/lib/libproxychains.so.4 && \
    cp /usr/lib/$(arch)-linux-gnu/libdl.so.2 /distroless/lib/libdl.so.2 && \
    cp /usr/bin/proxychains4 /distroless/bin/proxychains && \
    cp /etc/proxychains4.conf /distroless/etc/proxychains4.conf && \
    cp /usr/lib/$(arch)-linux-gnu/libstdc++.so.6 /distroless/lib/libstdc++.so.6 && \
    cp /usr/lib/$(arch)-linux-gnu/libgcc_s.so.1 /distroless/lib/libgcc_s.so.1 && \
    cp /usr/lib/$(arch)-linux-gnu/librt.so.1 /distroless/lib/librt.so.1 && \
    cp /usr/local/bin/node /distroless/bin/node && \
    cp /etc/ssl/certs/ca-certificates.crt /distroless/etc/ssl/certs/ca-certificates.crt && \
    rm -rf /tmp/* /var/lib/apt/lists/* /var/tmp/*

## Builder image
FROM base AS builder

# Install build tools for native modules
RUN apt update && \
    apt install -qy git python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

# Disable corepack to prevent conflicts with global pnpm
RUN corepack disable 2>/dev/null || true
ENV COREPACK_ENABLE_STRICT=0

# Build-time env vars needed by Next.js
ENV APP_URL="http://app.com" \
    DATABASE_DRIVER="node" \
    DATABASE_URL="postgres://postgres:password@localhost:5432/postgres" \
    KEY_VAULTS_SECRET="use-for-build" \
    AUTH_SECRET="use-for-build"

ENV NODE_OPTIONS="--max-old-space-size=8192"

ARG SHA
ENV NEXT_PUBLIC_BUILD_SHA=${SHA}

WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package.json pnpm-workspace.yaml ./
COPY .npmrc ./
COPY packages ./packages
COPY patches ./patches
COPY apps/desktop/src/main/package.json ./apps/desktop/src/main/package.json
# e2e is a workspace member - pnpm needs its manifest
COPY e2e/package.json ./e2e/package.json

# Install pnpm directly (skip corepack for reliability)
RUN npm i -g pnpm@10.33.0

# Fix npm registry resolution for Docker build environment
RUN echo 'registry=https://registry.npmjs.org/' >> /app/.npmrc && \
    echo 'fetch-retries=5' >> /app/.npmrc && \
    echo 'fetch-retry-mintimeout=20000' >> /app/.npmrc && \
    echo 'fetch-retry-maxtimeout=120000' >> /app/.npmrc && \
    sed -i '/resolution-mode=highest/d' /app/.npmrc

# Install workspace dependencies
RUN pnpm i --no-frozen-lockfile

# Install standalone pg + drizzle-orm for runtime migration
RUN mkdir -p /deps && \
    cd /deps && \
    pnpm init && \
    pnpm add pg drizzle-orm

# Copy full source
COPY . .

# Prebuild checks
RUN pnpm exec tsx scripts/dockerPrebuild.mts
RUN rm -rf src/app/desktop "src/app/(backend)/trpc/desktop"

# Build
RUN npm run build:docker

## Application image
FROM busybox:latest AS app

COPY --from=base /distroless/ /

# Copy standalone build output
COPY --from=builder /app/.next/standalone /app/
COPY --from=builder /app/.next/static /app/.next/static
# Copy SPA assets
COPY --from=builder /app/public/_spa /app/public/_spa
# Copy database migrations
COPY --from=builder /app/packages/database/migrations /app/migrations
COPY --from=builder /app/scripts/migrateServerDB/docker.cjs /app/docker.cjs
COPY --from=builder /app/scripts/migrateServerDB/errorHint.js /app/errorHint.js
# Copy pg + drizzle-orm deps
COPY --from=builder /deps/node_modules/.pnpm /app/node_modules/.pnpm
COPY --from=builder /deps/node_modules/pg /app/node_modules/pg
COPY --from=builder /deps/node_modules/pg-cloudflare /app/node_modules/pg-cloudflare
COPY --from=builder /deps/node_modules/pg-connection-string /app/node_modules/pg-connection-string
COPY --from=builder /deps/node_modules/pg-int8 /app/node_modules/pg-int8
COPY --from=builder /deps/node_modules/pg-numeric /app/node_modules/pg-numeric
COPY --from=builder /deps/node_modules/pg-pool /app/node_modules/pg-pool
COPY --from=builder /deps/node_modules/pg-protocol /app/node_modules/pg-protocol
COPY --from=builder /deps/node_modules/pg-types /app/node_modules/pg-types
COPY --from=builder /deps/node_modules/pgpass /app/node_modules/pgpass
COPY --from=builder /deps/node_modules/postgres-array /app/node_modules/postgres-array
COPY --from=builder /deps/node_modules/postgres-bytea /app/node_modules/postgres-bytea
COPY --from=builder /deps/node_modules/postgres-date /app/node_modules/postgres-date
COPY --from=builder /deps/node_modules/postgres-interval /app/node_modules/postgres-interval
COPY --from=builder /deps/node_modules/postgres-range /app/node_modules/postgres-range
COPY --from=builder /deps/node_modules/drizzle-orm /app/node_modules/drizzle-orm
COPY --from=builder /deps/node_modules/split2 /app/node_modules/split2
COPY --from=builder /deps/node_modules/obuf /app/node_modules/obuf

ENV NODE_ENV="production" \
    HOSTNAME="0.0.0.0" \
    PORT="3210" \
    NODE_EXTRA_CA_CERTS="/etc/ssl/certs/ca-certificates.crt" \
    LD_PRELOAD="/lib/libproxychains.so.4"

EXPOSE 3210/tcp

CMD ["/bin/node", "/app/docker.cjs"]
