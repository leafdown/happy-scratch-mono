#!/usr/bin/env bash
#
# upgrade-from-upstream.sh — sync @lanqu/scratch-gui fork with scratchfoundation/scratch-editor
#
# Usage:
#   ./scripts/upgrade-from-upstream.sh                 # upgrade from upstream/14.1.x
#   ./scripts/upgrade-from-upstream.sh 14.x            # upgrade from a different upstream branch
#   ./scripts/upgrade-from-upstream.sh 14.1.x --no-build  # skip rebuild/verify
#
# What it does:
#   1. fetch upstream release branch
#   2. create a backup branch (safety net)
#   3. rebase local patch commits onto upstream
#   4. on conflict: stop and print guidance (resolve, then `git rebase --continue`)
#   5. clear webpack caches, rebuild scratch-gui dist + lanqu-scratch-gui
#   6. print verification checklist
#
# Patches are additive (new optional props/params, default behavior unchanged),
# so conflicts are usually just context shifts — see packages/scratch-gui/PATCHES.md.

set -euo pipefail

# --- config ---
BRANCH="${1:-14.1.x}"
DO_BUILD="yes"
[[ "${2:-}" == "--no-build" ]] && DO_BUILD="no"

# Resolve repo root (this script lives in happy-scratch-mono/scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
REMOTE_UPSTREAM="upstream"

echo "=== Upgrade from upstream/${BRANCH} ==="
echo "Current branch: ${CURRENT_BRANCH}"
echo ""

# --- preflight: node version (project requires node 24) ---
if [[ -f "$HOME/.nvm/nvm.sh" ]] && ! command -v node >/dev/null 2>&1; then
    # shellcheck disable=SC1091
    source "$HOME/.nvm/nvm.sh"
fi
if command -v nvm >/dev/null 2>&1; then
    nvm use 24.16.0 2>/dev/null || nvm use "$(cat .nvmrc)" 2>/dev/null || true
fi
echo "node: $(node -v 2>/dev/null || echo 'not found — build step will need node 24')"
echo "npm:  $(npm -v 2>/dev/null || echo 'not found')"
echo ""

# --- 1. fetch upstream ---
echo ">>> [1/5] Fetching upstream ${BRANCH}..."
git fetch "${REMOTE_UPSTREAM}" "${BRANCH}"

UPSTREAM_REF="${REMOTE_UPSTREAM}/${BRANCH}"
UPSTREAM_TIP="$(git rev-parse --short "${UPSTREAM_REF}")"
echo "    upstream/${BRANCH} tip: ${UPSTREAM_TIP}"
echo ""

# --- 2. backup ---
BACKUP="backup/pre-upgrade-$(date +%Y%m%d-%H%M%S 2>/dev/null || echo 'manual')"
# date may be unavailable in some sandboxes; fall back to a counter
if git show-ref --verify --quiet "refs/heads/${BACKUP}" 2>/dev/null; then
    BACKUP="backup/pre-upgrade-manual-$$"
fi
echo ">>> [2/5] Creating backup branch: ${BACKUP}"
git branch "${BACKUP}" "${CURRENT_BRANCH}"
echo "    (restore with: git reset --hard ${BACKUP})"
echo ""

# --- 3. rebase ---
echo ">>> [3/5] Rebasing ${CURRENT_BRANCH} onto ${UPSTREAM_REF}..."
if ! git rebase "${UPSTREAM_REF}"; then
    echo ""
    echo "!!! CONFLICT detected. Resolve each conflict, then:"
    echo "    git add <resolved-files>"
    echo "    git rebase --continue"
    echo ""
    echo "    To abort and return to pre-upgrade state:"
    echo "    git rebase --abort"
    echo "    git reset --hard ${BACKUP}"
    echo ""
    echo "    Patch reference: packages/scratch-gui/PATCHES.md"
    exit 1
fi
echo "    rebase OK — patches replayed onto ${UPSTREAM_TIP}"
echo ""

# --- 4. rebuild ---
if [[ "$DO_BUILD" == "no" ]]; then
    echo ">>> [4/5] Skipping build (--no-build)"
    echo ">>> [5/5] Skipping verify (--no-build)"
    echo ""
    echo "=== Done (build skipped). Rebuilt HEAD:"
    git log --oneline -3
    exit 0
fi

echo ">>> [4/5] Clearing webpack caches and rebuilding..."
# proxy env for any external fetches during build (microbit hex etc.)
export HTTP_PROXY="${HTTP_PROXY:-http://127.0.0.1:7897}"
export HTTPS_PROXY="${HTTPS_PROXY:-http://127.0.0.1:7897}"
export NODE_USE_ENV_PROXY="${NODE_USE_ENV_PROXY:-1}"

rm -rf packages/scratch-gui/node_modules/.cache node_modules/.cache \
       packages/lanqu-scratch-gui/node_modules/.cache packages/lanqu-scratch-gui/build

echo "    building scratch-gui dist (standalone)..."
npm run build:dist-standalone --workspace=@scratch/scratch-gui

echo "    building lanqu-scratch-gui..."
(cd packages/lanqu-scratch-gui && npx webpack)
echo ""

# --- 5. verify checklist ---
echo ">>> [5/5] Build complete. Verify manually:"
echo "    npm start --workspace=@lanqu/scratch-gui   # then open http://localhost:8602/index.html"
echo "    Check: customButtons render, window.scratch.* APIs (16), window.vm exposed."
echo ""
echo "=== Upgrade complete ==="
echo "Rebased HEAD:"
git log --oneline -3
echo ""
echo "Next: push with  git push origin ${CURRENT_BRANCH}:main --force-with-lease"
echo "      (force-with-lease is required because history was rewritten by rebase)"
echo "Backup branch ${BACKUP} kept until you delete it:  git branch -D ${BACKUP}"
