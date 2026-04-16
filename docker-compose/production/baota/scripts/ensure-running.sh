#!/bin/sh
set -eu

. "$(dirname "$0")/lib.sh"

ensure_prerequisites
ensure_state_up

CURRENT_SLOT=$(active_slot)
load_slot_env "$CURRENT_SLOT"
run_app_compose

if "$(dirname "$0")/healthcheck.sh" "$CURRENT_SLOT"; then
  "$(dirname "$0")/switch-slot.sh" "$CURRENT_SLOT"
  record_history "ensure-running slot=${CURRENT_SLOT} image=${APP_IMAGE}"
else
  exit 1
fi
