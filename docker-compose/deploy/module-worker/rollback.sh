#!/usr/bin/env bash
set -Eeuo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PREVIOUS_IMAGE_FILE="$SCRIPT_DIR/.previous-image"

die() {
  printf '%s\n' "error: $*" >&2
  exit 1
}

[[ -s "$PREVIOUS_IMAGE_FILE" ]] || die "missing previous immutable image: $PREVIOUS_IMAGE_FILE"
previous_image="$(<"$PREVIOUS_IMAGE_FILE")"
previous_image_tag="${previous_image##*:}"
if [[ ! "$previous_image" =~ ^[^[:space:]@]+@sha256:[0-9a-f]{64}$ ]]; then
  [[ "$previous_image" != *'@'* && "$previous_image" == *:* && \
    "$previous_image_tag" == sha-* && "$previous_image_tag" != 'sha-' ]] || \
    die 'previous image must use a sha256 digest or non-empty sha-* tag'
fi

COMHUB_MODULE_WORKER_SKIP_PREVIOUS_IMAGE=true exec "$SCRIPT_DIR/deploy.sh" "$previous_image"
