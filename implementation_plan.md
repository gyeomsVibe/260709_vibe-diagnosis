# vibe-diagnosis 프로젝트 구현 계획

## 목표

GitHub에 `vibe-diagnosis` 저장소를 생성하여, 바이브코딩 프로젝트에 즉시 적용할 수 있는 **자가 진단 프레임워크**를 배포한다.

현재 GEMINI.md 글로벌 룰(Section 10)에 정의된 원칙을 **실제로 동작하는 코드**로 구현하는 것이 핵심이다.

## 초기 범위 (MVP)

`OK` / `WARNING` / `ERROR` 판단이 가능한 최소 동작 프레임워크:

1. 진단 스키마 정의 (어떻게 진단 코드를 작성하는가)
2. CLI Runner (진단을 실행하고 결과를 출력)
3. 예제 프로젝트 (calculator 예제로 즉시 이해 가능)
4. README 문서화 (GitHub에서 바로 사용법을 파악)

---

## 프로젝트 구조

```
C:\home\vibe-diagnosis/
├── README.md                      ← GitHub 메인 페이지
├── package.json                   ← npm 패키지 정의
├── bin/
│   └── vibe-diag.js               ← CLI 엔트리포인트 (npx vibe-diag run)
├── src/
│   ├── runner.js                  ← 진단 실행 엔진
│   ├── reporter.js                ← 결과 포맷터 (터미널 컬러 출력)
│   ├── schema.js                  ← 진단 노드 스키마 검증
│   └── init.js                    ← 프로젝트 초기화 (vibe-diag init)
├── templates/
│   ├── config.json                ← .vibe-diagnosis/config.json 템플릿
│   ├── example.diag.js            ← 진단 코드 작성 예제 템플릿
│   └── error-pattern.md           ← 에러 패턴 로그 템플릿
├── examples/
│   └── calculator/                ← 계산기 예제 프로젝트
│       ├── calculator.js          ← 계산기 비즈니스 코드
│       └── .vibe-diagnosis/
│           ├── config.json
│           ├── diagnostics/
│           │   ├── task-001-arithmetic.diag.js
│           │   ├── task-002-division-zero.diag.js
│           │   └── func-calc-engine.diag.js
│           └── error-patterns/
│               └── ERR_001_division_nan.md
└── .vibe-diagnosis/               ← 자기 자신도 자가 진단 (dogfooding)
    └── diagnostics/
        └── task-001-runner.diag.js
```

---

## 핵심 파일 설계

### 1. 진단 코드 작성법 (`.diag.js` 포맷)

개발자(또는 에이전트)가 작성하는 진단 파일의 표준 포맷:

```js
module.exports = {
  id: 'task-001-arithmetic',
  name: 'Basic Arithmetic Operations',
  layer: 'TASK',              // TASK | FUNCTION | SYSTEM
  linkedTask: 'TASK-001',

  async run(ctx) {
    const calc = require('../../calculator');

    const tests = [
      { fn: 'add',      args: [2, 3],   expected: 5  },
      { fn: 'subtract', args: [10, 4],  expected: 6  },
      { fn: 'multiply', args: [3, 7],   expected: 21 },
      { fn: 'divide',   args: [20, 4],  expected: 5  },
    ];

    for (const t of tests) {
      const result = calc[t.fn](...t.args);
      if (result !== t.expected) {
        return { status: 'ERROR', details: `${t.fn}(${t.args}) = ${result}, expected ${t.expected}` };
      }
    }

    return { status: 'OK', details: 'All 4 operations verified' };
  }
};
```

### 2. CLI 명령어

| 명령어 | 동작 |
|---|---|
| `npx vibe-diag init` | 현재 프로젝트에 `.vibe-diagnosis/` 폴더와 기본 config 생성 |
| `npx vibe-diag run` | 모든 진단 실행 → 결과를 터미널에 컬러 출력 |
| `npx vibe-diag run --json` | JSON 포맷으로 결과 출력 (CI/CD 연동용) |

### 3. 터미널 출력 예시

```
 Vibe Diagnosis v1.0.0 — simple-calculator
 ─────────────────────────────────────────

 TASK  │ task-001-arithmetic       │ ✅ OK      │ All 4 operations verified
 TASK  │ task-002-division-zero    │ ✅ OK      │ 3 edge cases passed
 TASK  │ task-003-history          │ ⚠️ WARNING │ No overflow limit (101 entries allowed)
 FUNC  │ func-calc-engine          │ ✅ OK      │ Float precision within ±0.0001
 SYS   │ sys-localstorage          │ ⚠️ WARNING │ localStorage not available in Node

 ─────────────────────────────────────────
 Total: 5 nodes │ OK: 3 │ WARN: 2 │ ERR: 0
 Overall: ⚠️ WARNING — Health 60%
```

---

## 수정 대상 파일

### [NEW] `C:\home\vibe-diagnosis\` — 전체 새 프로젝트

| 파일 | 역할 |
|---|---|
| `package.json` | 패키지 메타 + `bin` CLI 엔트리 |
| `bin/vibe-diag.js` | CLI 파서 (init / run / --json) |
| `src/runner.js` | `.vibe-diagnosis/diagnostics/*.diag.js` 자동 탐색 + 실행 |
| `src/reporter.js` | 터미널 컬러 출력 + 요약 통계 |
| `src/schema.js` | 진단 결과 스키마 검증 (메타 검증) |
| `src/init.js` | 프로젝트 초기화 스캐폴딩 |
| `templates/*` | init 시 복사될 템플릿 파일들 |
| `examples/calculator/` | 즉시 동작하는 계산기 예제 |
| `README.md` | GitHub 메인 문서 |

---

## 검증 계획

### 자동 테스트
- `node bin/vibe-diag.js run` 을 examples/calculator에서 실행하여 OK/WARN/ERROR가 정확히 출력되는지 확인
- 스키마 위반 진단 파일 (status 누락, 잘못된 status 값 등)에 대한 메타 검증 테스트

### 수동 검증
- 실제로 `npx vibe-diag init` 이 빈 프로젝트에 `.vibe-diagnosis/` 구조를 올바르게 생성하는지 확인
- README 기반으로 처음 보는 사람이 3분 내에 적용할 수 있는지 확인

---

## Open Questions

> [!IMPORTANT]
> **GitHub 저장소 생성**: 프로젝트 코드를 먼저 만들고, Rejard님이 직접 GitHub에서 `vibe-diagnosis` 저장소를 생성한 후 push하는 순서로 할까요? 아니면 다른 방식을 선호하시나요?

> [!NOTE]
> Original planning note referenced Rejard; current maintained repository is [gyeomsVibe/260709_vibe-diagnosis](https://github.com/gyeomsVibe/260709_vibe-diagnosis). 위 원문은 기획 히스토리 보존을 위해 그대로 둡니다.

---

## Credits

- **Original author (원작자):** Rejard `<lemaiiisk@gmail.com>`
- **Current maintainer (현재 관리자):** gyeomsVibe `<yoongyeomkim0515@gmail.com>`
- **Repository:** https://github.com/gyeomsVibe/260709_vibe-diagnosis
- **License:** Apache-2.0
