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
[[ "$previous_image" == *:* && "${previous_image##*:}" == sha-* && "${previous_image##*:}" != 'sha-' ]] || \
  die 'previous image must use a non-empty sha-* tag'

COMHUB_MODULE_WORKER_SKIP_PREVIOUS_IMAGE=true exec "$SCRIPT_DIR/deploy.sh" "$previous_image"
