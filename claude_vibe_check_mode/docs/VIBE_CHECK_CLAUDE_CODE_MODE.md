# VIBE_CHECK_CLAUDE_CODE_MODE 설계 계획

## 목표

Antigravity에서 검증된 VIBE_CHECK_GLOBAL_AUTORUN_MODE를 Claude Code에 맞게 이식한다.

## Claude Code 대응 구조

| 기능 | Claude Code 구현 |
|---|---|
| 전역 트리거 | `~/.claude/skills/vibe-check/SKILL.md` |
| 전역 규칙 | `~/.claude/CLAUDE.md` |
| MCP 연결 | `claude mcp add vibe-clinic -- node <absolute-path-to-repository>/backend/mcp-server/index.js` |
| 프로젝트별 override | `<project>/.claude/skills/vibe-check/SKILL.md` |
| 상태 기억 | CLAUDE.md + STATE_BOUNDARY.md + AGENT_PATCH_QUEUE.md |
| 자동 검증 | `node ./backend/bin/vibe-clinic.js init/run` 임시 smoke |

## 핵심 차이

Claude Code는 AGENTS.md를 직접 기본 메모리로 읽지 않는다. 따라서 전역 규칙은 `~/.claude/CLAUDE.md`에 넣고, 프로젝트가 AGENTS.md를 쓰는 경우에는 `CLAUDE.md`가 `@AGENTS.md`를 import하도록 한다.

## Phase

1. Skill 설치
2. CLAUDE.md 전역 규칙 삽입
3. MCP 등록
4. 임시 프로젝트 init/run smoke
5. 6분류 보고
6. push/deploy gate는 별도 승인
