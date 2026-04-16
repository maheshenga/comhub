#!/bin/sh
set -eu

. "$(dirname "$0")/lib.sh"

KEEP_LATEST=${KEEP_LATEST:-1}
DRY_RUN=${DRY_RUN:-0}
PRUNE_DANGLING=${PRUNE_DANGLING:-0}

KEEP_FILE=$(mktemp)
REPO_FILE=$(mktemp)

cleanup_tmp() {
  rm -f "$KEEP_FILE" "$REPO_FILE"
}

trap cleanup_tmp EXIT INT TERM

append_unique() {
  TARGET_FILE=$1
  VALUE=$2

  if [ -z "$VALUE" ]; then
    return
  fi

  if ! grep -Fqx "$VALUE" "$TARGET_FILE" 2>/dev/null; then
    printf '%s\n' "$VALUE" >> "$TARGET_FILE"
  fi
}

image_repo() {
  IMAGE_REF=$1

  case "$IMAGE_REF" in
    *@*)
      printf '%s\n' "${IMAGE_REF%@*}"
      ;;
    *:*)
      printf '%s\n' "${IMAGE_REF%:*}"
      ;;
    *)
      printf '%s\n' "$IMAGE_REF"
      ;;
  esac
}

protect_slot_image() {
  SLOT_NAME=$1
  SLOT_FILE=$(slot_env_file "$SLOT_NAME")

  if [ ! -f "$SLOT_FILE" ]; then
    return
  fi

  load_slot_env "$SLOT_NAME"
  append_unique "$KEEP_FILE" "$APP_IMAGE"

  REPO_NAME=$(image_repo "$APP_IMAGE")
  append_unique "$REPO_FILE" "$REPO_NAME"

  if docker image inspect "${REPO_NAME}:latest" >/dev/null 2>&1; then
    append_unique "$KEEP_FILE" "${REPO_NAME}:latest"
  fi
}

remove_image() {
  IMAGE_REF=$1

  if [ "$DRY_RUN" = "1" ]; then
    log "Would delete image $IMAGE_REF"
    return
  fi

  log "Deleting image $IMAGE_REF"
  docker image rm "$IMAGE_REF"
}

protect_slot_image blue
protect_slot_image green

if [ ! -s "$REPO_FILE" ]; then
  log "No managed image repositories discovered under $SLOTS_DIR"
  exit 0
fi

log "Protected image refs:"
cat "$KEEP_FILE"
log ""

while IFS= read -r REPO_NAME; do
  [ -n "$REPO_NAME" ] || continue

  REPO_IMAGES=$(mktemp)
  docker image ls "$REPO_NAME" --format '{{.Repository}}:{{.Tag}}' | awk '!seen[$0]++' > "$REPO_IMAGES"

  log "Scanning repository $REPO_NAME"

  RECENT_KEPT=0
  while IFS= read -r IMAGE_REF; do
    [ -n "$IMAGE_REF" ] || continue
    if [ "${IMAGE_REF##*:}" = "<none>" ]; then
      continue
    fi

    if grep -Fqx "$IMAGE_REF" "$KEEP_FILE" 2>/dev/null; then
      log "Keep protected image $IMAGE_REF"
      continue
    fi

    if [ "$RECENT_KEPT" -lt "$KEEP_LATEST" ]; then
      RECENT_KEPT=$((RECENT_KEPT + 1))
      log "Keep recent image $IMAGE_REF"
      continue
    fi

    remove_image "$IMAGE_REF"
  done < "$REPO_IMAGES"

  rm -f "$REPO_IMAGES"
  log ""
done < "$REPO_FILE"

if [ "$PRUNE_DANGLING" = "1" ]; then
  if [ "$DRY_RUN" = "1" ]; then
    log "Would prune dangling images"
  else
    log "Pruning dangling images"
    docker image prune -f
  fi
fi
