---
name: vibe-check
description: 원터치 자가진단 점검 모드. "vibe-check 모드로 점검해줘", "자가진단 점검", "프로젝트 점검해서 교정해줘" 요청 시 사용. vibe-diagnosis MCP 도구를 고정된 순서(init → list → run → 최소 수정 → 재run → 에러패턴 기록 → 대시보드)로 실행한다.
---

# vibe-check — 원터치 자가진단 점검 모드

## 정의

"원터치"는 **사용자 입력이 한 번**이라는 뜻이지, 내부 검증 단계가 하나라는 뜻이 아니다.
내부는 아래 다단계를 **항상 같은 순서로** 수행한다.

## 역할 구분 (혼동 금지)

- **MCP** = AI가 누를 수 있는 버튼 묶음. MCP가 코드를 고치는 것이 아니다.
  MCP는 **진단을 실행하고, 교정 흐름을 호출**한다.
- **Runner** = 실제 진단 실행기 (`src/runner.js`)
- **Repairer** = 실패한 파일을 BYOK AI로 고치는 로직 (`src/repairer.js`)
- **Dashboard** = 결과를 보는 화면

## 실행 순서 (고정)

1. **상태 확인** — 프로젝트 루트와 `.vibe-diagnosis/` 존재 여부 확인.
   기준 상태가 헷갈리면 `STATE_BOUNDARY.md`를 먼저 읽는다.
2. **`init_diagnostics`** — 없으면 초기화, 있으면 기존 파일은 건드리지 않고
   `.gitignore`/MCP 설정만 보강된다(멱등).
3. **`list_diagnostics`** — 진단 목록과 스키마 유효성 확인.
4. **`run_diagnostics`** — 전체 진단 실행. `overallStatus`와 `healthPercent` 확보.
5. **실패 분석** — ERROR/WARNING의 `details`를 읽고 원인 후보를 2~3개로 좁힌다.
   `read_error_pattern`으로 과거 동일 패턴이 있는지 먼저 확인한다.
6. **최소 수정** — 진단을 통과시키기 위한 가장 작은 코드 수정만 한다.
   진단 파일(.diag.js)을 약화시켜 통과시키는 것은 금지.
7. **`run_diagnostics` 재실행** — 수정 결과를 재검증한다. OK 판정은 재실행 결과 기준.
8. **`write_error_pattern`** — 반복 가능성이 있는 실패였다면 원인/해결을 기록한다.
   filename은 `ERR_NNN_slug.md` 형식, 경로 구분자 금지.
9. **`open_dashboard`** — 필요 시 대시보드로 결과를 보여준다 (127.0.0.1 전용).

## Auto Repair 경계 (반드시 인지)

- Auto Repair는 **전체 파일 치환** 방식이다 (부분 패치가 아님).
- 수정 전 `.bak` 백업을 만든다.
- 수정 후 해당 진단을 다시 실행한다.
- OK 판정은 **재실행 결과** 기준이다.
- BYOK 미설정 시 Auto Repair는 동작하지 않으며, 에이전트가 직접 최소 수정한다.

## 금지

- 원격 push / publish / 배포·릴리즈 선언 금지 (사용자 승인 필요)
- production-ready 선언 금지
- 실제 API key 요청·저장·출력 금지
- 진단 기준 완화로 "통과 위장" 금지

## 보고 형식

- 변경 파일 / 변경 이유
- 실행한 검증 / 실행하지 못한 검증 (분리 필수)
- 남은 미확인 사항
- 다음 사람이 이어갈 명령
