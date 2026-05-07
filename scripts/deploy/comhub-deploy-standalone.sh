#!/usr/bin/env bash
set -euo pipefail

APP_DIR=${APP_DIR:-/www/wwwroot/comhub/app}
ROOT_DIR=${ROOT_DIR:-/www/wwwroot/comhub}
PKG=${1:-${PKG:-/tmp/comhub-latest-app.tar.gz}}
PORT=${PORT:-3210}
HOSTNAME=${HOSTNAME:-0.0.0.0}
NODE=${NODE:-/usr/local/bin/node}

TS=$(date +%Y%m%d-%H%M%S)
BACKUP=${ROOT_DIR}/app.backup-${TS}
ENV_BAK=/tmp/comhub-env-${TS}

echo "== verify package =="
test -s "$PKG"
ls -lh "$PKG"

echo "== stop old app if running =="
pkill -f "${APP_DIR}/.*server\\.js" 2>/dev/null || true
pkill -f "${APP_DIR}/.*startServer\\.js" 2>/dev/null || true
sleep 1
ss -ltnp | grep ":${PORT}" || true

echo "== backup env and current app =="
test -f "$APP_DIR/.env"
cp -a "$APP_DIR/.env" "$ENV_BAK"
mv "$APP_DIR" "$BACKUP"
mkdir -p "$APP_DIR"

echo "== extract new app =="
tar -xzf "$PKG" -C "$APP_DIR"
cp -a "$ENV_BAK" "$APP_DIR/.env"
chmod 600 "$APP_DIR/.env" || true

echo "== verify deployed manifest =="
grep -q "spa/\\[variants\\]/\\[\\[\\.\\.\\.path\\]\\]/route" "$APP_DIR/.next/server/app-paths-manifest.json"
grep -q "\\[variants\\]/(auth)/signin/page" "$APP_DIR/.next/server/app-paths-manifest.json"
grep -q "(backend)/api/version/route" "$APP_DIR/.next/server/app-paths-manifest.json"
ls -lh "$APP_DIR/server.js" "$APP_DIR/.env"

echo "== migrate database, no build =="
cd "$APP_DIR"
set -a
. ./.env
set +a
if [ -n "${DATABASE_DRIVER:-}" ] && [ -f docker.cjs ]; then
  "$NODE" docker.cjs
fi

echo "== start node standalone =="
PORT="$PORT" HOSTNAME="$HOSTNAME" NODE_ENV=production nohup "$NODE" server.js > start.log 2>&1 &
echo $! > app.pid
sleep 5
ss -ltnp | grep ":${PORT}"
curl -I --max-time 15 "http://127.0.0.1:${PORT}/" | head -20
curl --max-time 15 "http://127.0.0.1:${PORT}/api/version" | head -c 500 || true

echo ""
echo "== done =="
echo "backup=$BACKUP"
