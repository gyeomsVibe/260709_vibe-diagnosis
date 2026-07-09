artifact\_class: mode\_design\_plan\_draft  
status: design\_only / not\_applied / not\_verified

좋습니다. 목표를 한 문장으로 바꾸면 이겁니다.

vibe-diagnosis MCP를 “항상 켜둘 수 있는 프로젝트 점검 모드”로 만들어서,  
새 프로젝트를 만들거나 기존 프로젝트를 열었을 때  
“이 프로젝트 점검해서 교정해줘” 한 문장으로  
초기화 → 진단 → 실패 분석 → 최소 수정 → 재진단 → 결과 설명까지 반복 가능하게 만든다.

업로드된 분석 문서 기준 `vibe-diagnosis`는 CLI, VS Code Extension, MCP Server가 같은 진단 코어를 쓰고, `runner.js`, `schema.js`, `init.js`, `config-manager.js`, `reporter.js`가 핵심 엔진 역할을 하는 구조입니다. 즉, 새로 완전히 다른 시스템을 만드는 게 아니라 **이미 있는 진단 도구를 “모드”로 묶는 설계**가 맞습니다.

---

# **1단계. 먼저 “모드”가 뭔지 쉽게 이해하기**

MCP 자체는 도구상자입니다.

vibe-diagnosis MCP \= 망치, 드라이버, 줄자 같은 도구상자

그런데 도구상자만 있으면 초보자는 이렇게 됩니다.

어떤 도구를 먼저 써야 하지?  
검사부터 해야 하나?  
고치고 다시 검사해야 하나?  
실패하면 어디를 봐야 하지?

그래서 필요한 게 **모드**입니다.

vibe-check mode \= 도구를 어떤 순서로 쓸지 정해둔 수업 계획서

즉:

MCP \= 기능  
모드 \= 사용 순서  
트리거 \= 모드를 시작하는 말  
Skill / GEMINI.md / Hook \= 모드를 저장하는 장소

---

# **2단계. 최종 목표 구조**

당신이 만들려는 영구 모드는 이렇게 생기면 됩니다.

사용자:  
이 프로젝트 점검해서 교정해줘

AI:  
1\. 현재 프로젝트 폴더 확인  
2\. vibe-diagnosis 사용 가능 여부 확인  
3\. .vibe-diagnosis 없으면 init  
4\. 있으면 빠진 설정만 보강  
5\. 진단 파일 목록 확인  
6\. 진단 실행  
7\. 실패한 항목 설명  
8\. 관련 코드와 진단 파일 확인  
9\. 최소 수정  
10\. 재진단  
11\. 반복 오류는 오답노트에 기록  
12\. 실행한 것 / 못 한 것 분리 보고

초보자식으로 줄이면:

검사장 만들기  
→ 문제지 확인  
→ 시험 보기  
→ 틀린 문제 풀이  
→ 고치기  
→ 다시 시험 보기  
→ 오답노트 쓰기

---

# **3단계. 모드 이름 정하기**

권장 이름은 이겁니다.

vibe-check mode

사용자 입장에서는 이렇게 부릅니다.

/vibe-check  
이 프로젝트 점검해서 교정해줘  
자가진단 MCP 적용해줘  
진단 돌리고 실패한 것 고쳐줘  
원터치 점검해줘

내부 이름은 영어로 둡니다.

VIBE\_CHECK\_MODE

이유는 간단합니다.

한국어 트리거 \= 사용자가 말하기 쉬움  
영어 내부 이름 \= Claude Code, Antigravity, 파일명, 자동화와 연결하기 쉬움

---

# **4단계. 모드의 핵심 상태머신**

모드는 반드시 순서가 있어야 합니다.  
이 순서를 정해두지 않으면 AI가 매번 다르게 행동합니다.

## **VIBE\_CHECK\_MODE\_STATE\_MACHINE**

S0. Intake  
사용자가 “점검해줘 / 교정해줘 / vibe-check”라고 말함

S1. Project Boundary  
현재 프로젝트 루트 확인

S2. Tool Availability  
vibe-diagnosis CLI 또는 MCP 사용 가능 여부 확인

S3. Init or Reinforce  
.vibe-diagnosis 없으면 초기화  
이미 있으면 MCP 설정과 gitignore만 보강

S4. Diagnostic Discovery  
진단 파일 목록 확인

S5. First Run  
진단 실행

S6. Failure Triage  
실패한 진단을 읽고 원인 분류

S7. Minimal Repair  
관련 파일만 최소 수정

S8. Re-run  
같은 진단 다시 실행

S9. Memory  
반복될 오류면 error pattern 기록

S10. Report  
실행한 것, 수정한 것, 남은 것 분리 보고

이 상태머신이 “원터치”의 진짜 뼈대입니다.

---

# **5단계. 모드가 써야 하는 MCP 도구 순서**

MCP 도구는 이렇게 사용하면 됩니다.

init\_diagnostics  
→ list\_diagnostics  
→ run\_diagnostics  
→ read\_error\_pattern  
→ write\_error\_pattern  
→ open\_dashboard

단, 매번 전부 쓰는 건 아닙니다.

## **기본 점검**

list\_diagnostics  
→ run\_diagnostics

## **새 프로젝트 점검**

init\_diagnostics  
→ list\_diagnostics  
→ run\_diagnostics

## **실패 교정**

run\_diagnostics  
→ 관련 코드 확인  
→ 최소 수정  
→ run\_diagnostics 재실행  
→ write\_error\_pattern

## **결과 확인**

open\_dashboard

---

# **6단계. 모드를 4단계로 키우기**

처음부터 완전 자동화로 가면 헷갈립니다.  
아래 4단계로 키우면 됩니다.

## **Level 1\. 수동 프롬프트 모드**

가장 먼저 만들 것:

“이 프로젝트 점검해서 교정해줘”

AI가 이 말을 들으면 정해진 순서로 움직이게 합니다.

이 단계의 목적:

사람이 매번 길게 설명하지 않게 만들기

---

## **Level 2\. Claude Code Skill 모드**

Claude Code에 `/vibe-check`를 만듭니다.

파일:

.claude/skills/vibe-check/SKILL.md

역할:

Claude Code가 “아, 이건 vibe-diagnosis로 점검하는 작업이구나”라고 자동 이해하게 함

---

## **Level 3\. Antigravity / Gemini 규칙 모드**

Antigravity 쪽에는 `GEMINI.md` 또는 `.gemini/settings.json` 기준으로 규칙을 둡니다.

파일 후보:

GEMINI.md  
.gemini/settings.json

역할:

Antigravity가 프로젝트를 열었을 때  
vibe-diagnosis MCP를 어떤 순서로 쓸지 기억하게 함

---

## **Level 4\. Hook / 자동 재진단 모드**

마지막 단계입니다.

예:

파일 수정 후 자동 진단  
커밋 전 자동 진단  
작업 종료 전 자동 진단

이 단계는 강력하지만, 처음부터 넣으면 사용자가 “왜 자꾸 실행돼?”라고 느낄 수 있습니다.

그래서 순서는:

프롬프트 → Skill → GEMINI.md → Hook

이 맞습니다.

---

# **7단계. 만들어야 할 파일 설계**

## **1\. `STATE_BOUNDARY.md`**

역할:

지금 무엇을 기준으로 말하는지 헷갈리지 않게 막는 파일

내용:

\# STATE\_BOUNDARY

\#\# Source States

\- Uploaded ZIP source state:  
\- Git tracked state:  
\- GitHub remote state:  
\- VSIX artifact state:  
\- mcp-server node\_modules state:  
\- npm published state:

\#\# Rules

\- Do not mix uploaded ZIP state with final GitHub state.  
\- Do not treat VSIX artifact as current source unless rebuilt.  
\- Do not treat node\_modules package as canonical source.  
\- Do not declare release-ready unless measured in this session.

---

## **2\. `AGENT_PATCH_QUEUE.md`**

역할:

Antigravity / Claude Code가 순서대로 처리할 작업표

내용:

\# AGENT\_PATCH\_QUEUE

\#\# P0. State Boundary  
\- Create or update STATE\_BOUNDARY.md.

\#\# P1. MCP dependency  
\- Use local \`file:..\` dependency for mcp-server.

\#\# P2. VSIX artifact  
\- Rebuild VSIX from current source.  
\- Exclude old bug-containing VSIX from release target.

\#\# P3. Init idempotency  
\- If \`.vibe-diagnosis\` exists, reinforce MCP config and gitignore without overwriting diagnostics.

\#\# P4. Vibe Check Mode  
\- Add Claude Skill.  
\- Add Antigravity/Gemini usage rules.  
\- Add user trigger examples.

\#\# P5. Verification  
\- Run available local tests.  
\- Report executed and not executed checks separately.

---

## **3\. `.claude/skills/vibe-check/SKILL.md`**

역할:

Claude Code에서 /vibe-check처럼 부르는 원터치 점검 모드

초안:

\---  
name: vibe-check  
description: Use this when the user asks to inspect, diagnose, repair, or re-check a project with vibe-diagnosis MCP.  
\---

\# Vibe Check Mode

You are a vibe-coding teacher using vibe-diagnosis as the project inspection tool.

\#\# Trigger phrases

\- "이 프로젝트 점검해서 교정해줘"  
\- "자가진단 MCP 적용해줘"  
\- "진단 돌리고 실패한 것 고쳐줘"  
\- "원터치 점검해줘"  
\- "vibe-check"

\#\# Workflow

1\. Identify the current project root.  
2\. Check whether vibe-diagnosis CLI or MCP is available.  
3\. If \`.vibe-diagnosis/\` does not exist, initialize diagnostics.  
4\. If \`.vibe-diagnosis/\` exists, reinforce missing MCP config and gitignore entries without overwriting existing diagnostics.  
5\. List available diagnostics.  
6\. Run diagnostics.  
7\. Explain failures in beginner-friendly Korean.  
8\. Inspect only the related source files and diagnostic files.  
9\. Apply the smallest necessary correction.  
10\. Re-run diagnostics.  
11\. If the same mistake is likely to repeat, write an error pattern.  
12\. Summarize:  
   \- what was checked  
   \- what was changed  
   \- what was actually run  
   \- what was not run  
   \- what still needs confirmation

\#\# Rules

\- Do not push.  
\- Do not publish.  
\- Do not claim release-ready.  
\- Do not ask for real API keys.  
\- Do not mix uploaded ZIP state, GitHub state, VSIX artifact state, and node\_modules state.  
\- Use step-by-step Korean explanations for beginner users.

---

## **4\. `GEMINI.md`**

역할:

Antigravity / Gemini 계열에서 같은 모드를 기억하게 하는 파일

초안:

\# Vibe Check Mode

When the user says:

\- "이 프로젝트 점검해서 교정해줘"  
\- "원터치 점검해줘"  
\- "자가진단 MCP 적용해줘"  
\- "진단 돌리고 실패한 것 고쳐줘"

use vibe-diagnosis as the inspection and repair loop.

\#\# Process

1\. Confirm project root.  
2\. Check vibe-diagnosis availability.  
3\. Initialize diagnostics if missing.  
4\. Reinforce MCP config and gitignore if diagnostics already exist.  
5\. List diagnostics.  
6\. Run diagnostics.  
7\. Explain failures in Korean for beginners.  
8\. Make minimal related fixes only.  
9\. Re-run diagnostics.  
10\. Record reusable error patterns when appropriate.  
11\. Separate executed checks from unexecuted checks.

\#\# Boundaries

\- No remote push.  
\- No package publish.  
\- No release-ready claim.  
\- No real API key request.  
\- Keep source state, GitHub state, VSIX state, and node\_modules state separate.

---

# **8단계. “원터치” 트리거 설계**

사용자가 쓸 문장은 3종류로 나누면 됩니다.

## **짧은 트리거**

vibe-check 해줘

## **보통 트리거**

이 프로젝트 점검해서 교정해줘

## **정확한 트리거**

이 프로젝트를 vibe-diagnosis 기준으로 점검해서 교정해줘.  
초기화가 안 되어 있으면 초기화하고,  
진단을 실행하고,  
실패한 항목만 최소 수정한 뒤,  
다시 진단해서 결과를 단계별로 설명해줘.

내 추천 기본값은 두 번째입니다.

이 프로젝트 점검해서 교정해줘

이 문장이 가장 자연스럽고, Antigravity / Claude Code 둘 다 이해하기 좋습니다.

---

# **9단계. 자동 교정의 원칙**

이 모드에서 가장 중요한 교정 원칙은 이것입니다.

한 번에 많이 고치지 않는다.  
실패한 진단과 직접 관련된 것만 고친다.  
고친 뒤 반드시 같은 진단을 다시 실행한다.

초보자식으로 말하면:

열이 난다고 온몸을 수술하지 않는다.  
체온계를 보고 원인을 좁힌 뒤,  
필요한 처방만 하고,  
다시 체온을 잰다.

그래서 모드 규칙은 이렇게 잡아야 합니다.

1 failure  
→ 1 cause  
→ smallest fix  
→ re-run  
→ report

---

# **10단계. 결과 보고 형식**

모드가 끝날 때는 항상 이렇게 보고해야 합니다.

\#\# 점검 결과

\#\#\# 실행한 것  
\- ...

\#\#\# 발견한 것  
\- ...

\#\#\# 수정한 것  
\- ...

\#\#\# 다시 실행한 검증  
\- ...

\#\#\# 아직 실행하지 않은 것  
\- ...

\#\#\# 다음 권장 작업  
\- ...

중요한 점:

실행하지 않은 것을 실행했다고 말하지 않는다.  
통과하지 않은 것을 통과했다고 말하지 않는다.  
release-ready라고 말하지 않는다.

---

# **11단계. 모드의 MVP 범위**

처음 버전에서 너무 많이 넣지 않는 게 좋습니다.

## **MVP에 포함**

Claude Skill  
GEMINI.md  
STATE\_BOUNDARY.md  
AGENT\_PATCH\_QUEUE.md  
init 멱등 보강  
MCP 의존성 정리  
VSIX 재빌드 정책  
기본 테스트 명령

## **MVP에서 제외**

자동 push  
자동 publish  
자동 release  
실제 API key 입력 자동화  
무제한 자동 수정 loop  
여러 프로젝트 동시 수정

---

# **12단계. 개발 순서**

이 순서대로 가면 됩니다.

1\. STATE\_BOUNDARY.md 작성  
2\. AGENT\_PATCH\_QUEUE.md 작성  
3\. mcp-server 의존성 file:.. 정리  
4\. init 멱등 보강  
5\. VSIX 1.1.1 재빌드 정책 적용  
6\. .claude/skills/vibe-check/SKILL.md 추가  
7\. GEMINI.md 추가  
8\. README에 “원터치 점검 모드” 사용법 추가  
9\. npm test 실행  
10\. npm run test:self 실행  
11\. npm run test:example 실행  
12\. MCP smoke test 실행  
13\. 결과 보고

---

# **13단계. 최종 설계 요약**

이 모드는 이렇게 정의하면 됩니다.

Vibe Check Mode는 vibe-diagnosis MCP를 이용해  
프로젝트를 초기화하고,  
진단을 실행하고,  
실패를 설명하고,  
관련 코드만 최소 수정하고,  
다시 진단하고,  
반복 오류를 기록하고,  
결과를 초보자에게 단계별로 설명하는  
영구 프로젝트 점검 모드다.

한 줄 버전:

“이 프로젝트 점검해서 교정해줘”를 실제 작동하는 검사-교정-재검사 루프로 만드는 모드.

---

# **14단계. 바로 다음 액션**

다음 단계에서 바로 만들 파일은 이 4개입니다.

STATE\_BOUNDARY.md  
AGENT\_PATCH\_QUEUE.md  
.claude/skills/vibe-check/SKILL.md  
GEMINI.md

그리고 코드 쪽 패치는 이 3개입니다.

mcp-server dependency → file:..  
init idempotent reinforcement  
VSIX 1.1.1 rebuild policy

다음 작업 지시문은 이것으로 가면 됩니다.

Vibe Check Mode MVP를 구현해줘.

1\. STATE\_BOUNDARY.md를 추가해서 uploaded ZIP, Git state, GitHub remote, VSIX artifact, node\_modules 상태를 분리해줘.  
2\. AGENT\_PATCH\_QUEUE.md를 추가해서 패치 순서를 기록해줘.  
3\. .claude/skills/vibe-check/SKILL.md를 추가해서 Claude Code에서 원터치 점검 모드로 쓸 수 있게 해줘.  
4\. GEMINI.md를 추가해서 Antigravity/Gemini 계열에서도 같은 트리거를 쓰게 해줘.  
5\. mcp-server는 vibe-diagnosis를 file:.. 로컬 링크로 참조하게 정리해줘.  
6\. init은 .vibe-diagnosis가 있어도 MCP 설정과 gitignore를 멱등 보강하게 해줘.  
7\. VSIX는 현재 source 기준 1.1.1로 재빌드하고, 기존 1.1.0 VSIX는 배포 대상에서 제외해줘.  
8\. 수정 후 실행한 테스트와 실행하지 못한 테스트를 분리해서 보고해줘.  
9\. 원격 push, publish, release 선언은 하지 마.

---

