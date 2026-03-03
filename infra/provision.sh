#!/usr/bin/env bash
set -euo pipefail

# Usage: ./infra/provision.sh <env>
# Example: ./infra/provision.sh staging

ENV="${1:?Usage: $0 <env>}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

CONF_FILE="$SCRIPT_DIR/envs/${ENV}.conf"
FLY_TOML="$SCRIPT_DIR/fly.${ENV}.toml"
SECRETS_FILE="$REPO_ROOT/.env.${ENV}"

# Validate required files exist
if [[ ! -f "$CONF_FILE" ]]; then
  echo "Error: Config file not found: $CONF_FILE" >&2
  exit 1
fi

if [[ ! -f "$FLY_TOML" ]]; then
  echo "Error: Fly config not found: $FLY_TOML" >&2
  exit 1
fi

if [[ ! -f "$SECRETS_FILE" ]]; then
  echo "Error: Secrets file not found: $SECRETS_FILE" >&2
  echo "Copy secrets.example to .env.${ENV} and fill in values." >&2
  exit 1
fi

# shellcheck source=/dev/null
source "$CONF_FILE"

echo "==> Provisioning ${ENV} environment: ${APP_NAME}"

# Step 1: Create app if it doesn't exist
if flyctl apps list --json | grep -q "\"${APP_NAME}\""; then
  echo "==> App ${APP_NAME} already exists, skipping creation"
else
  echo "==> Creating app ${APP_NAME} in region ${REGION}"
  flyctl apps create "$APP_NAME" --org personal
fi

# Step 2: Import secrets
echo "==> Importing secrets from ${SECRETS_FILE}"
flyctl secrets import --app "$APP_NAME" < "$SECRETS_FILE"

# Step 3: Deploy
echo "==> Deploying with ${FLY_TOML}"
flyctl deploy --config "$FLY_TOML" --app "$APP_NAME" --region "$REGION" --local-only

# Step 4: Scale
echo "==> Scaling to ${MACHINE_COUNT} x ${MACHINE_SIZE}"
flyctl scale count "$MACHINE_COUNT" --app "$APP_NAME" --yes
flyctl scale vm "$MACHINE_SIZE" --app "$APP_NAME"

echo "==> Done. ${APP_NAME} is live."
