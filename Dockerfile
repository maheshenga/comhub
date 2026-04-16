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

ARG DOCKER_BUILD_MAX_OLD_SPACE_SIZE="8192"

WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package.json pnpm-workspace.yaml ./
COPY .npmrc ./
COPY packages ./packages
COPY patches ./patches
COPY apps/desktop/src/main/package.json ./apps/desktop/src/main/package.json
# e2e is a workspace member - pnpm needs its manifest
COPY e2e/package.json ./e2e/package.json
# Optional preseeded ffmpeg binary for constrained Docker builders.
COPY .docker-ffmpeg/ /tmp/preseeded-ffmpeg/

# Install pnpm directly (skip corepack for reliability)
RUN npm i -g pnpm@10.33.0

# Fix npm registry resolution for Docker build environment
RUN echo 'registry=https://registry.npmjs.org/' >> /app/.npmrc && \
    echo 'fetch-retries=5' >> /app/.npmrc && \
    echo 'fetch-retry-mintimeout=20000' >> /app/.npmrc && \
    echo 'fetch-retry-maxtimeout=120000' >> /app/.npmrc && \
    sed -i '/resolution-mode=highest/d' /app/.npmrc

# Fix: @react-pdf/image@3.1.0 depends on @react-pdf/svg which doesn't exist on npm
# Use .pnpmfile.cjs hook to strip the broken dependency before resolution
RUN printf 'function readPackage(pkg) {\n  if (pkg.dependencies && pkg.dependencies["@react-pdf/svg"]) {\n    delete pkg.dependencies["@react-pdf/svg"];\n  }\n  return pkg;\n}\nmodule.exports = { hooks: { readPackage } };\n' > /app/.pnpmfile.cjs

# Install workspace dependencies
RUN mkdir -p /app/vendor && \
    if [ -f /tmp/preseeded-ffmpeg/ffmpeg ]; then \
      install -Dm755 /tmp/preseeded-ffmpeg/ffmpeg /app/vendor/ffmpeg && \
      FFMPEG_BIN=/app/vendor/ffmpeg FFMPEG_SKIP_OPTIONAL_DOWNLOADS="1" pnpm i --no-frozen-lockfile; \
    else \
      FFMPEG_SKIP_OPTIONAL_DOWNLOADS="1" pnpm i --no-frozen-lockfile; \
    fi

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

# Use a CI-safe default heap cap; smaller builders can still override this build arg.
RUN rm -rf public/_spa && \
    DOCKER_BUILD_DISABLE_VITE_MINIFY="1" NODE_OPTIONS="--max-old-space-size=${DOCKER_BUILD_MAX_OLD_SPACE_SIZE}" pnpm exec vite build && \
    DOCKER_BUILD_DISABLE_VITE_MINIFY="1" MOBILE=true NODE_OPTIONS="--max-old-space-size=${DOCKER_BUILD_MAX_OLD_SPACE_SIZE}" pnpm exec vite build && \
    pnpm exec tsx scripts/copySpaBuild.mts && \
    pnpm exec tsx scripts/generateSpaTemplates.mts && \
    NODE_OPTIONS="--max-old-space-size=${DOCKER_BUILD_MAX_OLD_SPACE_SIZE}" DOCKER=true pnpm exec next build && \
    pnpm exec tsx ./scripts/buildSitemapIndex/index.ts

## Application image
FROM busybox:latest AS app

COPY --from=base /distroless/ /

# Copy standalone build output
COPY --from=builder /app/.next/standalone /app/
COPY --from=builder /app/.next/static /app/.next/static
# Copy SPA assets
COPY --from=builder /app/public/_spa /app/public/_spa
# Copy optional ffmpeg binary for runtime video processing
COPY --from=builder /app/vendor /app/vendor
# Copy database migrations
COPY --from=builder /app/packages/database/migrations /app/migrations
COPY --from=builder /app/scripts/migrateServerDB/docker.cjs /app/docker.cjs
COPY --from=builder /app/scripts/migrateServerDB/errorHint.js /app/errorHint.js
# Copy pg + drizzle-orm deps (copy all at once to avoid missing transitive deps)
COPY --from=builder /deps/node_modules /app/node_modules

ENV NODE_ENV="production" \
    HOSTNAME="0.0.0.0" \
    PORT="3210" \
    NODE_EXTRA_CA_CERTS="/etc/ssl/certs/ca-certificates.crt" \
    LD_PRELOAD="/lib/libproxychains.so.4"

EXPOSE 3210/tcp

CMD ["sh", "-c", "if [ -f /app/vendor/ffmpeg ]; then export FFMPEG_BIN=/app/vendor/ffmpeg; fi; node /app/docker.cjs && node /app/server.js"]
