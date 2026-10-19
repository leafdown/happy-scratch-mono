#!/usr/bin/env bash
#
# deploy-to-teaching-open.sh — build @lanqu/scratch-gui and deploy the runtime
# artifacts to teaching-open/web/public/scratch3/.
#
# Build outputs (JS bundles, chunks, workers, blocks-media) are deployed to
# both frontends — web/public (legacy Vue) and student-web/public (production)
# — whenever their scratch3/ directories exist.
# The Lanqu-owned host pages (index.html, player.html) and their dependency
# (js/common.js) are now CANONICAL in this repo under deploy/teaching-open/
# and are synced by this script as well — see deploy/teaching-open/README.md.
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
# student-web is the production frontend; it has its own copy of scratch3/
TO_STUDENT_PUBLIC="/Users/felixy/Codes/Teacher/teaching-open/student-web/public"

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

# Deploy the Lanqu runtime build outputs into one frontend's scratch3/ dir.
# web/public (legacy Vue) and student-web/public (production React) keep
# identical build outputs; both are refreshed by this script.
deploy_build_outputs() {
    local PUB="$1"

    # --- JS bundles (root + chunks/ mirrors) ---
    cp "$SRC/gui.js"         "$PUB/scratch3/gui.js"
    cp "$SRC/player.js"      "$PUB/scratch3/player.js"
    cp "$SRC/blocksonly.js"  "$PUB/scratch3/blocksonly.js"
    cp "$SRC/gui.js"         "$PUB/scratch3/chunks/gui.js"
    cp "$SRC/player.js"      "$PUB/scratch3/chunks/player.js"
    cp "$SRC/blocksonly.js"  "$PUB/scratch3/chunks/blocksonly.js"

    # --- extension worker ---
    cp "$SRC/extension-worker.js" "$PUB/scratch3/extension-worker.js"

    # --- fetch-worker (scratch-storage) ---
    cp "$SRC"/chunks/fetch-worker.*.js "$PUB/scratch3/chunks/" 2>/dev/null || true

    # --- blocks media (scratch-blocks toolbox icons) ---
    rm -rf "$PUB/scratch3/static/blocks-media/default" "$PUB/scratch3/static/blocks-media/high-contrast"
    cp -R "$SRC/static/blocks-media/default"       "$PUB/scratch3/static/blocks-media/"
    cp -R "$SRC/static/blocks-media/high-contrast" "$PUB/scratch3/static/blocks-media/"

    # --- tutorial step chunks (am-steps, etc.) — overwrite, keep maps ---
    cp "$SRC"/chunks/*-steps.*.js "$PUB/scratch3/chunks/" 2>/dev/null || true

    # --- lazy chunks: numbered (540 = paper.js) + paper loader chunks ---
    cp "$SRC"/chunks/[0-9]*.js   "$PUB/scratch3/chunks/" 2>/dev/null || true
    cp "$SRC"/chunks/paper-*.js  "$PUB/scratch3/chunks/" 2>/dev/null || true

    # --- mediapipe assets (video sensing face detection) ---
    rm -rf "$PUB/scratch3/chunks/mediapipe"
    cp -R "$SRC/chunks/mediapipe" "$PUB/scratch3/chunks/" 2>/dev/null || true
}

echo "    JS bundles + chunks → web/public (legacy)..."
deploy_build_outputs "$TO_PUBLIC"

if [[ -d "$TO_STUDENT_PUBLIC/scratch3" ]]; then
    echo "    JS bundles + chunks → student-web/public (production)..."
    deploy_build_outputs "$TO_STUDENT_PUBLIC"
fi

# --- fetch-worker also at web/public/chunks/ (vue dev server resolves worker
#     URLs to /chunks/ due to scratch-gui dist's nested publicPath) ---
mkdir -p "$TO_PUBLIC/chunks"
cp "$SRC"/chunks/fetch-worker.*.js "$TO_PUBLIC/chunks/" 2>/dev/null || true

# --- Lanqu-owned host pages (canonical copies live in deploy/teaching-open/) ---
# index.html / player.html carry scratchConfig + backend integration and are NOT
# build outputs; js/common.js (v29) is their hard dependency (getSysConfig fix).
# Sync to both frontends: student-web/public (production) and web/public (legacy).
HOST_SRC="$ROOT/deploy/teaching-open"
if [[ -d "$HOST_SRC" ]]; then
    echo "    host pages (canonical)..."
    for T_PUB in "$TO_STUDENT_PUBLIC" "$TO_PUBLIC"; do
        if [[ -d "$T_PUB/scratch3" ]]; then
            cp "$HOST_SRC/scratch3/index.html"  "$T_PUB/scratch3/index.html"
            cp "$HOST_SRC/scratch3/player.html" "$T_PUB/scratch3/player.html"
            mkdir -p "$T_PUB/js"
            cp "$HOST_SRC/js/common.js"         "$T_PUB/js/common.js"
        fi
    done
else
    echo "    host pages: deploy/teaching-open not found, skipped"
fi

echo ""
echo "=== Deploy complete ==="
echo "Build outputs updated in web/public/scratch3 (legacy) and student-web/public/scratch3 (production)."
echo "Host pages synced from deploy/teaching-open/ (see deploy/teaching-open/README.md)."
echo ""
echo "Next: restart teaching-open dev server (cd web && yarn serve) to verify."
