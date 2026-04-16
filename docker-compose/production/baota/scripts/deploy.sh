#!/bin/sh
set -eu

. "$(dirname "$0")/lib.sh"

IMAGE_REF=${1:-${APP_IMAGE:-}}
if [ -z "$IMAGE_REF" ]; then
  log "Usage: $0 <image-ref>" >&2
  exit 1
fi

ensure_prerequisites
ensure_dirs

NEXT_SLOT=$(inactive_slot)
NEXT_PORT=$(slot_port "$NEXT_SLOT")

log "Ensuring state services are running"
ensure_state_up

if [ "${SKIP_PULL:-0}" = "1" ]; then
  log "Skipping image pull for $IMAGE_REF"
else
  log "Pulling image $IMAGE_REF"
  docker pull "$IMAGE_REF"
fi

write_slot_env "$NEXT_SLOT" "$IMAGE_REF"
load_slot_env "$NEXT_SLOT"

log "Deploying slot ${APP_SLOT} on port ${APP_PORT}"
run_app_compose

if ! "$(dirname "$0")/healthcheck.sh" "$APP_SLOT"; then
  log "New slot failed health check, printing recent logs" >&2
  (
    cd "$APP_DIR"
    docker compose --project-name "$COMPOSE_PROJECT_NAME" --env-file "$APP_ENV_FILE" logs --tail 200
  ) >&2 || true
  exit 1
fi

"$(dirname "$0")/switch-slot.sh" "$APP_SLOT"
record_history "deploy slot=${APP_SLOT} image=${APP_IMAGE} port=${NEXT_PORT}"
log "Deployment complete: slot=${APP_SLOT} image=${APP_IMAGE}"
