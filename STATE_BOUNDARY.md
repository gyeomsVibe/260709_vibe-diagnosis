# STATE_BOUNDARY — 상태 경계 문서

> 이 문서는 "어떤 상태를 기준으로 말하는지" 혼동을 막기 위한 기준표다.
> 아래 5개 상태는 **서로 다른 스냅샷**이며, 절대 한 덩어리로 취급하지 않는다.
> (원칙 출처: GPT-handoff 패치 큐 P0 — 증거 상태 분리)

기준 시각: 2026-07-09

## 상태 분리표

| # | 상태 | 위치 | 내용 기준 | 비고 |
|---|---|---|---|---|
| 1 | **GPT-handoff ZIP** | `GPT-handoff/GYEOMS_260709_vibe-diagnosis_EP_MASTER_ARCHIVE.zip` | 전수분석 **이전** 시점 스냅샷 | sha256: `cabf9a2b...b6c5c` (동봉 .sha256.txt 참조). 히스토리 보존용 — 현재 코드 기준으로 참조 금지 |
| 2 | **현재 작업 트리** | 이 저장소 루트 | 전수분석 후 15개 이슈 수정 + 메타데이터 리브랜딩 + 이번 패치 큐 적용본 | **유일한 "현재 소스" 기준** |
| 3 | **GitHub 원격** | `gyeoms-vibe/260709_vibe-diagnosis` `main` | 커밋 `e929a5b`까지 반영 | 이번 패치 큐 커밋은 push 승인 전까지 로컬에만 존재 |
| 4 | **VSIX 산출물 (구버전)** | `vscode-extension/vibe-diagnosis-vscode-1.1.0.vsix` | **수정 전 버그 코드 포함** (dashboard 5초 종료 버그, publisher=Rejard, 구 repo URL) | ⚠️ 배포 대상에서 제외. 현재 소스 기준 산출물은 `1.1.1.vsix` |
| 5 | **mcp-server/node_modules** | `mcp-server/node_modules/vibe-diagnosis` | (정리 전) npm registry의 **구버전 1.0.0 코어**가 설치되어 있었음 | `file:..` 로컬 링크로 전환하여 현재 소스 코어를 사용하도록 정리됨 |

## 판단 규칙

- "코드가 이렇다"라고 말할 때의 기준은 항상 **상태 2 (현재 작업 트리)**.
- "사용자가 설치하면 받는 것"은 npm은 registry 배포본(1.0.x, 원작자 계정), VSIX는 로컬 재빌드본 기준 — 상태 2와 다를 수 있음을 항상 명시.
- 구 VSIX(1.0.0~1.1.0)와 GPT-handoff ZIP은 **증거 보존용**이며 어떤 수정 작업의 입력으로도 쓰지 않는다.
- npm의 `vibe-diagnosis`/`vibe-diagnosis-mcp` 패키지는 원작자(Rejard) 계정 배포본(≤1.0.x)이며, 이 저장소에서 publish하지 않는다.
