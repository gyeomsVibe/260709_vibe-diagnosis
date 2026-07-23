# Vibe Clinic Workspace Map

최종 확인일: 2026-07-17

## 대표 저장소

- 유일한 대표 저장소: `D:\D_Workspace_NB\-google-workspace\-antigravity-workspace\260709_vibe-clinic`
- Git 원격 저장소: `git@github-gyeoms:gyeomsVibe/260709_vibe-clinic.git`
- 기본 브랜치: `main`

이 문서에 명시되지 않은 상위 폴더의 다른 프로젝트는 Vibe Clinic 작업 범위가 아니다.

## 현재 관련 경로

| 경로 | 역할 | 현재 정책 |
| --- | --- | --- |
| `260709_vibe-clinic` | 대표 저장소 | 유지, 사용자 미커밋 변경 보존 |
| `260709_vibe-clinic-dashboard-v2-20260716-035224` | V2 퇴역 완료 | Git worktree·잔여 폴더·브랜치 제거 완료 |
| `260709_vibe-clinic-support` | 통합 복구·지원 폴더 | 유지, 복구 자료 해시 검증 완료 |
| `260709_vibe-clinic-dashboard-handoff-20260716-043424` | V2 handoff | 해시 검증된 복구 자료로 유지 |
| `260709_vibe-diagnosis` | 구 세션 연결 경로 | 퇴역 완료, 루트 삭제 완료 |
| `C:\tmp\vibe-clinic-dashboard-v2-20260716` | 종료된 임시 Git worktree | 제거 완료 |

## 목표 구조

```text
260709_vibe-clinic/
260709_vibe-clinic-support/
├─ recovery/
│  ├─ baseline-20260716-035224/
│  └─ handoff-20260716-043424/
├─ worktrees/
└─ archive/
```

활성 worktree는 탐색기로 이동하지 않는다. 필요한 경우 변경사항을 보존한 뒤 `git worktree` 절차로 다시 만든다.

## 정제 진행 상태

- 지원 폴더 생성 완료: `D:\D_Workspace_NB\-google-workspace\-antigravity-workspace\260709_vibe-clinic-support`
- V1 기준선 복제 완료: `recovery\baseline-20260716-035224`
- V2 handoff 복제 완료: `recovery\handoff-20260716-043424`
- 원래 백업·handoff 폴더는 지원 폴더와 전 파일 대조 후 제거 완료했다.
- `worktrees`와 `archive`는 현재 비어 있으며 향후 승인된 작업에만 사용한다.

## 임시 경로 점검 결과

- `ui/dashboard-v2-20260716-035224`: `main` 병합 완료, 고유·미커밋 파일 0개 확인 후 Git worktree·잔여 폴더·브랜치를 모두 제거했다.
- `C:\tmp\vibe-clinic-dashboard-v2-20260716`: 중복 이미지 확인 후 worktree와 폴더 제거 완료.
- `ui/dashboard-v2-final-20260716`: 고유 커밋 0개 확인 후 브랜치 제거 완료.
- `ui/dashboard-v2-implementation-20260716`: 임시 worktree 종료 후 브랜치 제거 완료.
- 구 `260709_vibe-diagnosis` 경로는 대표 저장소에서 새 세션을 연 뒤 루트까지 삭제하여 퇴역을 완료했다.

## 안전 규칙

- 같은 상위 폴더의 다른 프로젝트를 열람·검색·수정·이동·삭제하지 않는다.
- `.env`, 인증키, 토큰, 자격증명 파일을 읽거나 출력하지 않는다.
- `git clean`, `git reset --hard`, 강제 체크아웃을 실행하지 않는다.
- 삭제·이동·이름 변경 전 절대경로, 이유, 복구 경로를 보고하고 별도 승인을 받는다.
- 복구 자료는 `복사 → SHA-256 검증 → 참조 전환 → 원본 제거 승인` 순서로 처리한다.
- 커밋, 병합, push는 각각 별도 승인 없이는 실행하지 않는다.
- 사용자 미커밋 변경과 신규 파일을 프로젝트 정리 작업에 섞지 않는다.

## 확인된 복구 기준

- V1 기준선 백업: manifest 26개, 누락 0개, 해시 불일치 0개
- V2 handoff snapshot: manifest 28개, 누락 0개, 해시 불일치 0개
- V2 ZIP 내부: manifest 28개, 누락 0개, 해시 불일치 0개
- V2 ZIP SHA-256: `8763DD8BBB81B0BC58898F17DAA5491F533F33685444EBB67CCCBA84AF09F44A`
## 저장소 파티션

- `backend/`: 실행 엔진, CLI, MCP, 테스트. MCP 진입점은 `backend/mcp-server/index.js`다.
- `frontend/`: 정식 V2 UI와 `legacy-v1/` 보관 UI다.
- `shared/`: API 계약의 단일 진실원이다.
- `docs/`: `plans/`, `handoff/`, `operations/`, `assets/`만 둔다.
- `integrations/`: `vscode-extension/`, `claude-vibe-check/`만 둔다.
- `handbook/`: 백신 개발법 교본이다. 도구·언어에 매이지 않는 방법론만 두고, 이 저장소 전용 설정이나 코드는 넣지 않는다.
- 사용자 저장 계획 자료는 `docs/plans/[user-docs] vibe-clinic-rebranding/`에 둔다. 이동·이름 변경·삭제 전에 이전·새 절대경로와 복구 방법을 고지하고 별도 승인을 받는다.