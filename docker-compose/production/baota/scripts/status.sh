#!/bin/sh
set -eu

. "$(dirname "$0")/lib.sh"

CURRENT_SLOT=$(active_slot)

slot_summary() {
  SLOT_NAME=$1
  SLOT_FILE=$(slot_env_file "$SLOT_NAME")

  if [ ! -f "$SLOT_FILE" ]; then
    printf '%s\tmissing\n' "$SLOT_NAME"
    return
  fi

  load_slot_env "$SLOT_NAME"

  SLOT_ROLE=inactive
  if [ "$SLOT_NAME" = "$CURRENT_SLOT" ]; then
    SLOT_ROLE=active
  fi

  HEALTH_STATUS=unhealthy
  if ATTEMPTS=1 INTERVAL=0 "$(dirname "$0")/healthcheck.sh" "$SLOT_NAME" >/dev/null 2>&1; then
    HEALTH_STATUS=healthy
  fi

  printf '%s\t%s\tport=%s\timage=%s\thealth=%s\n' \
    "$SLOT_NAME" \
    "$SLOT_ROLE" \
    "$APP_PORT" \
    "$APP_IMAGE" \
    "$HEALTH_STATUS"
}

log "Base directory: $BASE_DIR"
log "Active slot: $CURRENT_SLOT"
log ""
log "Slots:"
slot_summary blue
slot_summary green
log ""
log "Containers:"
if ! docker ps --format '{{.Names}}|{{.Image}}|{{.Status}}' | grep '^comhub-'; then
  log "No running comhub containers"
fi
log ""
log "Nginx upstream:"
if [ -f "$NGINX_UPSTREAM_FILE" ]; then
  cat "$NGINX_UPSTREAM_FILE"
else
  log "Missing file: $NGINX_UPSTREAM_FILE"
fi
log ""
log "Recent history:"
if [ -f "$HISTORY_FILE" ]; then
  tail -n 10 "$HISTORY_FILE"
else
  log "No history yet"
fi
