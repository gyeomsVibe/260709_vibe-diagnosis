# VIBE_CHECK_CLAUDE_CODE_MODE

Claude Code용 전역 `vibe-check` 자가진단/교정 모드 패키지입니다.

## 구성

- `.claude/skills/vibe-check/SKILL.md`  
  Claude Code Skill 본문입니다.
- `global/CLAUDE.md.snippet`  
  `~/.claude/CLAUDE.md`에 삽입되는 전역 규칙입니다.
- `install_claude_vibe_check.ps1`  
  Windows/PowerShell 자동 설치 스크립트입니다.
- `install_claude_vibe_check.sh`  
  macOS/Linux/WSL 자동 설치 스크립트입니다.
- `scripts/verify_vibe_check_temp.*`  
  임시 폴더에서 `node ./backend/bin/vibe-clinic.js init/run`을 검증하는 스크립트입니다.

## 에이전트 수행 계약

사용자는 승인만 합니다. Claude Code 에이전트가 아래를 직접 수행합니다.

1. `~/.claude/skills/vibe-check/SKILL.md` 설치 또는 갱신
2. `~/.claude/CLAUDE.md`에 전역 규칙 섹션 삽입 또는 갱신
3. `vibe-clinic` MCP 등록 확인 및 필요 시 등록
4. 임시 프로젝트에서 init/run 검증
5. 6분류 보고

## 금지

- 사용자에게 파일을 직접 열어 붙여넣으라고 지시하지 않습니다.
- 승인 전 `git push`, 배포, `npm publish`, release 생성은 실행하지 않습니다.
- release-ready / production-ready를 선언하지 않습니다.
