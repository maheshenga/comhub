#!/usr/bin/env bash
set -Eeuo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly COMPOSE_FILE="$SCRIPT_DIR/compose.yml"
readonly ENV_FILE="$SCRIPT_DIR/.env"
readonly PREVIOUS_IMAGE_FILE="$SCRIPT_DIR/.previous-image"
readonly PROJECT_NAME='comhub-module-worker'
readonly SERVICE='module-app-worker'
readonly DOCKER_BIN="${DOCKER_BIN:-docker}"
readonly PSQL_BIN="${PSQL_BIN:-psql}"
readonly DOCKER_BIN_SCRIPT="${DOCKER_BIN_SCRIPT:-}"
readonly PSQL_BIN_SCRIPT="${PSQL_BIN_SCRIPT:-}"
readonly REQUIRED_ENV_KEYS=(
  DATABASE_URL
  MODULE_APP_ARTIFACT_ROOT
  S3_ACCESS_KEY_ID
  S3_BUCKET
  S3_ENDPOINT
  S3_SECRET_ACCESS_KEY
)
readonly OPTIONAL_ENV_KEYS=(
  COMHUB_PLATFORM_COMPOSE_PROJECT
)

die() {
  printf '%s\n' "error: $*" >&2
  exit 1
}

require_command() {
  if [[ "$1" == */* || "$1" == *:\\* || "$1" == *:/* ]]; then
    [[ -e "$1" ]] || die "required command is unavailable: $1"
    return
  fi
  command -v "$1" >/dev/null 2>&1 || die "required command is unavailable: $1"
}

is_env_key() {
  local candidate="$1"
  local key
  for key in "${REQUIRED_ENV_KEYS[@]}" "${OPTIONAL_ENV_KEYS[@]}"; do
    [[ "$candidate" == "$key" ]] && return 0
  done
  return 1
}

assign_env_value() {
  local key="$1"
  local raw_value="$2"
  local value="$raw_value"

  case "$raw_value" in
    \"*\")
      value="${raw_value:1:${#raw_value}-2}"
      ;;
    \'*\')
      value="${raw_value:1:${#raw_value}-2}"
      ;;
    \"*|\'*)
      die "unsupported quoted value for $key in $ENV_FILE"
      ;;
  esac

  [[ -n "$value" ]] || die "$key must be set in .env"
  printf -v "$key" '%s' "$value"
  export "$key"
}

load_environment() {
  local line key raw_value potential_key
  local -A seen=()

  [[ -f "$ENV_FILE" ]] || die "missing $ENV_FILE"

  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ "$line" =~ ^[[:space:]]*$ ]] && continue
    [[ "$line" =~ ^[[:space:]]*# ]] && continue

    if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      key="${BASH_REMATCH[1]}"
      raw_value="${BASH_REMATCH[2]}"
      is_env_key "$key" || continue
      assign_env_value "$key" "$raw_value"
      seen["$key"]=1
      continue
    fi

    potential_key="${line%%=*}"
    potential_key="${potential_key//[[:space:]]/}"
    if is_env_key "$potential_key"; then
      die "unsupported dotenv syntax for $potential_key in $ENV_FILE"
    fi
  done < "$ENV_FILE"

  for key in "${REQUIRED_ENV_KEYS[@]}"; do
    [[ -n "${seen[$key]:-}" ]] || die "$key must be set in .env"
  done

  COMHUB_PLATFORM_COMPOSE_PROJECT="${COMHUB_PLATFORM_COMPOSE_PROJECT:-comhub}"
  [[ "$COMHUB_PLATFORM_COMPOSE_PROJECT" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || \
    die 'COMHUB_PLATFORM_COMPOSE_PROJECT must match [a-z0-9][a-z0-9_-]*'
  export COMHUB_PLATFORM_COMPOSE_PROJECT
}

compose() {
  run_docker compose --project-name "$PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

run_docker() {
  if [[ -n "$DOCKER_BIN_SCRIPT" ]]; then
    "$DOCKER_BIN" -- "$DOCKER_BIN_SCRIPT" "$@"
    return
  fi

  "$DOCKER_BIN" "$@"
}

require_immutable_image() {
  local image_ref="$1"
  local image_tag="${image_ref##*:}"
  [[ "$image_ref" == *:* && "$image_tag" == sha-* && "$image_tag" != 'sha-' ]] || \
    die 'image must use a non-empty sha-* tag'
}

verify_migration() {
  local column_count
  column_count="$(PGOPTIONS='-c default_transaction_read_only=on' run_psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc "
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

run_psql() {
  if [[ -n "$PSQL_BIN_SCRIPT" ]]; then
    "$PSQL_BIN" -- "$PSQL_BIN_SCRIPT" "$@"
    return
  fi

  "$PSQL_BIN" "$@"
}

record_current_image() {
  local container_id current_image temporary_file
  [[ "${COMHUB_MODULE_WORKER_SKIP_PREVIOUS_IMAGE:-false}" == 'true' ]] && return
  container_id="$(compose ps -q "$SERVICE" || true)"
  [[ -n "$container_id" ]] || return
  current_image="$(run_docker inspect --format '{{.Config.Image}}' "$container_id")"
  require_immutable_image "$current_image"
  temporary_file="${PREVIOUS_IMAGE_FILE}.tmp.$$"
  printf '%s\n' "$current_image" >"$temporary_file"
  mv "$temporary_file" "$PREVIOUS_IMAGE_FILE"
}

verify_container() {
  local cap_add cap_drop mounts ports security_opt tmpfs
  container_id="$(compose ps -q "$SERVICE")"
  [[ -n "$container_id" ]] || die 'module-app-worker container was not created'

  [[ "$(run_docker inspect --format '{{.Config.Image}}' "$container_id")" == "$COMHUB_MODULE_WORKER_IMAGE" ]] || die 'container image does not match requested immutable image'
  [[ "$(run_docker inspect --format '{{.Config.User}}' "$container_id")" == '10001:10001' ]] || die 'container user must be 10001:10001'
  [[ "$(run_docker inspect --format '{{.HostConfig.ReadonlyRootfs}}' "$container_id")" == 'true' ]] || die 'container root filesystem must be read-only'
  [[ "$(run_docker inspect --format '{{.HostConfig.Privileged}}' "$container_id")" == 'false' ]] || die 'container must not be privileged'
  cap_drop="$(run_docker inspect --format '{{json .HostConfig.CapDrop}}' "$container_id")"
  cap_add="$(run_docker inspect --format '{{json .HostConfig.CapAdd}}' "$container_id")"
  [[ "$cap_drop" == *'"ALL"'* ]] || die 'container must drop all capabilities'
  [[ "$cap_add" == 'null' || "$cap_add" == '[]' ]] || die 'container must not add capabilities'
  security_opt="$(run_docker inspect --format '{{json .HostConfig.SecurityOpt}}' "$container_id")"
  [[ "$security_opt" == *'"no-new-privileges:true"'* ]] || die 'container must enable no-new-privileges'
  ports="$(run_docker inspect --format '{{json .NetworkSettings.Ports}}' "$container_id")"
  [[ "$ports" == 'null' || "$ports" == '{}' ]] || die 'container must not publish ports'
  tmpfs="$(run_docker inspect --format '{{with index .HostConfig.Tmpfs "/tmp"}}{{.}}{{end}}' "$container_id")"
  [[ "$tmpfs" == *'size='* && "$tmpfs" == *'noexec'* && "$tmpfs" == *'nosuid'* ]] || die 'container tmpfs must be bounded, noexec, and nosuid'
  mounts="$(run_docker inspect --format '{{range .Mounts}}{{.Type}}|{{.Source}}|{{.Destination}}|{{.RW}}{{"\n"}}{{end}}' "$container_id")"
  [[ "$mounts" == "bind|$MODULE_APP_ARTIFACT_ROOT|/runtime/artifacts|true" ]] || die 'container must have exactly one writable artifact bind'
  [[ "$(run_docker inspect --format '{{.State.Health.Status}}' "$container_id")" == 'healthy' ]] || die 'container health check is not healthy'

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
    run_docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$container_id" | grep -Fxq "$flag=false" || die "$flag must be false"
  done
}

verify_runtime_artifact_mount() {
  local runtime_id
  local -a runtime_ids

  mapfile -t runtime_ids < <(
    run_docker ps \
      --filter 'status=running' \
      --filter "label=com.docker.compose.project=$COMHUB_PLATFORM_COMPOSE_PROJECT" \
      --filter 'label=com.docker.compose.service=module-runtime' \
      --format '{{.ID}}'
  )

  runtime_ids=("${runtime_ids[@]/#/}")
  runtime_ids=("${runtime_ids[@]/%/}")
  runtime_ids=("${runtime_ids[@]}")

  local -a non_empty_runtime_ids=()
  for runtime_id in "${runtime_ids[@]}"; do
    [[ -n "$runtime_id" ]] && non_empty_runtime_ids+=("$runtime_id")
  done

  case "${#non_empty_runtime_ids[@]}" in
    0)
      return
      ;;
    1)
      runtime_id="${non_empty_runtime_ids[0]}"
      ;;
    *)
      die 'expected at most one running compose-managed module-runtime container'
      ;;
  esac

  [[ "$(run_docker inspect --format '{{range .Mounts}}{{if eq .Destination "/runtime/artifacts"}}{{.Type}}|{{.Source}}|{{.Destination}}|{{.RW}}{{end}}{{end}}' "$runtime_id")" == "bind|$MODULE_APP_ARTIFACT_ROOT|/runtime/artifacts|false" ]] || \
    die 'module-runtime artifact mount must share the artifact root read-only'
}

main() {
  [[ $# -eq 1 ]] || die "usage: $0 <immutable-image-ref>"
  require_immutable_image "$1"
  require_command "$DOCKER_BIN"
  require_command "$PSQL_BIN"
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
