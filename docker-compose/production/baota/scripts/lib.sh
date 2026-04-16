#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
BASE_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
STATE_DIR=${STATE_DIR:-"$BASE_DIR/state"}
APP_DIR=${APP_DIR:-"$BASE_DIR/app"}
RUNTIME_DIR=${RUNTIME_DIR:-"$BASE_DIR/runtime"}
SLOTS_DIR=${SLOTS_DIR:-"$RUNTIME_DIR/slots"}
ACTIVE_SLOT_FILE=${ACTIVE_SLOT_FILE:-"$RUNTIME_DIR/active-slot"}
HISTORY_FILE=${HISTORY_FILE:-"$RUNTIME_DIR/history.log"}
APP_ENV_FILE=${APP_ENV_FILE:-"$APP_DIR/.env"}
STATE_ENV_FILE=${STATE_ENV_FILE:-"$STATE_DIR/.env"}
NGINX_UPSTREAM_FILE=${NGINX_UPSTREAM_FILE:-/www/server/nginx/conf/comhub-upstream.conf}
NGINX_BIN=${NGINX_BIN:-/www/server/nginx/sbin/nginx}
COMHUB_NETWORK=${COMHUB_NETWORK:-comhub-internal}
BLUE_PORT=${BLUE_PORT:-3210}
GREEN_PORT=${GREEN_PORT:-3211}

ensure_dirs() {
  mkdir -p "$RUNTIME_DIR" "$SLOTS_DIR"
}

log() {
  printf '%s\n' "$*"
}

record_history() {
  ensure_dirs
  printf '%s %s\n' "$(date '+%F %T %Z')" "$*" >> "$HISTORY_FILE"
}

active_slot() {
  if [ -f "$ACTIVE_SLOT_FILE" ]; then
    cat "$ACTIVE_SLOT_FILE"
  else
    printf '%s\n' blue
  fi
}

inactive_slot() {
  case "$(active_slot)" in
    blue) printf '%s\n' green ;;
    green) printf '%s\n' blue ;;
    *) printf '%s\n' blue ;;
  esac
}

slot_port() {
  case "$1" in
    blue) printf '%s\n' "$BLUE_PORT" ;;
    green) printf '%s\n' "$GREEN_PORT" ;;
    *)
      log "Unknown slot: $1" >&2
      exit 1
      ;;
  esac
}

slot_env_file() {
  printf '%s/%s.env\n' "$SLOTS_DIR" "$1"
}

slot_container_name() {
  printf 'comhub-app-%s\n' "$1"
}

slot_project_name() {
  printf 'comhub-app-%s\n' "$1"
}

require_file() {
  if [ ! -f "$1" ]; then
    log "Missing required file: $1" >&2
    exit 1
  fi
}

require_bin() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log "Missing required command: $1" >&2
    exit 1
  fi
}

ensure_prerequisites() {
  require_bin docker
  require_bin curl
  require_file "$APP_ENV_FILE"
  require_file "$STATE_ENV_FILE"
}

load_slot_env() {
  SLOT_FILE=$(slot_env_file "$1")
  require_file "$SLOT_FILE"
  # shellcheck disable=SC1090
  . "$SLOT_FILE"
  export APP_IMAGE APP_SLOT APP_PORT APP_CONTAINER_NAME COMPOSE_PROJECT_NAME
}

write_slot_env() {
  SLOT_NAME=$1
  IMAGE_NAME=$2
  PORT_VALUE=$(slot_port "$SLOT_NAME")
  SLOT_FILE=$(slot_env_file "$SLOT_NAME")
  ensure_dirs
  cat > "$SLOT_FILE" <<EOF
APP_IMAGE=$IMAGE_NAME
APP_SLOT=$SLOT_NAME
APP_PORT=$PORT_VALUE
APP_CONTAINER_NAME=$(slot_container_name "$SLOT_NAME")
COMPOSE_PROJECT_NAME=$(slot_project_name "$SLOT_NAME")
EOF
}

ensure_state_up() {
  (
    cd "$STATE_DIR"
    docker compose --env-file "$STATE_ENV_FILE" up -d
  )
}

run_app_compose() {
  (
    cd "$APP_DIR"
    docker compose --project-name "$COMPOSE_PROJECT_NAME" --env-file "$APP_ENV_FILE" up -d
  )
}

reload_nginx() {
  if [ ! -x "$NGINX_BIN" ]; then
    NGINX_BIN=$(command -v nginx || true)
  fi
  if [ -z "${NGINX_BIN:-}" ]; then
    log "Nginx binary not found" >&2
    exit 1
  fi
  "$NGINX_BIN" -t
  if pgrep -x nginx >/dev/null 2>&1; then
    "$NGINX_BIN" -s reload
  else
    "$NGINX_BIN"
  fi
}
