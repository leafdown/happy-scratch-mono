#!/usr/bin/env bash
#
# deploy-to-teaching-open.sh — build @lanqu/scratch-gui and deploy the runtime
# artifacts to teaching-open/web/public/scratch3/.
#
# Only build outputs (JS bundles, blocks-media, fetch-worker) are overwritten.
# Lanqu-owned files (index.html, player.html, static/json_index, avatar, etc.)
# are preserved — they hold the scratchConfig and backend integration.
#
# Usage:
#   ./scripts/deploy-to-teaching-open.sh                  # build + deploy
#   ./scripts/deploy-to-teaching-open.sh --no-build       # deploy existing build only

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

DO_BUILD="yes"
[[ "${1:-}" == "--no-build" ]] && DO_BUILD="no"

# teaching-open scratch3 target (sibling of happy-scratch-mono under Teacher/)
TO_SCRATCH3="/Users/felixy/Codes/Teacher/teaching-open/web/public/scratch3"
TO_PUBLIC="/Users/felixy/Codes/Teacher/teaching-open/web/public"

if [[ ! -d "$TO_SCRATCH3" ]]; then
    echo "Target not found: $TO_SCRATCH3"
    echo "Is teaching-open checked out at /Users/felixy/Codes/Teacher/teaching-open?"
    exit 1
fi

# --- node env ---
if [[ -f "$HOME/.nvm/nvm.sh" ]]; then
    # shellcheck disable=SC1091
    source "$HOME/.nvm/nvm.sh"
fi
if command -v nvm >/dev/null 2>&1; then
    nvm use 24.16.0 2>/dev/null || nvm use "$(cat .nvmrc)" 2>/dev/null || true
fi

# --- 1. build ---
if [[ "$DO_BUILD" == "no" ]]; then
    echo ">>> Skipping build (--no-build)"
else
    export HTTP_PROXY="${HTTP_PROXY:-http://127.0.0.1:7897}"
    export HTTPS_PROXY="${HTTPS_PROXY:-http://127.0.0.1:7897}"
    export NODE_USE_ENV_PROXY="${NODE_USE_ENV_PROXY:-1}"

    echo ">>> [1/3] Building scratch-gui dist (standalone)..."
    rm -rf packages/scratch-gui/node_modules/.cache node_modules/.cache
    npm run build:dist-standalone --workspace=@scratch/scratch-gui

    echo ">>> [2/3] Building lanqu-scratch-gui..."
    (cd packages/lanqu-scratch-gui && rm -rf node_modules/.cache build && npx webpack)
fi

SRC="packages/lanqu-scratch-gui/build"

echo ">>> [3/3] Deploying to teaching-open..."

# --- JS bundles (root + chunks/) ---
echo "    JS bundles..."
cp "$SRC/gui.js"         "$TO_SCRATCH3/gui.js"
cp "$SRC/player.js"      "$TO_SCRATCH3/player.js"
cp "$SRC/blocksonly.js"  "$TO_SCRATCH3/blocksonly.js"
cp "$SRC/gui.js"         "$TO_SCRATCH3/chunks/gui.js"
cp "$SRC/player.js"      "$TO_SCRATCH3/chunks/player.js"
cp "$SRC/blocksonly.js"  "$TO_SCRATCH3/chunks/blocksonly.js"

# --- extension worker ---
cp "$SRC/extension-worker.js" "$TO_SCRATCH3/extension-worker.js"

# --- fetch-worker (scratch-storage) → scratch3/chunks/ ---
cp "$SRC"/chunks/fetch-worker.*.js "$TO_SCRATCH3/chunks/" 2>/dev/null || true

# --- fetch-worker also at web/public/chunks/ (vue dev server resolves worker
#     URLs to /chunks/ due to scratch-gui dist's nested publicPath) ---
mkdir -p "$TO_PUBLIC/chunks"
cp "$SRC"/chunks/fetch-worker.*.js "$TO_PUBLIC/chunks/" 2>/dev/null || true

# --- blocks media (scratch-blocks toolbox icons) ---
echo "    blocks-media..."
rm -rf "$TO_SCRATCH3/static/blocks-media/default" "$TO_SCRATCH3/static/blocks-media/high-contrast"
cp -R "$SRC/static/blocks-media/default"       "$TO_SCRATCH3/static/blocks-media/"
cp -R "$SRC/static/blocks-media/high-contrast" "$TO_SCRATCH3/static/blocks-media/"

# --- tutorial step chunks (am-steps, etc.) — overwrite, keep maps ---
echo "    tutorial chunks..."
cp "$SRC"/chunks/*-steps.*.js "$TO_SCRATCH3/chunks/" 2>/dev/null || true

echo ""
echo "=== Deploy complete ==="
echo "Build outputs updated in $TO_SCRATCH3"
echo "Lanqu-owned files (index.html, scratchConfig, static/json_index, etc.) preserved."
echo ""
echo "Next: restart teaching-open dev server (cd web && yarn serve) to verify."
