#!/bin/sh
set -eu

. "$(dirname "$0")/lib.sh"

IMAGE_REF=${1:-${APP_IMAGE:-}}
AUTO_INIT_ENV=${AUTO_INIT_ENV:-1}
RUN_PREPARE_HOST=${RUN_PREPARE_HOST:-0}

if [ -z "$IMAGE_REF" ]; then
  log "Usage: $0 <image-ref>" >&2
  exit 1
fi

APP_ENV_EXISTS=0
STATE_ENV_EXISTS=0

[ -f "$APP_ENV_FILE" ] && APP_ENV_EXISTS=1
[ -f "$STATE_ENV_FILE" ] && STATE_ENV_EXISTS=1

if [ "$APP_ENV_EXISTS" -eq 0 ] && [ "$STATE_ENV_EXISTS" -eq 0 ]; then
  if [ "$AUTO_INIT_ENV" != "1" ]; then
    log "ERROR: app/.env and state/.env are missing. Run ./init-env.sh first or set AUTO_INIT_ENV=1." >&2
    exit 1
  fi

  log "No env files found. Generating fresh app/.env and state/.env"
  "$(dirname "$0")/init-env.sh"
elif [ "$APP_ENV_EXISTS" -ne "$STATE_ENV_EXISTS" ]; then
  log "ERROR: app/.env and state/.env are inconsistent. Either provide both files or remove both and rerun." >&2
  exit 1
else
  log "Using existing env files"
fi

if [ "$RUN_PREPARE_HOST" = "1" ]; then
  log "Running host bridge preparation"
  "$(dirname "$0")/prepare-host.sh"
fi

log "Initializing runtime directories"
"$(dirname "$0")/install.sh"

log "Running preflight checks"
"$(dirname "$0")/preflight.sh"

log "Starting state services"
ensure_state_up

log "Deploying first application release"
"$(dirname "$0")/deploy.sh" "$IMAGE_REF"

log "Printing deployment status"
"$(dirname "$0")/status.sh"
