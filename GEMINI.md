# vibe-clinic Project Rules

> Project-scoped adapter for the `vibe-check` skill. Keep the complete diagnostic procedure in the skill, not in this always-loaded file.

## Explicit activation

Activate Vibe Check only when the user explicitly says one of these phrases:

- `이 프로젝트 점검해서 교정해줘` (recommended)
- `원터치 점검해줘`
- `vibe-check 해줘`
- `자가진단 MCP 적용해줘`
- `진단 돌리고 실패한 것 고쳐줘`

Related words or ordinary project work must not activate the mode.

## Project execution contract

- Use the installed `vibe-check` skill and the registered `vibe-clinic` MCP.
- Confirm the repository root and preserve boundaries between the original archive, current worktree, Git remote, VSIX output, `node_modules`, and npm package state.
- If `.vibe-clinic/` is absent, initialize it; otherwise perform only idempotent reinforcement.
- Follow `1 failure -> 1 cause -> smallest fix -> re-run -> report`.
- Check existing error patterns before repair and record reusable patterns after a verified fix.
- Never weaken or edit a diagnostic merely to manufacture a pass.
- Treat Auto Repair as full-file replacement: preserve its `.bak` backup and verify the result by re-running the diagnostic.
- Use the rerun result, not an assertion, as the source of truth for an `OK` status.

## Approval and reporting

- One session approval covers local inspection, local edits, local tests, MCP smoke tests, and local VSIX rebuilds.
- Ask once immediately before dependency installation or packaging commands.
- Require separate explicit approval for `git push`, publication, release creation, deployment, or handling real API keys.
- Report: what ran, what was found, what changed, rerun results, what did not run, and the next approval required.
