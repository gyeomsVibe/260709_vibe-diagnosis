# Vibe Clinic Claude Code Boundary

작업 시작 전에 `WORKSPACE_MAP.md`를 읽고 그 경계를 따른다.

- 대표 저장소 밖의 형제 프로젝트를 탐색하거나 변경하지 않는다.
- 현재 미커밋 파일과 신규 파일을 사용자 소유 변경으로 취급한다.
- worktree는 Git 절차로만 관리하고 탐색기 이동·강제 삭제를 하지 않는다.
- 삭제·이동·이름 변경, 커밋, 병합, push 전 각각 승인을 받는다.
- 복구 사본은 SHA-256 검증 전 원본을 제거하지 않는다.
- 비밀정보와 자격증명 파일은 읽거나 출력하지 않는다.
## Repository partition and user materials

- MCP 진입점은 `backend/mcp-server/index.js` 하나만 사용한다.
- 런타임은 `backend/`, `frontend/`, `shared/`에, 문서는 `docs/`에, 도구 통합물은 `integrations/`에 둔다.
- `handbook/`은 프로젝트에 매이지 않는 방법론 교본(백신 개발법)이다. 이 저장소 사정으로 좁히지 말고, 다른 프로젝트에도 그대로 쓸 수 있게 유지한다.
- 사용자 저장 자료를 이동·이름 변경·삭제하기 전에는 이전·새 절대경로와 복구 방법을 먼저 고지하고 명시적 승인을 받는다.
- 이전 경로 참조를 고칠 때는 `docs/operations/agent-reference-path-migration.md`의 전환표를 사용한다.