# 🩺 vibe-diagnosis

**바이브코딩 프로젝트를 위한 자가 진단 프레임워크**

AI 에이전트와 함께 코딩할 때, "지금 이 프로젝트가 정상인가?"를 코드로 증명합니다.

> **핵심 원칙 — Task ↔ Diagnostic 1:1 매핑**: 작업(Task)이 완료되면, 그 작업이 정상 동작함을 검증하는 진단(Diagnostic)이 반드시 함께 생성되어야 합니다.

[English README](./README.md)

---

## 🚀 빠른 시작 (MCP — 가장 쉬움)

AI 도구의 설정 파일에 아래 JSON을 추가하면 끝입니다.

### 1. MCP 설정 추가

아래 JSON을 AI 도구의 설정 파일에 추가하세요:

| AI 도구 | 설정 파일 경로 |
|---|---|
| **Gemini** (Antigravity 2.0) | `.gemini/settings.json` (프로젝트) 또는 `~/.gemini/config/mcp_config.json` (글로벌) |
| **Claude Desktop** | `%APPDATA%/Claude/claude_desktop_config.json` (Win) · `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac) |
| **Cursor** | `.cursor/mcp.json` |
| **Windsurf** | `~/.codeium/windsurf/mcp_config.json` |

```json
{
  "mcpServers": {
    "vibe-diagnosis": {
      "command": "npx",
      "args": ["-y", "vibe-diagnosis-mcp"]
    }
  }
}
```

### 2. AI에게 말하기

> "자가진단 MCP 적용해줘"

끝. AI가 알아서 초기화하고, 진단 파일을 생성하고, 대시보드를 열어줍니다.

---

## 💬 빠른 트리거

MCP가 설치된 상태에서 AI에게 짧게 말하면 자동으로 실행됩니다:

| 말하기 | 실행 결과 |
|---|---|
| "자가진단 MCP 적용해줘" | `init_diagnostics` → 초기화 + 진단 생성 + 대시보드 |
| "자가진단 실행해줘" | `run_diagnostics` → 전체 진단 실행 |
| "자가진단 대시보드 열어줘" | `open_dashboard` → 브라우저에서 대시보드 |
| "진단 돌려줘" | `run_diagnostics` → 결과 요약 |

### 사용 흐름 예시

```
사용자: "자가진단 MCP 적용해줘"
   AI: → init_diagnostics          ← .vibe-diagnosis/ 생성
   AI: → .diag.js 파일 자동 생성    ← 기존 코드 분석
   AI: → open_dashboard            ← 브라우저에서 http://localhost:7700 열림
   AI: → run_diagnostics           ← Health 100% ✅
```

---

## 📦 CLI

```bash
npx vibe-diag init                        # .vibe-diagnosis/ 초기화 + MCP 자동 설정
npx vibe-diag run                         # 모든 진단 실행
npx vibe-diag run --json                  # JSON 출력 (CI/CD용)
npx vibe-diag dashboard                   # 웹 대시보드 열기
npx vibe-diag config get                  # BYOK 설정 확인
npx vibe-diag config set provider openai  # AI 프로바이더 설정
npx vibe-diag config set apiKey sk-...    # API 키 설정
npx vibe-diag config set model gpt-4o     # 모델명 설정
npx vibe-diag repair <diagId>             # 특정 진단 AI 자동 수리
npx vibe-diag repair --all                # 실패한 모든 진단 자동 수리
npm run sync:rules                        # GEMINI.md ↔ SKILL.md 규칙 동기화
```

> **`init` 참고:** `init`은 `.vibe-diagnosis/` 생성 외에도 프로젝트의 `.gemini/settings.json`을 생성/수정하여 MCP 서버(`mcpServers`의 `vibe-diagnosis` 항목)를 등록합니다. 이미 `vibe-diagnosis` 항목이 있으면 건드리지 않습니다. 또한 `.vibe-diagnosis/config.json`을 `.gitignore`에 추가합니다.

### 진단 파일 작성

`.vibe-diagnosis/diagnostics/`에 `.diag.js` 파일을 생성합니다:

```js
module.exports = {
  id: 'task-001-user-login',
  name: 'User Login Flow',
  layer: 'TASK',              // TASK | FUNCTION | SYSTEM
  linkedTask: 'TASK-001',

  async run(ctx) {
    const auth = require('../src/auth');
    const result = auth.login('test@test.com', 'password123');

    if (!result.token) {
      return { status: 'ERROR', details: 'Login did not return token' };
    }
    return { status: 'OK', details: 'Login flow verified' };
  }
};
```

**선택 필드:** `linkedTask`(이 진단이 검증하는 Task id)와 `timeout`(진단별 제한 시간, 밀리초 단위, 기본값 `30000`). 진단이 제한 시간을 초과하면 전체 실행을 멈추지 않고 해당 진단만 `ERROR`로 보고됩니다.

### 출력 예시

```
  Vibe Diagnosis v1.1.0 — my-project
  ─────────────────────────────────────────

  TASK │ task-001-user-login       │ ✅ OK      │ Login flow verified
  FUNC │ func-auth-token           │ ✅ OK      │ JWT validation passed
  SYS  │ sys-database              │ ⚠️ WARNING │ Connection pool at 80%

  ─────────────────────────────────────────
  Total: 3 nodes │ OK: 2 │ WARN: 1 │ ERR: 0
  Overall: ⚠️ WARNING — Health 67%
```

---

## 🖥️ 웹 대시보드

```bash
npx vibe-diag dashboard            # http://localhost:7700
npx vibe-diag dashboard --port 8080
```

대시보드 서버는 `127.0.0.1`에만 바인딩되므로 네트워크의 다른 기기에는 노출되지 않습니다.

기능:
- **한국어 로컬라이징(한글화)**: UI 및 동적 복구 프로세스 한글 피드백 완벽 제공
- Health 링 게이지 (건강도 퍼센트)
- 진단 카드 그리드 (레이어별 색상 구분)
- "Run Diagnostics" 원클릭 진단 버튼
- 에러 패턴 모달 뷰어
- 다크모드 프리미엄 UI
- BYOK 설정 바 (Provider / API Key / Model)
- ERROR/WARNING 카드의 Auto Repair 버튼
- AI 연결 상태 인디케이터

---

## 🤖 BYOK 자동 수리

**Bring Your Own Key** — 자신의 AI API 키를 연결하여 실패한 진단을 자동으로 분석하고 수리합니다.

벤더 종속 없음. API 키는 로컬에만 저장되며, 선택한 프로바이더 외에는 어디에도 전송되지 않습니다.

### 지원 프로바이더

| 프로바이더 | 모델 예시 |
|---|---|
| **OpenAI** | `gpt-4o`, `gpt-4o-mini` |
| **Anthropic** | `claude-sonnet-4-20250514`, `claude-3-5-haiku-20241022` |
| **Google Gemini** | `gemini-2.5-flash`, `gemini-2.5-pro` |
| **OpenRouter** | OpenRouter에서 제공하는 모든 모델 |

### 대시보드 설정

대시보드를 열고 상단의 BYOK 설정 바를 사용합니다:

1. 드롭다운에서 **Provider** 선택
2. **API Key** 입력
3. **Model** 이름 입력 (예: `gpt-4o-mini`)
4. **Save** 클릭 — 설정이 `.vibe-diagnosis/config.json`에 로컬 저장됩니다

설정 완료 후, ERROR/WARNING 진단 카드에 **Auto Repair** 버튼이 표시됩니다. 클릭하면 AI가 자동으로 문제를 분석하고 수리합니다.

### Auto Repair 동작 경계

- Auto Repair는 **전체 파일 치환** 방식입니다 — AI가 부분 패치가 아닌 파일 전체 내용을 반환합니다.
- 변경 전 각 파일의 **`.bak` 백업**을 먼저 생성합니다.
- 변경 적용 후 해당 진단을 **자동으로 재실행**합니다.
- 성공 판정은 AI의 주장이 아니라 **재실행 결과(`status === 'OK'`) 기준**입니다.

### 환경변수 오버라이드

CI/CD나 팀 공유 환경에서는 환경변수로 설정할 수도 있습니다:

```bash
export VIBE_DIAG_PROVIDER=openai      # openai | anthropic | gemini | openrouter
export VIBE_DIAG_API_KEY=sk-...
export VIBE_DIAG_MODEL=gpt-4o          # 선택사항
```

환경변수는 `config.json` 설정보다 우선합니다.

### 보안

- API 키는 `.vibe-diagnosis/config.json`에 로컬 저장
- `config.json`은 `init` 시 자동으로 `.gitignore`에 추가
- 키는 로그에 기록되거나 제3자에게 전송되거나 진단 출력에 포함되지 않음

---

## 🧩 VS Code 확장

VS Code 확장 마켓플레이스에서 `vibe-diagnosis` 검색, 또는 `.vsix`로 설치:

1. `Ctrl+Shift+P` → "Install from VSIX..."
2. `vibe-diagnosis-vscode-1.1.2.vsix` 선택

**커맨드:**
- `Vibe Diagnosis: Run` — 진단 실행
- `Vibe Diagnosis: Init` — 프로젝트 초기화
- `Vibe Diagnosis: Open Dashboard` — 대시보드 열기
- `Vibe Diagnosis: Auto Repair` — AI 자동 수리 (실패한 진단 선택 → 수리)
- Status Bar에 건강도 퍼센트 표시

---

## 🤖 MCP 도구 목록

| 도구 | 설명 |
|---|---|
| `run_diagnostics` | 프로젝트 진단 실행 → JSON 결과 반환 |
| `init_diagnostics` | .vibe-diagnosis/ 초기화 |
| `list_diagnostics` | 진단 파일 목록 + 메타데이터 조회 |
| `read_error_pattern` | 과거 에러 패턴 로그 읽기 |
| `write_error_pattern` | 새 에러 패턴 기록 |
| `open_dashboard` | 웹 대시보드 열기 |

---

## 🔁 원터치 점검 모드 (VIBE_CHECK_AUTORUN_MODE)

승인 기반 자동 실행 모드입니다. 사용자는 세션을 **한 번만 승인**하고, 에이전트가 **초기화 → 진단 → 최소 수정 → 재진단 → 분리 보고** 루프를 스스로 수행합니다. 규칙은 [.claude/skills/vibe-check/SKILL.md](./.claude/skills/vibe-check/SKILL.md)(Claude Code)와 [GEMINI.md](./GEMINI.md)(Antigravity/Gemini)에 있으며, 두 파일은 같은 트리거를 공유합니다.

### 처음 한 번 (세션 일괄 승인)

> VIBE_CHECK_AUTORUN_MODE를 이 프로젝트에 적용해줘.
> 로컬 파일 수정과 로컬 테스트 실행까지 승인한다.
> 원격 push, publish, release는 금지한다.

### 이후 매번

| 트리거 스타일 | 이렇게 말하기 |
|---|---|
| 짧게 | "vibe-check 해줘" |
| **보통 (권장)** | **"이 프로젝트 점검해서 교정해줘"** |
| 정확하게 | "이 프로젝트를 vibe-diagnosis 기준으로 점검해서 교정해줘. 초기화가 안 되어 있으면 초기화하고, 진단을 실행하고, 실패한 항목만 최소 수정한 뒤, 다시 진단해서 결과를 단계별로 설명해줘." |

에이전트가 별도 명시 승인 없이는 **절대 하지 않는 것**: `git push`, `npm publish`, release 생성, 실제 API key 요청/저장, release-ready 선언.

---

## 🔄 에이전트 자동화

프로젝트의 `.agents/AGENTS.md` 또는 `CLAUDE.md`에 추가:

```markdown
## Vibe Diagnosis Rules
- Task 완료 후 반드시 `run_diagnostics` MCP 도구로 검증할 것
- 에러 패턴 발견 시 `write_error_pattern`으로 기록할 것
- 새 Task에 대응하는 .diag.js 파일을 함께 생성할 것
```

---

## 3단계 진단 레이어

| 레이어 | 검증 대상 |
|---|---|
| **TASK** | 작업의 의도가 달성되었는가? |
| **FUNCTION** | 핵심 함수가 엣지 케이스 포함 올바른 출력을 생성하는가? |
| **SYSTEM** | 외부 서비스 연결, 데이터 무결성, 인프라 상태 |

---

## 에러 패턴 기록

에이전트가 반복되는 에러를 발견하면 `.vibe-diagnosis/error-patterns/`에 기록합니다:

```
.vibe-diagnosis/error-patterns/
└── ERR_001_division_nan.md
```

이 로그는 이후 세션에서 같은 실수를 반복하지 않도록 참조됩니다.

---

## 릴리즈 모드

프로덕션 배포 시 `.gitignore`에 추가:

```gitignore
.vibe-diagnosis/
```

---

## 개발

단위 테스트 실행 (Node 내장 테스트 러너, 의존성 없음):

```bash
npm test              # test/ 의 단위 테스트
npm run test:self     # 도그푸딩 — 이 프로젝트 자체 진단 실행
npm run test:example  # 계산기 예제 진단 실행
```

---

## License

Apache License 2.0 — Open, Royalty-Free (오픈, 로열티 프리)

자세한 내용은 [LICENSE](./LICENSE)를 참조하세요.
