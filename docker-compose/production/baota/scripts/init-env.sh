#!/bin/sh
set -eu

. "$(dirname "$0")/lib.sh"

APP_TEMPLATE_FILE=${APP_TEMPLATE_FILE:-"$APP_DIR/.env.example"}
STATE_TEMPLATE_FILE=${STATE_TEMPLATE_FILE:-"$STATE_DIR/.env.example"}
FORCE=${FORCE:-0}

APP_PUBLIC_URL=${APP_PUBLIC_URL:-https://chat.vip.hezelove.cn}
S3_PUBLIC_URL=${S3_PUBLIC_URL:-https://s3.vip.hezelove.cn}
INTERNAL_APP_URL_VALUE=${INTERNAL_APP_URL_VALUE:-http://localhost:3210}
RUSTFS_ACCESS_KEY_VALUE=${RUSTFS_ACCESS_KEY_VALUE:-admin}
RUSTFS_BUCKET_VALUE=${RUSTFS_BUCKET_VALUE:-lobe}
LOBE_DB_NAME_VALUE=${LOBE_DB_NAME_VALUE:-lobechat}

generate_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
    return
  fi

  od -An -N 32 -tx1 /dev/urandom | tr -d ' \n'
}

replace_line() {
  TARGET_FILE=$1
  KEY=$2
  VALUE=$3

  awk -v key="$KEY" -v value="$VALUE" '
    BEGIN { updated = 0 }
    $0 ~ "^[[:space:]]*" key "=" {
      print key "=" value
      updated = 1
      next
    }
    { print }
    END {
      if (updated == 0) {
        print key "=" value
      }
    }
  ' "$TARGET_FILE" > "${TARGET_FILE}.tmp"

  mv "${TARGET_FILE}.tmp" "$TARGET_FILE"
}

assert_absent_or_force() {
  TARGET_FILE=$1

  if [ -f "$TARGET_FILE" ] && [ "$FORCE" != "1" ]; then
    log "ERROR: $TARGET_FILE already exists. Set FORCE=1 to overwrite." >&2
    exit 1
  fi
}

copy_template() {
  TEMPLATE_FILE=$1
  TARGET_FILE=$2

  require_file "$TEMPLATE_FILE"
  assert_absent_or_force "$TARGET_FILE"
  cp "$TEMPLATE_FILE" "$TARGET_FILE"
}

require_file "$APP_TEMPLATE_FILE"
require_file "$STATE_TEMPLATE_FILE"

copy_template "$APP_TEMPLATE_FILE" "$APP_ENV_FILE"
copy_template "$STATE_TEMPLATE_FILE" "$STATE_ENV_FILE"

KEY_VAULTS_SECRET_VALUE=${KEY_VAULTS_SECRET_VALUE:-$(generate_secret)}
AUTH_SECRET_VALUE=${AUTH_SECRET_VALUE:-$(generate_secret)}
POSTGRES_PASSWORD_VALUE=${POSTGRES_PASSWORD_VALUE:-$(generate_secret)}
RUSTFS_SECRET_KEY_VALUE=${RUSTFS_SECRET_KEY_VALUE:-$(generate_secret)}

replace_line "$APP_ENV_FILE" "APP_URL" "$APP_PUBLIC_URL"
replace_line "$APP_ENV_FILE" "INTERNAL_APP_URL" "$INTERNAL_APP_URL_VALUE"
replace_line "$APP_ENV_FILE" "KEY_VAULTS_SECRET" "$KEY_VAULTS_SECRET_VALUE"
replace_line "$APP_ENV_FILE" "AUTH_SECRET" "$AUTH_SECRET_VALUE"
replace_line "$APP_ENV_FILE" "LOBE_DB_NAME" "$LOBE_DB_NAME_VALUE"
replace_line "$APP_ENV_FILE" "POSTGRES_PASSWORD" "$POSTGRES_PASSWORD_VALUE"
replace_line "$APP_ENV_FILE" "S3_ENDPOINT" "$S3_PUBLIC_URL"
replace_line "$APP_ENV_FILE" "RUSTFS_ACCESS_KEY" "$RUSTFS_ACCESS_KEY_VALUE"
replace_line "$APP_ENV_FILE" "RUSTFS_SECRET_KEY" "$RUSTFS_SECRET_KEY_VALUE"
replace_line "$APP_ENV_FILE" "RUSTFS_LOBE_BUCKET" "$RUSTFS_BUCKET_VALUE"

replace_line "$STATE_ENV_FILE" "LOBE_DB_NAME" "$LOBE_DB_NAME_VALUE"
replace_line "$STATE_ENV_FILE" "POSTGRES_PASSWORD" "$POSTGRES_PASSWORD_VALUE"
replace_line "$STATE_ENV_FILE" "RUSTFS_ACCESS_KEY" "$RUSTFS_ACCESS_KEY_VALUE"
replace_line "$STATE_ENV_FILE" "RUSTFS_SECRET_KEY" "$RUSTFS_SECRET_KEY_VALUE"
replace_line "$STATE_ENV_FILE" "RUSTFS_LOBE_BUCKET" "$RUSTFS_BUCKET_VALUE"

log "Generated:"
log "  $APP_ENV_FILE"
log "  $STATE_ENV_FILE"
log ""
log "Review these values before deploy:"
log "  APP_URL=$APP_PUBLIC_URL"
log "  S3_ENDPOINT=$S3_PUBLIC_URL"
log "  LOBE_DB_NAME=$LOBE_DB_NAME_VALUE"
log "  RUSTFS_ACCESS_KEY=$RUSTFS_ACCESS_KEY_VALUE"
log ""
log "Next steps:"
log "  1. Review app/.env and state/.env"
log "  2. Run ./preflight.sh"
log "  3. Start state services and deploy image"
