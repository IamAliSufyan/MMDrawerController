#!/usr/bin/env bash
#
# Builds the PaceBar macOS DMG installer.
#
# Usage:  npm run dmg     (or)   bash scripts/make-dmg.sh
#
# Requirements:
#   - macOS (DMG creation and iconutil are macOS-only)
#   - Node.js + npm
#   - Xcode command line tools (for `iconutil`)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_DIR}"

if [[ "$(uname)" != "Darwin" ]]; then
  echo "Error: PaceBar DMGs can only be built on macOS." >&2
  exit 1
fi

echo "==> Installing dependencies (if needed)..."
if [[ ! -d node_modules ]]; then
  npm install
fi

echo "==> Generating icons (.icns + tray)..."
node scripts/generate-icons.js

echo "==> Building universal DMG with electron-builder..."
npx electron-builder --mac dmg --universal

echo ""
echo "==> Done. Find your DMG in: ${PROJECT_DIR}/dist"
ls -1 dist/*.dmg 2>/dev/null || echo "(No DMG found — check the electron-builder output above.)"
