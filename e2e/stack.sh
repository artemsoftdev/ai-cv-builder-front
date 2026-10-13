#!/usr/bin/env bash
# Runs the full stack for the browser tests from a scratch copy, so the API's own .env is never used.
set -euo pipefail

FRONT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="$(cd "${API_DIR:-$FRONT_DIR/../ai-cv-builder-api}" && pwd)"
STACK_DIR="${E2E_STACK_DIR:-${TMPDIR:-/tmp}/cvb-e2e-stack}"
COMPOSE=(docker compose -p cvb-e2e -f "$STACK_DIR/ai-cv-builder-api/docker-compose.yml")

copy() {
  mkdir -p "$2"
  rsync -a --delete \
    --include=.env.example --exclude='.env*' \
    --exclude=.git --exclude=node_modules --exclude=.next --exclude=dist --exclude=coverage \
    --exclude=test-results --exclude=playwright-report --exclude='*.tsbuildinfo' \
    "$1/" "$2/"
}

case "${1:-}" in
  up)
    copy "$API_DIR" "$STACK_DIR/ai-cv-builder-api"
    copy "$FRONT_DIR" "$STACK_DIR/ai-cv-builder-front"
    sed -e 's/^LLM_PROVIDER=.*/LLM_PROVIDER=fake/' \
      -e "s/^FAKE_LLM_DELAY_MS=.*/FAKE_LLM_DELAY_MS=${FAKE_LLM_DELAY_MS:-1500}/" \
      "$STACK_DIR/ai-cv-builder-api/.env.example" >"$STACK_DIR/ai-cv-builder-api/.env"
    "${COMPOSE[@]}" up -d --build --wait
    ;;
  down)
    "${COMPOSE[@]}" down -v
    ;;
  logs)
    "${COMPOSE[@]}" logs --no-color
    ;;
  *)
    echo "usage: $0 up|down|logs" >&2
    exit 64
    ;;
esac
