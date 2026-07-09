#!/usr/bin/env bash
set -euo pipefail

TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/vibe-check-claude-XXXXXX")"
cd "${TEMP_DIR}"

npx vibe-diagnosis init
npx vibe-diagnosis run

test -d ".vibe-diagnosis"
echo "Vibe diagnosis temp smoke test completed: ${TEMP_DIR}"
