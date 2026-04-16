#!/bin/sh
set -eu

. "$(dirname "$0")/lib.sh"

TARGET_SLOT=${1:-$(inactive_slot)}

case "$TARGET_SLOT" in
  blue|green) ;;
  *)
    log "Usage: $0 [blue|green]" >&2
    exit 1
    ;;
esac

ensure_prerequisites
load_slot_env "$TARGET_SLOT"

log "Rehydrating slot ${APP_SLOT} from ${APP_IMAGE}"
ensure_state_up
run_app_compose

"$(dirname "$0")/healthcheck.sh" "$APP_SLOT"
"$(dirname "$0")/switch-slot.sh" "$APP_SLOT"
record_history "rollback slot=${APP_SLOT} image=${APP_IMAGE}"
log "Rollback complete: slot=${APP_SLOT} image=${APP_IMAGE}"
