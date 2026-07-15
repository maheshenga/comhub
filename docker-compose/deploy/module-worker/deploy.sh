#!/usr/bin/env bash
set -Eeuo pipefail

readonly SCRIPT_DIR="$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
readonly COMPOSE_FILE="$SCRIPT_DIR/compose.yml"
readonly ENV_FILE="$SCRIPT_DIR/.env"
readonly PREVIOUS_IMAGE_FILE="$SCRIPT_DIR/.previous-image"
readonly PROJECT_NAME='comhub-module-worker'
readonly SERVICE='module-app-worker'
readonly DOCKER_BIN="${DOCKER_BIN:-docker}"
readonly INSTALL_BIN="${INSTALL_BIN:-install}"
readonly DOCKER_BIN_SCRIPT="${DOCKER_BIN_SCRIPT:-}"
readonly INSTALL_BIN_SCRIPT="${INSTALL_BIN_SCRIPT:-}"
readonly REQUIRED_ENV_KEYS=(
  COMHUB_MODULE_WORKER_PREFLIGHT_DATABASE_URL
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

run_checked() {
  local label="$1"
  shift

  local output status
  set +e
  output="$("$@" 2>&1)"
  status=$?
  set -e

  if [[ "$status" -ne 0 ]]; then
    die "$label failed: $output"
  fi

  [[ -z "$output" ]] || printf '%s\n' "$output"
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
  local column_count migration_status
  set +e
  column_count="$(run_docker run --rm --network host \
    --read-only \
    --cap-drop ALL \
    --security-opt no-new-privileges:true \
    --tmpfs /tmp:size=16m,noexec,nosuid \
    -e 'PGOPTIONS=-c default_transaction_read_only=on' \
    postgres:17-alpine \
    psql "$COMHUB_MODULE_WORKER_PREFLIGHT_DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc "
    BEGIN READ ONLY;
    SELECT count(*)
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'module_app_builds'
      AND column_name IN ('claim_token', 'claim_expires_at', 'attempt_count', 'next_attempt_at');
    COMMIT;
  " 2>&1)"
  migration_status=$?
  set -e
  [[ "$migration_status" -eq 0 ]] || die "migration preflight query failed: $column_count"
  [[ "$column_count" == '4' ]] || die 'migration 0144 columns are not present'
}

ensure_build_lease_migration() {
  local migration_output migration_status
  set +e
  migration_output="$(run_docker run --rm --network host \
    --read-only \
    --cap-drop ALL \
    --security-opt no-new-privileges:true \
    --tmpfs /tmp:size=16m,noexec,nosuid \
    postgres:17-alpine \
    psql "$COMHUB_MODULE_WORKER_PREFLIGHT_DATABASE_URL" -X -v ON_ERROR_STOP=1 -qc '
      ALTER TABLE "module_app_builds" ADD COLUMN IF NOT EXISTS "claim_token" text;
      ALTER TABLE "module_app_builds" ADD COLUMN IF NOT EXISTS "claim_expires_at" timestamp with time zone;
      ALTER TABLE "module_app_builds" ADD COLUMN IF NOT EXISTS "attempt_count" integer DEFAULT 0 NOT NULL;
      ALTER TABLE "module_app_builds" ADD COLUMN IF NOT EXISTS "next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL;
      UPDATE "module_app_builds"
      SET
        "claim_token" = COALESCE("claim_token", '"'legacy-'"' || "id"::text),
        "claim_expires_at" = COALESCE("claim_expires_at", now())
      WHERE "status" = '"'building'"'
        AND ("claim_token" IS NULL OR "claim_expires_at" IS NULL);
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = '"'module_app_builds_attempt_count_check'"'
            AND conrelid = '"'module_app_builds'"'::regclass
        ) THEN
          ALTER TABLE "module_app_builds" ADD CONSTRAINT "module_app_builds_attempt_count_check" CHECK ("attempt_count" >= 0 AND "attempt_count" <= 4);
        END IF;
      END
      $$;
      CREATE INDEX IF NOT EXISTS "module_app_builds_claimable_idx"
        ON "module_app_builds" ("status", "next_attempt_at", "claim_expires_at", "created_at");
    ' 2>&1)"
  migration_status=$?
  set -e
  [[ "$migration_status" -eq 0 ]] || die "migration 0144 repair failed: $migration_output"
}

prepare_artifact_root() {
  [[ "$MODULE_APP_ARTIFACT_ROOT" == /* ]] || die 'MODULE_APP_ARTIFACT_ROOT must be absolute'
  run_install -d -o 10001 -g 10001 -m 0750 -- "$MODULE_APP_ARTIFACT_ROOT"
}

run_install() {
  if [[ -n "$INSTALL_BIN_SCRIPT" ]]; then
    "$INSTALL_BIN" -- "$INSTALL_BIN_SCRIPT" "$@"
    return
  fi

  "$INSTALL_BIN" "$@"
}

resolve_symlink_target() {
  local link_path="$1"
  local link_directory link_name raw_target target_directory target_name target_path
  link_directory="$(cd -P "$(dirname "$link_path")" && pwd -P)" || \
    die "symlink directory is unavailable: $link_path"
  link_name="$(basename "$link_path")"
  raw_target="$(readlink "$link_directory/$link_name")" || \
    die "failed to read symlink target: $link_path"
  [[ -n "$raw_target" ]] || die "symlink target must not be empty: $link_path"

  if [[ "$raw_target" == /* ]]; then
    target_path="$raw_target"
  else
    target_path="$link_directory/$raw_target"
  fi

  target_directory="$(cd -P "$(dirname "$target_path")" && pwd -P)" || \
    die "symlink target directory is unavailable: $link_path"
  target_name="$(basename "$target_path")"
  [[ -n "$target_name" && "$target_name" != '.' && "$target_name" != '..' ]] || \
    die "symlink target must name a file: $link_path"
  printf '%s/%s\n' "$target_directory" "$target_name"
}

resolve_state_directory() {
  local resolved_env
  if [[ -L "$ENV_FILE" ]]; then
    resolved_env="$(resolve_symlink_target "$ENV_FILE")"
    [[ "$(basename "$resolved_env")" == '.env' ]] || \
      die 'release .env symlink must resolve to the root .env file'
    dirname "$resolved_env"
    return
  fi

  cd -P "$SCRIPT_DIR" && pwd -P
}

sync_file_if_supported() {
  local file_path="$1"
  if command -v sync >/dev/null 2>&1 && sync --help 2>&1 | grep -q -- '--file-system'; then
    sync -f "$file_path"
  fi
}

record_current_image() {
  local container_id current_image intended_state_directory previous_image_target temporary_file
  [[ "${COMHUB_MODULE_WORKER_SKIP_PREVIOUS_IMAGE:-false}" == 'true' ]] && return
  container_id="$(compose ps -q "$SERVICE" || true)"
  [[ -n "$container_id" ]] || return
  current_image="$(run_docker inspect --format '{{.Config.Image}}' "$container_id")"
  require_immutable_image "$current_image"

  previous_image_target="$PREVIOUS_IMAGE_FILE"
  if [[ -L "$PREVIOUS_IMAGE_FILE" ]]; then
    previous_image_target="$(resolve_symlink_target "$PREVIOUS_IMAGE_FILE")"
    intended_state_directory="$(resolve_state_directory)"
    [[ "$(dirname "$previous_image_target")" == "$intended_state_directory" ]] || \
      die 'previous image target must remain within the intended root state directory'
    [[ "$(basename "$previous_image_target")" == '.previous-image' ]] || \
      die 'previous image target must remain the root .previous-image file'
    [[ ! -L "$previous_image_target" ]] || \
      die 'resolved previous image target must not be another symlink'
  fi

  temporary_file="${previous_image_target}.tmp.$$"
  if ! printf '%s\n' "$current_image" >"$temporary_file"; then
    rm -f -- "$temporary_file"
    die 'failed to write previous image state'
  fi
  if ! sync_file_if_supported "$temporary_file"; then
    rm -f -- "$temporary_file"
    die 'failed to sync previous image state'
  fi
  if ! mv -Tf -- "$temporary_file" "$previous_image_target"; then
    rm -f -- "$temporary_file"
    die 'failed to atomically replace previous image state'
  fi
}

verify_container() {
  local cap_add cap_drop container_id container_lookup_status mounts ports security_opt tmpfs
  set +e
  container_id="$(compose ps -q "$SERVICE" 2>&1)"
  container_lookup_status=$?
  set -e
  [[ "$container_lookup_status" -eq 0 ]] || \
    die "module-app-worker container lookup failed: $container_id"
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
  require_command "$INSTALL_BIN"
  load_environment
  export COMHUB_MODULE_WORKER_IMAGE="$1"
  ensure_build_lease_migration
  verify_migration
  prepare_artifact_root
  record_current_image
  compose config --format json >/dev/null
  run_checked 'compose pull' compose pull "$SERVICE"
  run_checked 'compose up' compose up --no-deps --wait "$SERVICE"
  verify_container
  verify_runtime_artifact_mount
  printf '%s\n' 'module-app-worker deployment verified'
}

main "$@"
