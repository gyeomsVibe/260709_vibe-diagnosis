artifact\_class: automation\_mode\_design\_patch  
status: design\_only / not\_applied / not\_verified

맞습니다. 목표를 이렇게 바꾸면 됩니다.

사용자가 13단계를 직접 시키는 구조 ❌  
Claude Code / Antigravity가 13단계를 알아서 수행하고,  
사용자는 “진행 승인 / 중단 / 범위 수정”만 하는 구조 ✅

즉, `vibe-check mode`는 단순 사용법 문서가 아니라 **승인 기반 자동 실행 모드**가 되어야 합니다.

---

# **1단계. 구조를 바꿉니다**

기존 개발 순서:

1\. STATE\_BOUNDARY.md 작성  
2\. AGENT\_PATCH\_QUEUE.md 작성  
3\. mcp-server 의존성 정리  
...  
13\. 결과 보고

이걸 사용자가 하나씩 지시하면 피곤합니다.

그래서 에이전트에게는 이렇게 시켜야 합니다.

사용자는 목표만 승인한다.  
에이전트는 계획 → 파일 수정 → 검증 → 보고까지 직접 수행한다.  
단, 위험 작업은 별도 승인 전에는 하지 않는다.

초보자식으로 말하면:

사용자 \= 감독  
Claude Code / Antigravity \= 작업자  
vibe-diagnosis MCP \= 검사 도구  
vibe-check mode \= 작업 매뉴얼

---

# **2단계. 자동화 모드 이름**

권장 이름:

VIBE\_CHECK\_AUTORUN\_MODE

사용자가 부르는 말:

이 프로젝트 점검해서 교정해줘.

내부 의미:

상태 분리  
→ 패치 큐 생성  
→ 필요한 파일 수정  
→ 진단 실행  
→ 실패 교정  
→ 재진단  
→ 결과 보고

---

# **3단계. 승인 구조**

사용자가 모든 세부 작업을 승인할 필요는 없습니다.  
대신 **큰 문턱만 승인**하면 됩니다.

## **승인 1\. 작업 시작 승인**

이 프로젝트에 VIBE\_CHECK\_AUTORUN\_MODE를 적용해줘.  
로컬 파일 수정과 로컬 테스트 실행까지 승인한다.  
원격 push, npm publish, release 선언은 금지한다.

이 한 번의 승인으로 가능한 것:

파일 읽기  
로컬 파일 생성/수정  
package-lock 재생성  
VSIX 로컬 재빌드  
npm test 실행  
MCP smoke test 실행  
결과 보고

---

## **승인 2\. 설치/패키지 명령 승인**

`npm install`, `npm pack`, `vsce package`처럼 시간이 걸리거나 의존성을 바꾸는 명령은 에이전트가 실행 전에 짧게 확인하게 합니다.

예:

의존성 정리를 위해 npm install을 실행해야 합니다. 진행할까요?

사용자는:

승인

만 하면 됩니다.

---

## **승인 3\. 절대 금지 영역**

아래는 자동 실행하지 않게 둡니다.

git push  
npm publish  
GitHub release 생성  
실제 배포  
실제 API key 입력/저장  
원격 저장소 상태를 “최종 검증됨”으로 선언

이건 사용자가 원해도 별도 명시 승인 없이는 막아야 합니다.

---

# **4단계. 13단계를 “자동 실행 묶음”으로 압축**

13단계를 그대로 두지 말고, 에이전트 내부에서 5개 묶음으로 실행하게 합니다.

## **Phase A. 상태 분리**

에이전트가 자동으로 합니다.

1\. STATE\_BOUNDARY.md 작성  
2\. AGENT\_PATCH\_QUEUE.md 작성

목표:

원본 ZIP, 현재 소스, Git 상태, VSIX, node\_modules를 섞지 않게 함

---

## **Phase B. 코드/패키지 정리**

에이전트가 자동으로 합니다.

3\. mcp-server 의존성 file:.. 정리  
4\. init 멱등 보강  
5\. VSIX 1.1.1 재빌드 정책 적용

목표:

MCP가 현재 로컬 core를 쓰게 하고,  
init을 여러 번 눌러도 안전하게 만들고,  
버그 포함 1.1.0 VSIX를 배포 대상으로 쓰지 않게 함

---

## **Phase C. 모드 파일 추가**

에이전트가 자동으로 합니다.

6\. .claude/skills/vibe-check/SKILL.md 추가  
7\. GEMINI.md 추가  
8\. README에 원터치 점검 모드 사용법 추가

목표:

Claude Code와 Antigravity가 같은 트리거를 이해하게 함

---

## **Phase D. 검증 실행**

에이전트가 자동으로 합니다.

9\. npm test  
10\. npm run test:self  
11\. npm run test:example  
12\. MCP smoke test

목표:

고친 뒤 실제로 진단/테스트를 돌림

---

## **Phase E. 결과 보고**

에이전트가 자동으로 합니다.

13\. 결과 보고

보고는 반드시 이렇게 나눕니다.

실행한 것  
수정한 것  
통과한 것  
실패한 것  
실행하지 못한 것  
다음 승인 필요 항목

---

# **5단계. Claude Code / Antigravity에 줄 최종 지시문**

아래 문장을 그대로 쓰면 됩니다.

VIBE\_CHECK\_AUTORUN\_MODE로 진행해줘.

목표:  
이 프로젝트에 vibe-diagnosis 기반 원터치 점검/교정 모드를 구현한다.  
사용자는 큰 승인만 하고, 세부 작업은 Claude Code/Antigravity가 직접 수행한다.

승인 범위:  
\- 로컬 파일 읽기 허용  
\- 로컬 파일 생성/수정 허용  
\- package-lock 재생성 허용  
\- 로컬 테스트 실행 허용  
\- MCP smoke test 실행 허용  
\- VSIX 로컬 재빌드 허용

금지:  
\- git push 금지  
\- npm publish 금지  
\- GitHub release 금지  
\- production-ready 선언 금지  
\- release-ready 선언 금지  
\- 실제 API key 요청/저장 금지  
\- 원본 ZIP 상태와 현재 Git/GitHub/VSIX 상태 혼합 금지

자동 수행 순서:  
1\. 현재 Git 상태와 프로젝트 루트를 확인한다.  
2\. STATE\_BOUNDARY.md를 작성한다.  
3\. AGENT\_PATCH\_QUEUE.md를 작성한다.  
4\. mcp-server의 vibe-diagnosis 의존성을 file:.. 로컬 링크로 정리한다.  
5\. package-lock.json을 정합성 있게 갱신한다.  
6\. init이 .vibe-diagnosis 존재 시에도 MCP 설정과 .gitignore를 멱등 보강하게 수정한다.  
7\. vscode-extension을 1.1.1 기준으로 정리하고 현재 src 기준으로 VSIX를 재빌드한다.  
8\. 기존 1.1.0 VSIX는 배포 대상에서 제외하고 STATE\_BOUNDARY.md에 기록한다.  
9\. .claude/skills/vibe-check/SKILL.md를 추가한다.  
10\. GEMINI.md를 추가한다.  
11\. README에 “원터치 점검 모드” 사용법을 추가한다.  
12\. npm test를 실행한다.  
13\. npm run test:self를 실행한다.  
14\. npm run test:example을 실행한다.  
15\. MCP smoke test를 실행한다.  
16\. 실행한 검증과 실행하지 못한 검증을 분리해서 보고한다.

작업 방식:  
\- 실패한 경우 즉시 멈추지 말고 원인을 기록한다.  
\- 고칠 수 있는 로컬 drift는 최소 수정으로 고친다.  
\- 같은 검증을 다시 실행해 결과를 비교한다.  
\- 사용자가 이해할 수 있게 단계별 한국어로 보고한다.

---

# **6단계. Claude Skill에 들어갈 핵심 규칙**

`.claude/skills/vibe-check/SKILL.md`에는 이 문장이 핵심입니다.

\# Vibe Check Autorun Mode

When the user says "이 프로젝트 점검해서 교정해줘", run the full supervised local inspection loop.

The user approves the overall local work session.  
After approval, perform state separation, patch queue execution, local repair, local tests, MCP smoke test, and final report.

Do not push, publish, release, or claim production readiness.

Always separate:  
\- source state  
\- Git state  
\- GitHub remote state  
\- VSIX artifact state  
\- node\_modules state  
\- executed checks  
\- unexecuted checks

---

# **7단계. Antigravity / GEMINI.md에 들어갈 핵심 규칙**

`GEMINI.md`에는 이렇게 들어가면 됩니다.

\# VIBE\_CHECK\_AUTORUN\_MODE

Trigger phrases:  
\- 이 프로젝트 점검해서 교정해줘  
\- 원터치 점검해줘  
\- vibe-check 해줘  
\- 자가진단 MCP 적용해줘

Behavior:  
1\. Ask for one overall approval before local modifications.  
2\. After approval, perform the full local inspection and repair loop.  
3\. Use vibe-diagnosis CLI/MCP where available.  
4\. Initialize diagnostics if missing.  
5\. Reinforce MCP config and gitignore if diagnostics already exist.  
6\. Run diagnostics.  
7\. Repair only related failures.  
8\. Re-run diagnostics.  
9\. Report executed and unexecuted checks separately.

Never:  
\- push  
\- publish  
\- create releases  
\- request real API keys  
\- claim release-ready without measured evidence

---

# **8단계. 사용자가 실제로 할 일**

사용자는 이제 이것만 하면 됩니다.

## **처음 한 번**

VIBE\_CHECK\_AUTORUN\_MODE를 이 프로젝트에 적용해줘.  
로컬 파일 수정과 로컬 테스트 실행까지 승인한다.  
원격 push, publish, release는 금지한다.

## **이후 매번**

이 프로젝트 점검해서 교정해줘.

끝입니다.

---

# **9단계. 최종 설계 요약**

이 모드의 최종 형태는 이겁니다.

사용자는 “점검해서 교정해줘”라고 말한다.  
Claude Code / Antigravity는 전체 로컬 점검 루프를 수행한다.  
vibe-diagnosis MCP는 검사 도구로 쓰인다.  
실패하면 관련 파일만 최소 수정한다.  
다시 검사한다.  
실행한 것과 못 한 것을 분리 보고한다.  
위험 작업은 자동으로 하지 않는다.

한 줄로 줄이면:

사용자는 승인만 하고, 에이전트가 로컬 점검·교정·재검증·보고를 끝내는 supervised autorun mode입니다.  
