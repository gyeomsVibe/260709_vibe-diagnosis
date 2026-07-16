#!/usr/bin/env bash
set -euo pipefail

RUN_SMOKE_TEST="${RUN_SMOKE_TEST:-1}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MCP_SERVER_PATH="${PROJECT_ROOT}/backend/mcp-server/index.js"
CLAUDE_DIR="${VIBE_CHECK_TEST_HOME:-$HOME}/.claude"
SKILL_DIR="${CLAUDE_DIR}/skills/vibe-check"
SKILL_PATH="${SKILL_DIR}/SKILL.md"
CLAUDE_MD_PATH="${CLAUDE_DIR}/CLAUDE.md"

mkdir -p "${SKILL_DIR}"
cp "${SCRIPT_DIR}/.claude/skills/vibe-check/SKILL.md" "${SKILL_PATH}"

SNIPPET="$(cat "${SCRIPT_DIR}/global/CLAUDE.md.snippet")"
START="<!-- VIBE_CHECK_GLOBAL_RULES_START -->"
END="<!-- VIBE_CHECK_GLOBAL_RULES_END -->"

python3 - "$CLAUDE_MD_PATH" "${SCRIPT_DIR}/global/CLAUDE.md.snippet" "$START" "$END" <<'PY'
import re, sys, pathlib
target = pathlib.Path(sys.argv[1])
snippet = pathlib.Path(sys.argv[2]).read_text(encoding="utf-8")
text = target.read_text(encoding="utf-8") if target.exists() else ""
start = sys.argv[3]
end = sys.argv[4]
pattern = re.escape(start) + r".*?" + re.escape(end)
wrapped = start + "\n" + snippet.strip() + "\n" + end
if re.search(pattern, text, flags=re.S):
    text = re.sub(pattern, wrapped, text, flags=re.S)
else:
    text = text.rstrip() + "\n\n" + wrapped + "\n"
target.write_text(text, encoding="utf-8")
PY

if command -v claude >/dev/null 2>&1; then
  if ! claude mcp list 2>/dev/null | grep -q "vibe-clinic"; then
    claude mcp add vibe-clinic -- node "${MCP_SERVER_PATH}"
  fi
else
  echo "WARN: Claude Code CLI not found on PATH. Skill and CLAUDE.md installed; MCP registration skipped."
fi

if [[ "${RUN_SMOKE_TEST}" == "1" ]]; then
  bash "${SCRIPT_DIR}/scripts/verify_vibe_check_temp.sh"
fi

echo "VIBE_CHECK_CLAUDE_CODE_MODE installation/update completed."
echo "Installed skill: ${SKILL_PATH}"
echo "Updated memory: ${CLAUDE_MD_PATH}"
