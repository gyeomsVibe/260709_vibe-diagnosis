# ERR_002: VS Code 확장 npx 폴백 패키지명 불일치 오류

> [!NOTE]
> **Status: Superseded by LOCAL CLI COMMAND RESTORE**
> 이 오류 보고서의 개선 방식인 `npx --package`는 과거 레지스트리 호출 버그를 다룰 때 제안된 중간 해결책으로 현재는 **폐기(Superseded)**되었습니다. 현재 저장소 표준은 로컬 소스 기준 기동(`node ./bin/vibe-diag.js`)입니다.

## 현상 및 증상
- 개발용 저장소 외부의 프로젝트에서 VS Code 확장(`vibe-diagnosis-vscode`)을 통해 `Vibe Diagnosis: Run`, `Vibe Diagnosis: Init`, `Vibe Diagnosis: Open Dashboard` 등의 명령을 실행할 때 CLI 도구 호출에 실패함.
- 터미널 출력 및 로그에 `npx: 에러` 또는 `404 Not Found (vibe-diag)` 에러가 발생함.

---

## 원인 분석
1. **바이너리명과 패키지명 불일치**:
   - `vibe-diagnosis` 자가진단 프레임워크의 npm 패키지 이름은 `vibe-diagnosis`이나, 정의된 CLI 바이너리 명칭은 `vibe-diag`입니다.
2. **잘못된 npx 호출 방식**:
   - 기존의 VS Code 확장 소스 코드에서는 로컬 바이너리가 없을 경우 `npx vibe-diag ...` 또는 `npx -y vibe-diagnosis ...`를 기본 fallback으로 실행했습니다.
   - `npx vibe-diag`는 npm registry에 존재하지 않는 `vibe-diag` 패키지를 찾기 때문에 404 에러로 실패합니다.
   - `npx vibe-diagnosis`는 패키지는 받아오지만 내부에서 패키지명과 같은 `vibe-diagnosis` 바이너리를 실행하려 시도하므로, `vibe-diag` 바이너리를 찾지 못해 실행에 실패합니다.
3. **캐시 의존성 문제**:
   - 개발자 로컬 PC에서는 mcp-server 설치 과정 등에서 `vibe-diagnosis` 캐시가 남아있어 우연히 실행되는 것처럼 보였으나, 캐시가 없는 새로운 환경에서는 완전히 실패하게 됩니다.

---

## 해결 방법 (과거 기록 및 현재 복구 표준)

### 과거 오답 노스탤지어 (중간 제안)
과거에는 아래와 같이 `--package`를 주는 방식으로 npx를 우회하려고 했으나, 이는 로컬 저장소 코드와 npm 레지스트리 패키지 간의 버전 불일치 및 윈도우 환경 실행 에러가 존재하여 현재는 **사용하지 않는 폐기된 해결책**입니다.
```bash
npx -y --package=vibe-diagnosis vibe-diag run --json --cwd <workspace>
```

### 현재 표준 해결책 (로컬 소스 직접 기동)
현재 이 프로젝트는 복잡한 레지스트리 우회 시도를 모두 도려내고, 저장소 루트에 있는 검증된 로컬 소스코드를 직접 node로 호출하는 것을 기본 표준으로 지정하고 있습니다.

- **Windows PowerShell**:
  ```powershell
  node .\bin\vibe-diag.js <command>
  ```
- **macOS / Linux / Git Bash**:
  ```bash
  node ./bin/vibe-diag.js <command>
  ```

---

## VS Code 확장 프로그램의 대책 (현재 정책)
- 현재 `vscode-extension/src/extension.js` 소스는 더 이상 npx/npm registry fallback 시도를 지원하지 않습니다.
- 아래 3가지 경로를 순서대로 탐색하여 로컬 CLI 파일만을 식별합니다:
  1. 개발 중인 저장소 내 바이너리 (`../../bin/vibe-diag.js`)
  2. Workspace 내 로컬 바이너리 (`workspace/bin/vibe-diag.js`)
  3. Workspace 내 `node_modules`에 설치된 패키지 바이너리 (`workspace/node_modules/vibe-diagnosis/bin/vibe-diag.js`)
- 위 경로에서 로컬 CLI 파일을 발견하지 못하면, 원격 registry 호출을 강제 차단하고 사용자에게 명확히 `"vibe-diagnosis local CLI not found. Open the vibe-diagnosis repository or configure MCP/local CLI path."` 에러를 표출하도록 설계되었습니다.
