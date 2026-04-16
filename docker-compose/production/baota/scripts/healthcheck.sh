#!/bin/sh
set -eu

. "$(dirname "$0")/lib.sh"

TARGET=${1:-}
ATTEMPTS=${ATTEMPTS:-30}
INTERVAL=${INTERVAL:-5}

if [ -z "$TARGET" ]; then
  TARGET=$(active_slot)
fi

case "$TARGET" in
  blue|green)
    PORT=$(slot_port "$TARGET")
    ;;
  *)
    PORT=$TARGET
    ;;
esac

i=1
while [ "$i" -le "$ATTEMPTS" ]; do
  if RESPONSE=$(curl -fsS --max-time 10 "http://127.0.0.1:${PORT}/signin" 2>/dev/null); then
    if printf '%s' "$RESPONSE" | grep -qi '<html'; then
      log "Health check passed on port ${PORT}"
      exit 0
    fi
  fi
  sleep "$INTERVAL"
  i=$((i + 1))
done

log "Health check failed on port ${PORT}" >&2
exit 1
