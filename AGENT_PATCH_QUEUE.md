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
| P2 | vscode-extension 락파일 drift | ✅ 완료 | lock을 1.1.2로 재생성 |
| P2 | VSIX 재빌드 | ✅ 완료 | `vibe-diagnosis-vscode-1.1.3.vsix` (현재 소스 기준, publisher=gyeomsVibe). 1.1.2 이하는 배포 제외(1.1.2는 npx fallback 버그 포함) |
| P3 | CLI help `--cwd` 문구 | ✅ 완료 | `bin/vibe-diag.js` — Options 섹션으로 분리, `vibe-diag run --cwd` 예시 명시 |
| P3 | README `.vsix` 파일명 갱신 | ✅ 완료 | README.md / README.ko.md → 1.1.3 |
| P4 | Repairer 동작 경계 문서화 | ✅ 완료 | README BYOK 섹션에 4원칙(전체 파일 치환 / .bak 백업 / 재실행 / OK=재실행 기준) 명기 |
| — | init 멱등 보강 | ✅ 완료 | 기존 `.vibe-diagnosis` 존재 시에도 gitignore/MCP 설정 보강 (파일은 안 건드림). MCP `init_diagnostics`도 동일 동작 |

## VIBE_CHECK_AUTORUN_MODE 큐 (2차 — 승인 기반 자동 실행 모드)

> 원문: GPT-handoff "vibe-check mode 승인 기반 자동 실행 모드" 문서 1·2

| Phase | 작업 | 상태 | 산출물 / 비고 |
|---|---|---|---|
| 1 | GEMINI.md 신규 (Antigravity/Gemini Level 3 규칙) | ✅ 완료 | 루트 `GEMINI.md` — 트리거 4종, 승인 구조 3단계, Behavior 12단계, Never 목록 |
| 2 | SKILL.md 승인 기반 autorun 확장 | ✅ 완료 | 승인 구조 표, Phase A~E 묶음, `1 failure → 1 cause → smallest fix → re-run → report` 원칙, 보고 6분류 |
| 3 | README(en/ko) 원터치 점검 모드 섹션 | ✅ 완료 | 트리거 3종(짧은/보통/정확한) + 최초 세션 승인 문장 + 금지 목록 |
| 4 | 트리거 문구 정합화 | ✅ 완료 | SKILL.md ↔ GEMINI.md ↔ README 동일 트리거 세트 |
| G | Cleanup + Ledger Reconciliation | ✅ 완료 | 임시 스크립트(.ps1) 및 test-vibe 삭제, task/walkthrough 갱신 |
| — | Level 4 Hook (자동 재진단: 파일 수정 후/커밋 전) | 🔮 future | MVP 제외 (설계 문서 원칙: 프롬프트 → Skill → GEMINI.md → Hook 순서). 필요 시 별도 설계 |

## 남은 큐 (미착수 / 별도 결정 필요)

| 작업 | 이유 | 다음 명령 |
|---|---|---|
| GitHub push (2차 큐 커밋) | ✅ 완료 (2026-07-14 사용자 승인 후 push 완료) | `git push origin main` |
| VSIX 실설치 검증 | ✅ 부분 완료 (2026-07-10, Phase V) — **Antigravity IDE**(Code-OSS 1.107.0)에서 1.1.2 설치 성공. **순정 VS Code는 이 머신에 미설치(CommandNotFound)되어 검증 불가 확인** | 순정 VS Code 검증: VS Code 설치 후 `code --install-extension vscode-extension/vibe-diagnosis-vscode-1.1.4.vsix` |
| VSIX 기능 동작 검증 (Phase V-2) | ✅ CLI 범위 완료 (2026-07-10) — 설치 파일 무결성(수정판 코드 확인), 커맨드 5종 등록 확인, `run --json` 동작(OK/100%), Auto Repair BYOK 미설정 시 안전 차단("BYOK not configured", 실호출 없음), 대시보드 기동+`/api/run` 정상. **GUI 항목(상태바 Health 표시, Command Palette 실행, 확장 activation)은 미실행** | GUI 검증: Antigravity IDE에서 이 프로젝트 열기 → 상태바 확인 → `Vibe Diagnosis: Run` 실행 |
| ⚠️ 확장 npx 폴백 결함 (Phase V-2에서 발견) | ✅ 완료 | `vscode-extension/src/extension.js` 내 npx fallback 명령을 `npx -y --package=vibe-diagnosis vibe-diag`로 수정하여 캐시 유무와 무관하게 정상 작동 확인. VSIX 버전을 1.1.3으로 올림. |
| BYOK 실호출 검증 | 실제 API key 필요 — 금지 조항(키 저장 금지)에 따라 미실행 | 사용자가 대시보드에서 직접 설정 후 Auto Repair 시도 |
| npm publish | 패키지명이 원작자(Rejard) 계정 소유 — publish 불가/금지 | 재배포하려면 스코프 변경(`@gyeomsvibe/...` — npm 스코프는 소문자만 허용) 결정 필요 |
| 구 VSIX(1.0.0~1.1.0) 물리 삭제 | ✅ 완료 (2026-07-14 구버전 1.1.0~1.1.3 삭제 완료, 1.1.4.vsix만 유지) | 사용자 승인 시 삭제 |
