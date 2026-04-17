#!/bin/sh
set -eu

. "$(dirname "$0")/lib.sh"

WARNINGS=0

warn() {
  WARNINGS=$((WARNINGS + 1))
  printf '%s\n' "WARN: $*"
}

pass() {
  printf '%s\n' "OK: $*"
}

require_env_key() {
  ENV_FILE=$1
  KEY=$2

  if grep -Eq "^[[:space:]]*${KEY}=" "$ENV_FILE"; then
    pass "$(basename "$ENV_FILE") contains ${KEY}"
  else
    log "ERROR: $(basename "$ENV_FILE") is missing ${KEY}" >&2
    exit 1
  fi
}

read_env_value() {
  ENV_FILE=$1
  KEY=$2

  awk -v key="$KEY" '
    $0 ~ "^[[:space:]]*" key "=" {
      sub(/^[^=]*=/, "", $0)
      sub(/\r$/, "", $0)
      print $0
      exit
    }
  ' "$ENV_FILE"
}

compare_env_value() {
  LEFT_FILE=$1
  RIGHT_FILE=$2
  KEY=$3

  LEFT_VALUE=$(read_env_value "$LEFT_FILE" "$KEY")
  RIGHT_VALUE=$(read_env_value "$RIGHT_FILE" "$KEY")

  if [ "$LEFT_VALUE" = "$RIGHT_VALUE" ]; then
    pass "${KEY} is aligned across $(basename "$LEFT_FILE") and $(basename "$RIGHT_FILE")"
  else
    log "ERROR: ${KEY} mismatch between $(basename "$LEFT_FILE") and $(basename "$RIGHT_FILE")" >&2
    exit 1
  fi
}

check_url_prefix() {
  ENV_FILE=$1
  KEY=$2
  PREFIX=$3

  VALUE=$(read_env_value "$ENV_FILE" "$KEY")
  case "$VALUE" in
    "$PREFIX"*)
      pass "${KEY} uses ${PREFIX}"
      ;;
    *)
      warn "${KEY} in $(basename "$ENV_FILE") should usually start with ${PREFIX}, current=${VALUE}"
      ;;
  esac
}

check_file() {
  TARGET_FILE=$1

  if [ -f "$TARGET_FILE" ]; then
    pass "Found $TARGET_FILE"
  else
    log "ERROR: Missing required file $TARGET_FILE" >&2
    exit 1
  fi
}

check_dir() {
  TARGET_DIR=$1

  if [ -d "$TARGET_DIR" ]; then
    pass "Found directory $TARGET_DIR"
  else
    warn "Directory $TARGET_DIR does not exist yet"
  fi
}

log "Running ComHub BaoTa preflight checks"
ensure_prerequisites
ensure_dirs

require_bin docker
require_bin curl

check_file "$APP_ENV_FILE"
check_file "$STATE_ENV_FILE"
check_file "$APP_DIR/docker-compose.yml"
check_file "$STATE_DIR/docker-compose.yml"
check_file "$BASE_DIR/nginx/chat.vip.hezelove.cn.conf.example"
check_file "$BASE_DIR/nginx/s3.vip.hezelove.cn.conf.example"
check_file "$BASE_DIR/nginx/comhub-upstream.conf.example"

require_env_key "$APP_ENV_FILE" "APP_URL"
require_env_key "$APP_ENV_FILE" "KEY_VAULTS_SECRET"
require_env_key "$APP_ENV_FILE" "AUTH_SECRET"
require_env_key "$APP_ENV_FILE" "LOBE_DB_NAME"
require_env_key "$APP_ENV_FILE" "POSTGRES_PASSWORD"
require_env_key "$APP_ENV_FILE" "S3_ENDPOINT"
require_env_key "$APP_ENV_FILE" "RUSTFS_ACCESS_KEY"
require_env_key "$APP_ENV_FILE" "RUSTFS_SECRET_KEY"
require_env_key "$APP_ENV_FILE" "RUSTFS_LOBE_BUCKET"
require_env_key "$APP_ENV_FILE" "SEARXNG_URL"
require_env_key "$APP_ENV_FILE" "REDIS_URL"

require_env_key "$STATE_ENV_FILE" "LOBE_DB_NAME"
require_env_key "$STATE_ENV_FILE" "POSTGRES_PASSWORD"
require_env_key "$STATE_ENV_FILE" "RUSTFS_ACCESS_KEY"
require_env_key "$STATE_ENV_FILE" "RUSTFS_SECRET_KEY"
require_env_key "$STATE_ENV_FILE" "RUSTFS_LOBE_BUCKET"

compare_env_value "$APP_ENV_FILE" "$STATE_ENV_FILE" "LOBE_DB_NAME"
compare_env_value "$APP_ENV_FILE" "$STATE_ENV_FILE" "POSTGRES_PASSWORD"
compare_env_value "$APP_ENV_FILE" "$STATE_ENV_FILE" "RUSTFS_ACCESS_KEY"
compare_env_value "$APP_ENV_FILE" "$STATE_ENV_FILE" "RUSTFS_SECRET_KEY"
compare_env_value "$APP_ENV_FILE" "$STATE_ENV_FILE" "RUSTFS_LOBE_BUCKET"

check_url_prefix "$APP_ENV_FILE" "APP_URL" "https://"
check_url_prefix "$APP_ENV_FILE" "S3_ENDPOINT" "https://"

if docker info >/dev/null 2>&1; then
  pass "Docker daemon is reachable"
else
  log "ERROR: Docker daemon is not reachable" >&2
  exit 1
fi

if docker compose --env-file "$STATE_ENV_FILE" -f "$STATE_DIR/docker-compose.yml" config >/dev/null 2>&1; then
  pass "State compose file is valid"
else
  log "ERROR: State compose file validation failed" >&2
  exit 1
fi

if docker compose --env-file "$APP_ENV_FILE" -f "$APP_DIR/docker-compose.yml" config >/dev/null 2>&1; then
  pass "App compose file is valid"
else
  log "ERROR: App compose file validation failed" >&2
  exit 1
fi

if docker network inspect "$COMHUB_NETWORK" >/dev/null 2>&1; then
  pass "Docker network $COMHUB_NETWORK already exists"
else
  warn "Docker network $COMHUB_NETWORK does not exist yet. It will be created when state compose starts."
fi

check_dir "$BASE_DIR/acme/.well-known/acme-challenge"
check_dir "$RUNTIME_DIR"

if [ -f "$NGINX_UPSTREAM_FILE" ]; then
  pass "Nginx upstream file exists at $NGINX_UPSTREAM_FILE"
else
  warn "Nginx upstream file is missing at $NGINX_UPSTREAM_FILE. Run ./install.sh before first switch."
fi

if [ -x "$NGINX_BIN" ] || command -v nginx >/dev/null 2>&1; then
  pass "Nginx binary is available"
else
  warn "Nginx binary is not currently discoverable. This is expected before BaoTa/Nginx is installed."
fi

if [ "$WARNINGS" -gt 0 ]; then
  log "Preflight completed with ${WARNINGS} warning(s)"
else
  log "Preflight completed successfully with no warnings"
fi
