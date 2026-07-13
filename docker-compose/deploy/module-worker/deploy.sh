#!/usr/bin/env bash
set -Eeuo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly COMPOSE_FILE="$SCRIPT_DIR/compose.yml"
readonly ENV_FILE="$SCRIPT_DIR/.env"
readonly PREVIOUS_IMAGE_FILE="$SCRIPT_DIR/.previous-image"
readonly PROJECT_NAME='comhub-module-worker'
readonly SERVICE='module-app-worker'

die() {
  printf '%s\n' "error: $*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "required command is unavailable: $1"
}

load_environment() {
  [[ -f "$ENV_FILE" ]] || die "missing $ENV_FILE"
  set -a
  # The deployment env file must use shell-compatible KEY=VALUE assignments.
  source "$ENV_FILE"
  set +a
  [[ -n "${DATABASE_URL:-}" ]] || die 'DATABASE_URL must be set in .env'
  [[ -n "${MODULE_APP_ARTIFACT_ROOT:-}" ]] || die 'MODULE_APP_ARTIFACT_ROOT must be set in .env'
}

compose() {
  docker compose --project-name "$PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

require_immutable_image() {
  local image_ref="$1"
  local image_tag="${image_ref##*:}"
  [[ "$image_ref" == *:* && "$image_tag" == sha-* && "$image_tag" != 'sha-' ]] || \
    die 'image must use a non-empty sha-* tag'
}

verify_migration() {
  local column_count
  column_count="$(PGOPTIONS='-c default_transaction_read_only=on' psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc "
    BEGIN READ ONLY;
    SELECT count(*)
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'module_app_builds'
      AND column_name IN ('claim_token', 'claim_expires_at', 'attempt_count', 'next_attempt_at');
    COMMIT;
  ")"
  [[ "$column_count" == '4' ]] || die 'migration 0144 columns are not present'
}

record_current_image() {
  local container_id current_image temporary_file
  [[ "${COMHUB_MODULE_WORKER_SKIP_PREVIOUS_IMAGE:-false}" == 'true' ]] && return
  container_id="$(compose ps -q "$SERVICE" || true)"
  [[ -n "$container_id" ]] || return
  current_image="$(docker inspect --format '{{.Config.Image}}' "$container_id")"
  require_immutable_image "$current_image"
  temporary_file="${PREVIOUS_IMAGE_FILE}.tmp.$$"
  printf '%s\n' "$current_image" >"$temporary_file"
  mv "$temporary_file" "$PREVIOUS_IMAGE_FILE"
}

verify_container() {
  local cap_add cap_drop mounts ports security_opt tmpfs
  container_id="$(compose ps -q "$SERVICE")"
  [[ -n "$container_id" ]] || die 'module-app-worker container was not created'

  [[ "$(docker inspect --format '{{.Config.Image}}' "$container_id")" == "$COMHUB_MODULE_WORKER_IMAGE" ]] || die 'container image does not match requested immutable image'
  [[ "$(docker inspect --format '{{.Config.User}}' "$container_id")" == '10001:10001' ]] || die 'container user must be 10001:10001'
  [[ "$(docker inspect --format '{{.HostConfig.ReadonlyRootfs}}' "$container_id")" == 'true' ]] || die 'container root filesystem must be read-only'
  [[ "$(docker inspect --format '{{.HostConfig.Privileged}}' "$container_id")" == 'false' ]] || die 'container must not be privileged'
  cap_drop="$(docker inspect --format '{{json .HostConfig.CapDrop}}' "$container_id")"
  cap_add="$(docker inspect --format '{{json .HostConfig.CapAdd}}' "$container_id")"
  [[ "$cap_drop" == *'"ALL"'* ]] || die 'container must drop all capabilities'
  [[ "$cap_add" == 'null' || "$cap_add" == '[]' ]] || die 'container must not add capabilities'
  security_opt="$(docker inspect --format '{{json .HostConfig.SecurityOpt}}' "$container_id")"
  [[ "$security_opt" == *'"no-new-privileges:true"'* ]] || die 'container must enable no-new-privileges'
  ports="$(docker inspect --format '{{json .NetworkSettings.Ports}}' "$container_id")"
  [[ "$ports" == 'null' || "$ports" == '{}' ]] || die 'container must not publish ports'
  tmpfs="$(docker inspect --format '{{with index .HostConfig.Tmpfs "/tmp"}}{{.}}{{end}}' "$container_id")"
  [[ "$tmpfs" == *'size='* && "$tmpfs" == *'noexec'* && "$tmpfs" == *'nosuid'* ]] || die 'container tmpfs must be bounded, noexec, and nosuid'
  mounts="$(docker inspect --format '{{range .Mounts}}{{.Type}}|{{.Source}}|{{.Destination}}|{{.RW}}{{"\n"}}{{end}}' "$container_id")"
  [[ "$mounts" == "bind|$MODULE_APP_ARTIFACT_ROOT|/runtime/artifacts|true" ]] || die 'container must have exactly one writable artifact bind'
  [[ "$(docker inspect --format '{{.State.Health.Status}}' "$container_id")" == 'healthy' ]] || die 'container health check is not healthy'

  local flag
  for flag in \
    MODULE_APP_EXECUTION_ENABLED \
    MODULE_APP_RUNTIME_INVOCATION_ENABLED \
    MODULE_APP_WORKFLOW_PRIVILEGED_EXECUTORS_ENABLED \
    MODULE_APP_SCHEDULE_DISPATCH_ENABLED \
    MODULE_APP_ALIPAY_PAYMENT_CREATION_ENABLED \
    MODULE_APP_ALIPAY_AUTO_SETTLEMENT_ENABLED \
    MODULE_APP_PUBLISHER_PAYOUT_RECORDING_ENABLED \
    MODULE_APP_PUBLIC_EXECUTION_ENABLED; do
    docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$container_id" | grep -Fxq "$flag=false" || die "$flag must be false"
  done
}

verify_runtime_artifact_mount() {
  local runtime_ids
  runtime_ids="$(docker ps -aq --filter 'name=module-runtime')"
  [[ -n "$runtime_ids" ]] || return

  while IFS= read -r runtime_id; do
    [[ -n "$runtime_id" ]] || continue
    [[ "$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/runtime/artifacts"}}{{.Type}}|{{.Source}}|{{.Destination}}|{{.RW}}{{end}}{{end}}' "$runtime_id")" == "bind|$MODULE_APP_ARTIFACT_ROOT|/runtime/artifacts|false" ]] || \
      die 'module-runtime artifact mount must share the artifact root read-only'
  done <<<"$runtime_ids"
}

main() {
  [[ $# -eq 1 ]] || die "usage: $0 <immutable-image-ref>"
  require_immutable_image "$1"
  require_command docker
  require_command psql
  load_environment
  export COMHUB_MODULE_WORKER_IMAGE="$1"
  verify_migration
  record_current_image
  compose config --format json >/dev/null
  compose pull "$SERVICE"
  compose up --no-deps --wait "$SERVICE"
  verify_container
  verify_runtime_artifact_mount
  printf '%s\n' 'module-app-worker deployment verified'
}

main "$@"
