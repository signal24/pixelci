#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

API_PID=""

cleanup() {
    if [ -n "$API_PID" ]; then
        kill "$API_PID" 2>/dev/null || true
    fi
}
trap cleanup EXIT

echo "==> Building API..."
cd "$ROOT_DIR/packages/api"
yarn build

echo "==> Running migrations..."
APP_ENV=development node dist/src/index.js migration:run

echo "==> Seeding E2E test data..."
node tests/scripts/seed-e2e.mjs

# Start API server if one isn't already running
if ! curl --max-time 3 -so /dev/null http://localhost:7924/healthz 2>/dev/null; then
    echo "==> Starting API server..."
    APP_ENV=development node dist/src/index.js server:start &
    API_PID=$!

    ELAPSED=0
    until curl --max-time 3 -so /dev/null http://localhost:7924/healthz 2>/dev/null; do
        if ! kill -0 "$API_PID" 2>/dev/null; then
            echo "ERROR: API server exited unexpectedly."
            exit 1
        fi
        ELAPSED=$((ELAPSED + 1))
        if [ "$ELAPSED" -ge 30 ]; then
            echo "ERROR: API server did not become ready within 30s."
            exit 1
        fi
        sleep 1
    done
    echo "==> API server ready."
else
    echo "==> API server already running."
fi

echo "==> Generating OpenAPI client..."
cd "$ROOT_DIR/packages/ui"
npx generate-openapi-client

# In CI, build the UI into packages/api/static/ so the API server can serve it
if [ "${CI:-}" = "true" ]; then
    echo "==> Building UI..."
    yarn build
fi

echo "==> Running E2E tests..."
yarn test:e2e
