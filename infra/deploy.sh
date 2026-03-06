#!/usr/bin/env bash
set -euo pipefail

# Usage: ./infra/deploy.sh <env> [--migrate]
# Example: ./infra/deploy.sh qa
#          ./infra/deploy.sh staging --migrate

usage() {
  echo "Usage: $0 <env> [--migrate]"
  echo "  env:       qa | staging"
  echo "  --migrate: run DB migrations after deploy"
  exit "${1:-1}"
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage 0
fi

ENV="${1:?$(usage)}"
shift
MIGRATE=false
for arg in "$@"; do
  case "$arg" in
    --migrate) MIGRATE=true ;;
    *) echo "Unknown option: $arg" >&2; usage ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

CONF_FILE="$SCRIPT_DIR/envs/${ENV}.conf"
FLY_TOML="$REPO_ROOT/fly.toml"
SECRETS_FILE="$REPO_ROOT/.env.${ENV}"

# Validate env name
if [[ "$ENV" != "qa" && "$ENV" != "staging" ]]; then
  echo "Error: env must be 'qa' or 'staging', got '${ENV}'" >&2
  exit 1
fi

# Validate required files
if [[ ! -f "$CONF_FILE" ]]; then
  echo "Error: Config file not found: $CONF_FILE" >&2
  exit 1
fi

if [[ ! -f "$FLY_TOML" ]]; then
  echo "Error: Fly config not found: $FLY_TOML" >&2
  exit 1
fi

# shellcheck source=/dev/null
source "$CONF_FILE"

# Ensure flyctl is available
if ! command -v flyctl &>/dev/null; then
  echo "Error: flyctl not found. Install from https://fly.io/docs/flyctl/install/" >&2
  exit 1
fi

echo "==> Deploying ${ENV} environment: ${APP_NAME}"

# Build NEXT_PUBLIC_* build args from secrets file (if it exists)
BUILD_ARGS=()
if [[ -f "$SECRETS_FILE" ]]; then
  while IFS='=' read -r key value; do
    [[ "$key" =~ ^NEXT_PUBLIC_ ]] && BUILD_ARGS+=(--build-arg "${key}=${value}")
  done < <(grep -E '^NEXT_PUBLIC_[^=]+=.+' "$SECRETS_FILE")
fi

# Deploy using Fly's remote builder (no --local-only; build host is ARM64)
flyctl deploy --config "$FLY_TOML" --app "$APP_NAME" "${BUILD_ARGS[@]}"

echo "==> Deploy complete: ${APP_NAME}"

# Run migrations if requested
if [[ "$MIGRATE" == "true" ]]; then
  if [[ ! -f "$SECRETS_FILE" ]]; then
    echo "Error: Secrets file not found: $SECRETS_FILE (needed for DATABASE_URL)" >&2
    exit 1
  fi

  DATABASE_URL=$(grep -E '^DATABASE_URL=.+' "$SECRETS_FILE" | cut -d= -f2-)
  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "Error: DATABASE_URL not set in $SECRETS_FILE" >&2
    exit 1
  fi

  echo "==> Running DB migrations..."
  DATABASE_URL="$DATABASE_URL" npx tsx lib/db/migrate.ts
  echo "==> Migrations complete."
fi
