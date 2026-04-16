#!/bin/sh
set -eu

SYSCTL_FILE=${SYSCTL_FILE:-/etc/sysctl.d/99-comhub-docker-bridge.conf}

require_root() {
  if [ "$(id -u)" -ne 0 ]; then
    printf '%s\n' "This script must be run as root." >&2
    exit 1
  fi
}

require_root

mkdir -p "$(dirname "$SYSCTL_FILE")"
cat > "$SYSCTL_FILE" <<'EOF'
net.bridge.bridge-nf-call-iptables = 0
net.bridge.bridge-nf-call-ip6tables = 0
net.bridge.bridge-nf-call-arptables = 0
EOF

if command -v sysctl >/dev/null 2>&1; then
  sysctl --system
else
  printf '%s\n' "sysctl command not found." >&2
  exit 1
fi

printf '%s\n' "Host bridge sysctl prepared via $SYSCTL_FILE"
