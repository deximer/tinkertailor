#!/usr/bin/env bash
set -euo pipefail

# Usage: ./infra/seed-qa.sh [--db-only | --storage-only | --help]
# Copies all DB tables and Supabase Storage from staging to QA.

usage() {
  echo "Usage: $0 [--db-only | --storage-only | --help]"
  echo ""
  echo "Copies all DB tables and Supabase Storage from staging to QA."
  echo ""
  echo "Options:"
  echo "  --db-only        Copy database only, skip storage"
  echo "  --storage-only   Copy storage only, skip database"
  echo "  --help, -h       Show this help"
  echo ""
  echo "Reads credentials from .env.staging and .env.qa in the repo root."
  echo ""
  echo "Note: Supabase Auth users are not copied. Create QA accounts manually."
  exit "${1:-0}"
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage 0
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

STAGING_ENV="$REPO_ROOT/.env.staging"
QA_ENV="$REPO_ROOT/.env.qa"

if [[ ! -f "$STAGING_ENV" ]]; then
  echo "Error: $STAGING_ENV not found" >&2; exit 1
fi
if [[ ! -f "$QA_ENV" ]]; then
  echo "Error: $QA_ENV not found" >&2; exit 1
fi

extract() {
  grep -E "^${2}=" "$1" | cut -d= -f2-
}

export STAGING_DATABASE_URL=$(extract "$STAGING_ENV" DATABASE_URL)
export STAGING_SUPABASE_URL=$(extract "$STAGING_ENV" NEXT_PUBLIC_SUPABASE_URL)
export STAGING_SERVICE_ROLE_KEY=$(extract "$STAGING_ENV" SUPABASE_SERVICE_ROLE_KEY)

export QA_DATABASE_URL=$(extract "$QA_ENV" DATABASE_URL)
export QA_SUPABASE_URL=$(extract "$QA_ENV" NEXT_PUBLIC_SUPABASE_URL)
export QA_SERVICE_ROLE_KEY=$(extract "$QA_ENV" SUPABASE_SERVICE_ROLE_KEY)

missing=()
[[ -z "${STAGING_DATABASE_URL:-}" ]]     && missing+=("DATABASE_URL in .env.staging")
[[ -z "${STAGING_SUPABASE_URL:-}" ]]     && missing+=("NEXT_PUBLIC_SUPABASE_URL in .env.staging")
[[ -z "${STAGING_SERVICE_ROLE_KEY:-}" ]] && missing+=("SUPABASE_SERVICE_ROLE_KEY in .env.staging")
[[ -z "${QA_DATABASE_URL:-}" ]]          && missing+=("DATABASE_URL in .env.qa")
[[ -z "${QA_SUPABASE_URL:-}" ]]          && missing+=("NEXT_PUBLIC_SUPABASE_URL in .env.qa")
[[ -z "${QA_SERVICE_ROLE_KEY:-}" ]]      && missing+=("SUPABASE_SERVICE_ROLE_KEY in .env.qa")

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "Error: missing required values:" >&2
  for m in "${missing[@]}"; do echo "  - $m" >&2; done
  exit 1
fi

cd "$REPO_ROOT"
# Force IPv4 — Supabase direct connections have AAAA records but this host can't reach IPv6
NODE_OPTIONS="${NODE_OPTIONS:-} --dns-result-order=ipv4first" npx tsx scripts/seed-qa-from-staging.ts "$@"
