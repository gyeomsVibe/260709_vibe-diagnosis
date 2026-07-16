# Claude Code Vibe Check 연동 및 규칙 동기화 구현 계획

이 계획서는 Claude Code 환경에서 자가진단(VIBE_CHECK_AUTORUN_MODE) 모드가 실제로 동작하도록 연동·설치하고, Claude용 `SKILL.md`와 Gemini용 `GEMINI.md` 간의 규칙 불일치를 해소하고 동기화하기 위한 구체적인 수립 방안을 제공합니다.

---

## User Review Required
> [!IMPORTANT]
> - **Claude 글로벌 스킬 경로 설정**: Claude 글로벌 스킬 디렉토리인 `C:/Users/Kimyoongyeom/.claude/skills` 하위에 `vibe-check` 폴더를 생성하고 `SKILL.md`를 설치할 것입니다.
> - **로컬 MCP 등록**: 외부 npm 배포본(npx vibe-clinic-mcp) 대신, 현재 수정한 최신 코드가 즉시 반영되도록 **로컬 index.js**를 절대 경로로 지정하여 `claude mcp add`로 등록하겠습니다.
> - **절대 금지사항**: 규칙에 명시된 대로 `git push`, `npm publish`, `GitHub release`, `Render 배포`, `실제 API Key 요청/저장`은 일절 배제한 채 dry-run 및 로컬 검증만 수행합니다.

---

## Proposed Changes

### 1. Claude Vibe Check 스킬 설치 및 글로벌 설정
#### [NEW] [SKILL.md](file:///C:/Users/Kimyoongyeom/.claude/skills/vibe-check/SKILL.md)
- Claude 글로벌 스킬 경로인 `C:/Users/Kimyoongyeom/.claude/skills/vibe-check/` 하위에 신규 스킬 파일 생성.
- 동기화된 Vibe Check 자동 실행 모드 룰셋 정의.

### 2. Claude Code 로컬 MCP 서버 등록 및 검증
- **명령 실행**:
  - `claude mcp add vibe-clinic -- node d:/D_Workspace_NB/-google-workspace/-antigravity-workspace/260709_vibe-clinic/backend/mcp-server/index.js`
- **검증**:
  - `claude mcp list` 명령으로 `vibe-clinic`가 정상 등록 및 연결(`√ Connected`)되었는지 상태 확인.

### 3. 규칙 동기화 패치 및 스크립트화 (보조 목표)
- `SKILL.md`와 `GEMINI.md` 사이의 미세한 텍스트/포맷 차이 분석 및 동기화.
- 동기화를 자동화할 수 있는 빌드 스크립트 작성.
#### [NEW] [sync-rules.js](file:///d:/D_Workspace_NB/-google-workspace/-antigravity-workspace/260709_vibe-clinic/bin/sync-rules.js)
- `GEMINI.md`와 `SKILL.md` 간의 규칙 본문 영역을 동기화하여 향후 규칙 변경 시 충돌을 방지하는 노드 스크립트 생성.
- `SKILL.md`는 frontmatter(Yaml)를 유지한 채 본문 규칙만을 `GEMINI.md`로부터 가져오도록 구현.

---

## Verification Plan

### 1. 임시 프로젝트 자가진단 검증 (Dry-Run)
- 임시 프로젝트 생성: `d:/D_Workspace_NB/-google-workspace/-antigravity-workspace/temp-vibe-test`
- 해당 경로에서 `node backend/bin/vibe-clinic.js init` 실행 및 MCP 도구 무결성 테스트.
- `temp-vibe-test`에서 `node backend/bin/vibe-clinic.js run` 검증.

### 2. Claude Code 트리거 테스트 (Dry-Run)
- 임시 또는 테스트 프로젝트에서 Claude CLI를 비대화형 모드로 켜서 자가진단 트리거가 올바르게 감지되는지 테스트합니다.
  - `claude -p "이 프로젝트 점검해서 교정해줘"`
  - `overallStatus` 및 `healthPercent` 진단 결과가 한글로 올바르게 보고되는지 관찰합니다.

### 3. 규칙 동기화 동작 테스트
- `bin/sync-rules.js`를 실행하여 `GEMINI.md`의 본문 수정 시 `SKILL.md`에도 정상 동기화 패치가 이루어지는지 테스트합니다.
