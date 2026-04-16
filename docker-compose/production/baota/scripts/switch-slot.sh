#!/bin/sh
set -eu

. "$(dirname "$0")/lib.sh"

TARGET_SLOT=${1:-}
if [ -z "$TARGET_SLOT" ]; then
  log "Usage: $0 <blue|green>" >&2
  exit 1
fi

PORT=$(slot_port "$TARGET_SLOT")
mkdir -p "$(dirname "$NGINX_UPSTREAM_FILE")"
cat > "$NGINX_UPSTREAM_FILE" <<EOF
upstream comhub_app {
    server 127.0.0.1:${PORT};
    keepalive 32;
}
EOF

printf '%s\n' "$TARGET_SLOT" > "$ACTIVE_SLOT_FILE"
reload_nginx
record_history "switch active_slot=${TARGET_SLOT} port=${PORT}"
log "Active slot switched to ${TARGET_SLOT} on port ${PORT}"
