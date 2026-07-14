# AGENT_PATCH_QUEUE — 고밀도 패치 큐 작업표

> Antigravity / Claude Code가 순서대로 처리하는 작업표.
> 상태 기준은 `STATE_BOUNDARY.md`를 따른다. (원문: GPT-handoff 패치 큐 문서)

기준일: 2026-07-15

## Vibe Clinic 2.0 Hard Cut

| 작업 | 상태 | 검증 / 비고 |
|---|---|---|
| 프로젝트·CLI·설정 경로 완전 전환 | ✅ 완료 | `vibe-clinic`, `vbc`, `.vibe-clinic/`, `*.clinic.js` |
| MCP 서버·도구명 전환 | ✅ 완료 | `vibe-clinic`, `init_clinic`, `list_clinics`, `run_clinic` |
| VS Code 확장 전환 | ✅ 완료 | `vibe-clinic-vscode` 2.0.0, `vibeClinic.*` 명령 |
| 로컬 MCP 실행 경로 전환 | ✅ 완료 | 비공개 패키지 npx 호출 제거, 로컬 `mcp-server/index.js` 사용 |
| 락파일 정합화 | ✅ 완료 | MCP·VS Code package-lock 모두 2.0.0 |
| 자동 검증 | ✅ 완료 | 단위·통합 테스트 18/18, self 100%, example 3/3, MCP smoke 100% |
| VSIX 재빌드 | ✅ 완료 | `vibe-clinic-vscode-2.0.0.vsix`, 명령·메타데이터·LICENSE·NOTICE 확인 |
| 구 VSIX 물리 삭제 | ✅ 완료 | 승인 후 `vibe-diagnosis-vscode-1.1.4.vsix` 삭제 |
| 환경 비밀 파일 보호 | ✅ 로컬 완료 | 실제 `.env` 내용은 읽지 않고 루트 `.gitignore`에 추가, `.env.example`은 추적 가능 유지. 현재 미커밋 |
| 이전 승인 배치 commit·push | ✅ 완료 | 이전 승인 배치 push 완료, 당시 `HEAD = origin/main` 확인 |

## 대시보드 프리미엄 UX 큐 (3차 — 문서 7~9 사이클)

| 작업 | 상태 | 산출물 / 비고 |
|---|---|---|
| ② 에러 패턴 실패-매핑 필터링 | ✅ 완료 | 실패 진단 ID에 매핑된 패턴만 노출, 청정 상태 빈 메시지 (`src/dashboard.html`) |
| ③ 진단 터미널 로그 뷰 | ✅ 완료 | 실패 카드 아코디언 → 터미널 스타일 로그 박스 |
| ④ AI 치료 코드 디프 뷰어 | ✅ 완료 | `/api/repair`가 originalCode/repairedCode 반환, `computeSimpleDiff` 라인 디프 모달 |
| ① 현대식 폴더 선택기 | ✅ 안정 경로 분리 | `src/folder-picker.ps1` — ASCII 기반 컴파일-프리 IFileOpenDialog 리플렉션, 숨은 owner handle, `-DryRun` 검증. 브라우저에서는 보조 기능이며 직접 경로 입력이 기본 |
| 폴더 선택기 시행착오 완결 보고 3건 | 📕 SUPERSEDED 표기 완료 | 7-3(STA)·7-3(IFileOpenDialog)·8(fosFlags) 완결 보고는 무효 — 문서 9가 대체. 7-1의 ①항목에도 부분 수정 배너 |
| VS Code 네이티브 폴더 선택 | ✅ 구현·문법 검증 | `Vibe Clinic: Open Dashboard for Folder` → `vscode.window.showOpenDialog` 사용 |
| 대시보드 API 보안 회귀 | ✅ 완료 | 외부 Origin 403, 요청 본문 1MiB 제한, 비폴더 경로 거부, 실제 서버 통합 테스트 통과 |
| 폴더 선택 GUI 실클릭 검증 | ⏳ 수동 필요 | 브라우저의 `[📁 Windows 선택기 (보조)]` 선택·취소·전면 표시·잔상 반복 확인. 현재 GUI 제어 도구 미연결 |

## 1.x 패치 이력 (역사 기록 — 재실행 금지)

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
| 1 | GEMINI.md 프로젝트 어댑터 | ✅ 완료 | 루트 `GEMINI.md` — 트리거와 프로젝트 실행 계약만 유지, 전체 절차는 SKILL.md에 보존 |
| 2 | SKILL.md 승인 기반 autorun 확장 | ✅ 완료 | 승인 구조 표, Phase A~E 묶음, `1 failure → 1 cause → smallest fix → re-run → report` 원칙, 보고 6분류 |
| 3 | README(en/ko) 원터치 점검 모드 섹션 | ✅ 완료 | 트리거 3종(짧은/보통/정확한) + 최초 세션 승인 문장 + 금지 목록 |
| 4 | 트리거 문구 정합화 | ✅ 완료 | `npm run sync:rules`는 파일을 쓰지 않고 GEMINI 어댑터 ↔ 로컬 SKILL 트리거만 검증 |
| G | Cleanup + Ledger Reconciliation | ✅ 완료 | 폴더 선택 실험 스크립트는 `research/folder-picker/`에 비실행 자료로 보존, 런타임 소스와 분리 |
| — | Level 4 Hook (자동 재진단: 파일 수정 후/커밋 전) | 🔮 future | MVP 제외 (설계 문서 원칙: 프롬프트 → Skill → GEMINI.md → Hook 순서). 필요 시 별도 설계 |

## 1.x 잔여·검증 기록 (역사 기록 — 재실행 금지)

| 작업 | 이유 | 다음 명령 |
|---|---|---|
| GitHub push (2차 큐 커밋) | ✅ 완료 (2026-07-14 사용자 승인 후 push 완료) | `git push origin main` |
| VSIX 실설치 검증 | ✅ 부분 완료 (2026-07-10, Phase V) — **Antigravity IDE**(Code-OSS 1.107.0)에서 1.1.2 설치 성공. **순정 VS Code는 이 머신에 미설치(CommandNotFound)되어 검증 불가 확인** | 순정 VS Code 검증: VS Code 설치 후 `code --install-extension vscode-extension/vibe-diagnosis-vscode-1.1.4.vsix` |
| VSIX 기능 동작 검증 (Phase V-2) | ✅ CLI 범위 완료 (2026-07-10) — 설치 파일 무결성(수정판 코드 확인), 커맨드 5종 등록 확인, `run --json` 동작(OK/100%), Auto Repair BYOK 미설정 시 안전 차단("BYOK not configured", 실호출 없음), 대시보드 기동+`/api/run` 정상. **GUI 항목(상태바 Health 표시, Command Palette 실행, 확장 activation)은 미실행** | GUI 검증: Antigravity IDE에서 이 프로젝트 열기 → 상태바 확인 → `Vibe Diagnosis: Run` 실행 |
| ⚠️ 확장 npx 폴백 결함 (Phase V-2에서 발견) | ✅ 완료 | `vscode-extension/src/extension.js` 내 npx fallback 명령을 `npx -y --package=vibe-diagnosis vibe-diag`로 수정하여 캐시 유무와 무관하게 정상 작동 확인. VSIX 버전을 1.1.3으로 올림. |
| BYOK 실호출 검증 | 실제 API key 필요 — 금지 조항(키 저장 금지)에 따라 미실행 | 사용자가 대시보드에서 직접 설정 후 Auto Repair 시도 |
| npm publish | 패키지명이 원작자(Rejard) 계정 소유 — publish 불가/금지 | 재배포하려면 스코프 변경(`@gyeomsvibe/...` — npm 스코프는 소문자만 허용) 결정 필요 |
| 구 VSIX(1.0.0~1.1.0) 물리 삭제 | ✅ 완료 (2026-07-14 구버전 1.1.0~1.1.3 삭제 완료, 1.1.4.vsix만 유지) | 사용자 승인 시 삭제 |
