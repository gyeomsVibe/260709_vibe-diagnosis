# AGENT_PATCH_QUEUE — 고밀도 패치 큐 작업표

> Antigravity / Claude Code가 순서대로 처리하는 작업표.
> 상태 기준은 `STATE_BOUNDARY.md`를 따른다. (원문: GPT-handoff 패치 큐 문서)

기준일: 2026-07-09

## 큐 상태

| 우선순위 | 작업 | 상태 | 산출물 / 비고 |
|---|---|---|---|
| P0 | 증거 상태 분리 (ZIP/작업트리/원격/VSIX/node_modules) | ✅ 완료 | `STATE_BOUNDARY.md` |
| P1 | MCP 실행 경로 고정 (원터치 순서) | ✅ 완료 | `.claude/skills/vibe-check/SKILL.md`, `.gemini/settings.json` 로컬 실행으로 정합화 |
| P2 | mcp-server 락파일 drift | ✅ 완료 | `vibe-diagnosis`를 `file:..` 로컬 링크로 전환, lock 재생성, node_modules의 npm 구버전(1.0.0) 제거 |
| P2 | vscode-extension 락파일 drift | ✅ 완료 | lock을 1.1.1로 재생성 |
| P2 | VSIX 재빌드 | ✅ 완료 | `vibe-diagnosis-vscode-1.1.1.vsix` (현재 소스 기준, publisher=gyeoms-vibe). 1.1.0 이하는 배포 제외(수정 전 코드 포함) |
| P3 | CLI help `--cwd` 문구 | ✅ 완료 | `bin/vibe-diag.js` — Options 섹션으로 분리, `vibe-diag run --cwd` 예시 명시 |
| P3 | README `.vsix` 파일명 갱신 | ✅ 완료 | README.md / README.ko.md → 1.1.1 |
| P4 | Repairer 동작 경계 문서화 | ✅ 완료 | README BYOK 섹션에 4원칙(전체 파일 치환 / .bak 백업 / 재실행 / OK=재실행 기준) 명기 |
| — | init 멱등 보강 | ✅ 완료 | 기존 `.vibe-diagnosis` 존재 시에도 gitignore/MCP 설정 보강 (파일은 안 건드림). MCP `init_diagnostics`도 동일 동작 |

## 남은 큐 (미착수 / 별도 결정 필요)

| 작업 | 이유 | 다음 명령 |
|---|---|---|
| GitHub push | 패치 큐 원칙상 push 금지 — 사용자 승인 후 진행 | `git push origin main` |
| VSIX 실설치 검증 | 자동화 불가 — VS Code에서 수동 설치 필요 | `Ctrl+Shift+P` → Install from VSIX → `vibe-diagnosis-vscode-1.1.1.vsix` |
| BYOK 실호출 검증 | 실제 API key 필요 — 금지 조항(키 저장 금지)에 따라 미실행 | 사용자가 대시보드에서 직접 설정 후 Auto Repair 시도 |
| npm publish | 패키지명이 원작자(Rejard) 계정 소유 — publish 불가/금지 | 재배포하려면 스코프 변경(`@gyeoms-vibe/...`) 결정 필요 |
| 구 VSIX(1.0.0~1.1.0) 물리 삭제 | 증거 보존 중 (git 미추적) | 사용자 승인 시 삭제 |
