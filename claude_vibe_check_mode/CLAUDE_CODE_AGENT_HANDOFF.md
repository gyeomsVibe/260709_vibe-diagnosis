# Claude Code Agent Handoff

VIBE_CHECK_CLAUDE_CODE_MODE를 설치/갱신한다.

## 수행 계약

사용자는 승인만 한다. 에이전트가 직접 수행한다.

## Windows

PowerShell에서 다음 스크립트를 에이전트가 실행한다.

```powershell
powershell -ExecutionPolicy Bypass -File .\install_claude_vibe_check.ps1
```

## macOS / Linux / WSL

```bash
bash ./install_claude_vibe_check.sh
```

## 완료 보고

1. 실행한 것
2. 발견한 것
3. 수정한 것
4. 다시 실행한 검증
5. 아직 실행하지 않은 것
6. 다음 승인 필요 항목

## 금지

- 사용자에게 수동 복붙 지시 금지
- 승인 전 git push 금지
- 승인 전 배포 금지
- npm publish 금지
- release-ready / production-ready 선언 금지
