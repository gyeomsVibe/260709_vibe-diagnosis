#!/usr/bin/env bash
set -euo pipefail

TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/vibe-check-claude-XXXXXX")"
cd "${TEMP_DIR}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_PATH="${SCRIPT_DIR}/../../backend/bin/vibe-clinic.js"

node "${BIN_PATH}" init
node "${BIN_PATH}" run

test -d ".vibe-clinic"
echo "Vibe Clinic temp smoke test completed: ${TEMP_DIR}"
