#!/usr/bin/env bash
set -euo pipefail

TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/vibe-check-claude-XXXXXX")"
cd "${TEMP_DIR}"

npx -y --package=vibe-diagnosis vibe-diag init
npx -y --package=vibe-diagnosis vibe-diag run

test -d ".vibe-diagnosis"
echo "Vibe diagnosis temp smoke test completed: ${TEMP_DIR}"
