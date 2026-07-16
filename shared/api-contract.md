# Vibe Clinic API 계약 (단일 진실원, Single Source of Truth)

> **이 문서가 백엔드와 프론트엔드 사이의 유일한 공식 인터페이스 정의다.**
> 양쪽 어느 진영이든 이 계약을 바꾸려면 **이 문서를 먼저 수정·합의**한 뒤
> ① 백엔드 구현 + 계약 테스트(`test/api-contract.test.js`) 갱신 → ② 프론트 반영 순서로 진행한다.
>
> 기준 구현: `src/dashboard.js` (2026-07-16, HEAD 9ad120b 기준 16개 엔드포인트)
> 계약 검증: `npm test` 의 `api-contract.test.js` 가 응답 형태를 자동 검사한다.

## 공통 규약

- 서버는 `127.0.0.1` 에만 바인딩된다 (외부 노출 없음).
- Origin 화이트리스트: 무Origin(직접 호출)·`http://localhost:<port>`·`http://127.0.0.1:<port>`·`vscode-webview://` 계열만 허용. 그 외 및 `Origin: null` → **403** `{ error }`.
- 요청 본문은 JSON, **최대 1MiB** (초과 시 **413**).
- 모든 JSON 응답은 `Content-Type: application/json; charset=utf-8`.
- 실패 응답의 공통 형태는 `{ "error": string }` 이며, 도메인 실패는 `{ "success": false, ... }` 를 함께 쓸 수 있다.

## 진단 (Diagnosis)

### `GET /api/list` — 진단 파일 목록
- 응답 `200`: `Array<{ file, id, name, layer, linkedTask?, valid }>` (빈 배열 가능)

### `POST /api/run` — 전체 진단 실행 (본문 없음)
- 응답 `200`:
```jsonc
{
  "results": [{
    "id": "string", "name": "string", "layer": "TASK|FUNCTION|SYSTEM|UNKNOWN",
    "status": "OK|WARNING|ERROR",
    "details": "string",
    "errorMessage": "string?",           // 스택 (로드/런타임 실패 시)
    "confidence": "CONFIRMED|SUSPECTED?", // 실패 재현성 (P1 Flaky Gate)
    "causeHypotheses": [{ "cause", "likelihood", "signal" }],  // 실패 시 ≤3
    "prescription": "string|string[]?",  // 진단이 스스로 아는 수동 조치
    "duration": 0
  }],
  "summary": { "total": 0, "ok": 0, "warning": 0, "error": 0 },
  "overallStatus": "OK|WARNING|ERROR",
  "healthPercent": 0
}
```
- 진단 파일이 없으면 `results` 에 `id: "_no_diagnostics"` WARNING 플레이스홀더 1건.

### `POST /api/diagnostic/create` — 새 진단 파일 생성
- 요청: `{ id, name, layer, testCode }` — `id` 는 `[a-z0-9-_]+`(대소문자 무관), `testCode` 는 비어 있지 않은 문자열 **필수**
- 응답 `200`: `{ success: true }` / `400`: 필드 누락·형식 위반·중복 id

## 치료 (Treatment) — 안전 파이프라인

### `POST /api/repair/propose` — 치료 제안 생성
- 요청: `{ diagId, strategy? }` — `strategy`: `"auto"`(기본, 로컬 룰 우선) | `"local"`(무AI) | `"ai"`(AI 강제)
- 선행 조건: 같은 서버 세션에서 `POST /api/run` 이 먼저 실행되어야 함 (아니면 `404`)
- 응답 `200` (코드 수정형):
```jsonc
{
  "success": true, "proposalId": "uuid", "diagId": "string",
  "summary": "string", "strategy": "local|ai",
  "assessment": { "filesTouched", "bytes", "reversible", "touchesDiagnostics" },
  "alternatives": ["ai"],               // 로컬 처방이고 BYOK 준비 시
  "originalFiles": [{ "path", "content", "exists", "hash" }],
  "repairedFiles": [{ "path", "content"?, "delete"? }]   // ★ 배열이다 (객체 맵 아님)
}
```
- 응답 `200` (수동 처방형): `{ success: true, kind: "MANUAL", diagId, summary, prescription: string[] }` — 적용 절차 없음, 조치 후 재진단으로 완치 확인
- 응답 `422`: `{ success: false, error, errorCode? }` — `errorCode: "BLOCKED_WEAKENING"` 은 진단 약화 차단

### `POST /api/repair/apply` — 승인 후 적용
- 요청: `{ proposalId }` (제안은 일회용, TTL 10분, 원본 변경 시 stale 거부)
- 응답 `200` (완치):
```jsonc
{ "success": true, "maturity": "VERIFIED_RESULT|APPLIED",
  "diagId", "filesModified": [], "backupFiles": [], "regressions": [],
  "rerunResult": { /* 재진단 결과 */ }, "summary" }
```
- 응답 **`409`** (자동 롤백): `{ "success": false, "maturity": "ROLLED_BACK", "error", "regressions": [{id,status,details}], "rolledBackFiles": [] }`
- ⚠️ **프론트 필수 규칙**: `409` 본문에는 롤백 사유·회귀 목록이 들어 있다. **HTTP 에러라고 본문을 버리면 안 된다** — 반드시 파싱해 `maturity === 'ROLLED_BACK'` 분기를 처리하고 재진단을 갱신할 것. (V2 초기 구현 결함 사례)
- `404`: 제안 없음/만료

### `POST /api/repair/cure-all` — 💉 전체 치료 (배치)
- 요청: `{ strategy? }` (기본 `auto`)
- 응답 `200`:
```jsonc
{ "summary": { "total","cured","rolledBack","manual","blocked","unprescribable","held" },
  "cured": [{ "diagId","healedId","verifiedStatus","summary","filesModified" }],
  "rolledBack": [], "manual": [], "blocked": [], "unprescribable": [], "held": [],
  "finalResults": [ /* 치료 후 전체 진단 결과 */ ] }
```
- **완치(`cured`)는 재진단 OK + 회귀 0 이 검증된 건만** 포함된다 (VERIFIED_RESULT).

### `POST /api/repair` — **폐기됨**
- 항상 `410`: propose → apply 2단계를 사용할 것.

### `GET /api/treatments` — 치료 원장 (P4)
- 응답 `200`: `Array<{ at, diagId, strategy, causes, maturity, success, summary, ... }>` 최신순 (원장 없으면 빈 배열)

## 오류 패턴 (Error Patterns)

### `GET /api/errors` — 목록 (읽기 전용 — **파일을 쓰지 않는다**)
- 응답 `200`: `string[]` (`.md` 파일명)

### `GET /api/errors/<filename>` — 본문
- 응답 `200`: `text/plain` 마크다운 / `404`: 없음 (경로 탈출 차단: basename + `.md` 강제)

## 프로젝트 (Project)

### `GET /api/project/list`
- 응답 `200`: `{ currentProjectDir, projectOptions: [{ name, path }] }`

### `POST /api/project/change`
- 요청: `{ projectDir }` → 응답 `200`: `{ success, currentProjectDir }` / `400`: 없는 경로·폴더 아님

### `POST /api/project/select` — Windows 폴더 선택 GUI (보조)
- 응답 `200`: `{ success: true, selectedPath }` | `{ success: false, cancelled: true }` / `500`: 선택기 실패
- GUI 대화창을 띄우므로 자동화·헤드리스 환경에서 호출 금지.

### `POST /api/project/init` — 진단 도구 설치(초기화)
- 응답 `200`: `{ success, currentProjectDir }` — `.vibe-clinic/` 스캐폴딩 + 예제 패턴 시딩(이 시점에만 쓰기)

### `GET /api/project/explain?force=true` — AI 프로젝트 요약
- 응답 `200`: `{ success: true, summary, techStack, keyFeatures, details, implementationNotes, languages?, isFallback? }`
  또는 `{ success: false, error }` (BYOK 미설정)
- 캐시됨(프로젝트별). `force=true` 로 재생성. AI 실패 시 로컬 휴리스틱 폴백(`isFallback: true`).

## BYOK 설정

### `GET /api/byok/config`
- 응답 `200`: `{ byok: { provider, apiKey /* 마스킹됨: xxxx****xxxx */, model }, providers: [...] }`
- ⚠️ **프론트 필수 규칙**: 마스킹된 `apiKey` 를 입력폼 value 로 되돌려 넣지 말 것.

### `POST /api/byok/save`
- 요청: `{ provider, apiKey, model }` → 응답 `200`: `{ success, byok }`
- **백엔드 보증**: 빈 값·마스킹 패턴(`****`) 키는 기존 실키를 **덮어쓰지 않는다** (키 파괴 방지 가드).

---

# 병렬 작업 소유권 규칙 (B5)

| 영역 | 경로 | 담당 | 규칙 |
|---|---|---|---|
| 백엔드 | `backend/src/`, `backend/bin/`, `backend/mcp-server/`, `backend/test/` | 백엔드 담당 AI 도구 | 프론트 파일 수정 금지 |
| 프론트엔드 | `frontend/` (V2 정식) 및 `frontend/legacy-v1/dashboard-ui/` (V1 보존) | 프론트 담당 AI 도구 | 백엔드 파일 수정 금지. 개발은 `npm run frontend:dev`(vite 프록시 `/api`→7700) 사용 |
| 빌드 산출물 | `backend/src/dist-v2/` | 프론트 빌드가 생성 | 손으로 편집 금지, 프론트 `build` 로만 갱신 |
| **계약(이 문서)** | `shared/api-contract.md` | **공동 소유** | 변경은 문서 선(先)수정·합의 → 백엔드(+계약 테스트) → 프론트 순 |
| 기획 문서 | `# …리브랜딩 구현 계획/` | 공동 (기록) | 번호 증가 방식 유지 |

- 진영별 브랜치 네이밍: `feat/backend-*`, `feat/frontend-*`. 동시 작업 시 같은 파일 편집 금지.
- 계약 위반은 `npm test` 의 계약 테스트가 차단한다. 계약 테스트를 약화시켜 통과시키는 것 금지.
