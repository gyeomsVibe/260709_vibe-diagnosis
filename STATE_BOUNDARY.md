# STATE_BOUNDARY — 상태 경계 문서

> 이 문서는 "어떤 상태를 기준으로 말하는지" 혼동을 막기 위한 기준표다.
> 아래 상태는 서로 다른 스냅샷이며, 절대 한 덩어리로 취급하지 않는다.

기준 시각: 2026-07-14

## 상태 분리표

| # | 상태 | 위치 | 내용 기준 | 비고 |
|---|---|---|---|---|
| 1 | **역사 아카이브** | `GPT-handoff/1차 handoff/GYEOMS_260709_vibe-diagnosis_EP_MASTER_ARCHIVE.zip` | Vibe Clinic 완전 전환 이전 스냅샷 | 원문 증거이므로 파일명과 내용은 변경하지 않는다. 현재 코드의 입력으로 사용하지 않는다. |
| 2 | **현재 작업 트리** | 이 저장소 루트 | Vibe Clinic 2.0.0 hard cut 소스 | `.vibe-clinic/`, `*.clinic.js`, `vibe-clinic`/`vbc`, `run_clinic` 기준이다. |
| 3 | **GitHub 원격** | `gyeomsVibe/260709_vibe-clinic` `main` | 이 문서를 포함한 승인 배치를 push한 뒤 `HEAD`와 `origin/main`으로 확인 | 해시를 문서에 고정하지 않고 Git으로 실시간 판정한다. |
| 4 | **현재 VSIX** | `vscode-extension/vibe-clinic-vscode-2.0.0.vsix` | 현재 Vibe Clinic 소스, 2.0.0 메타데이터, LICENSE/NOTICE로 재빌드 | 로컬 산출물이며 Marketplace 배포는 하지 않았다. |
| 5 | **구 VSIX** | `vscode-extension/vibe-diagnosis-vscode-1.1.4.vsix` | 리브랜딩 전 산출물 | 2026-07-14 사용자 승인 후 물리 삭제 완료. |
| 6 | **로컬 의존성** | `backend/mcp-server/node_modules/vibe-clinic` | `file:..` 링크로 현재 루트 코어 사용 | npm registry의 구 배포본과 구분한다. |
| 7 | **npm 배포본** | registry의 기존 패키지 | 원작자 계정의 과거 배포 상태 | 이 저장소는 `private: true`이며 publish하지 않는다. |
| 8 | **라이선스 귀속** | `LICENSE`, `NOTICE`, `vscode-extension/LICENSE`, `vscode-extension/NOTICE` | Apache-2.0, Vibe Clinic 수정분 Copyright 2026 gyeomsVibe | 원작 Copyright 2025 Rejard와 프로젝트 링크를 보존한다. |

## 판단 규칙

- "현재 코드"는 항상 **상태 2**를 뜻한다.
- 역사 아카이브는 증거 보존용이며 현재 동작 근거로 사용하지 않는다. 구 VSIX는 삭제됐으므로 현재 산출물로 간주하지 않는다.
- 테스트 통과는 현재 작업 트리에 대해서만 주장한다.
- GitHub 반영 여부는 반드시 `HEAD`와 `origin/main`을 비교해 판단한다.
- VSIX 실설치 검증과 npm/Marketplace 배포는 소스 테스트와 별도 상태로 보고한다.