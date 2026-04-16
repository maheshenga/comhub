#!/bin/sh
set -eu

. "$(dirname "$0")/lib.sh"

ensure_prerequisites
ensure_dirs
mkdir -p "$BASE_DIR/acme/.well-known/acme-challenge"

if command -v sysctl >/dev/null 2>&1; then
  BRIDGE_FILTER_OK=1
  for key in \
    net.bridge.bridge-nf-call-iptables \
    net.bridge.bridge-nf-call-ip6tables \
    net.bridge.bridge-nf-call-arptables
  do
    if [ "$(sysctl -n "$key" 2>/dev/null || printf '1')" != "0" ]; then
      BRIDGE_FILTER_OK=0
      break
    fi
  done

  if [ "$BRIDGE_FILTER_OK" -ne 1 ]; then
    log "Warning: bridge netfilter is enabled on this host."
    log "If containers on comhub-internal return 'Host is unreachable', run ./prepare-host.sh as root."
  fi
fi

if [ ! -f "$ACTIVE_SLOT_FILE" ]; then
  printf '%s\n' blue > "$ACTIVE_SLOT_FILE"
fi

if [ ! -f "$NGINX_UPSTREAM_FILE" ]; then
  mkdir -p "$(dirname "$NGINX_UPSTREAM_FILE")"
  cat > "$NGINX_UPSTREAM_FILE" <<EOF
upstream comhub_app {
    server 127.0.0.1:${BLUE_PORT};
    keepalive 32;
}
EOF
fi

record_history "install initialized base directories"
log "Initialized runtime under $RUNTIME_DIR"
