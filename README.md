# 🩺 vibe-clinic

![Vibe Clinic Banner](./docs/assets/vibe-clinic-banner.png)

**Self-diagnosis framework for vibe coding projects**

When coding with AI agents, prove that your project works — with code.

> **Core Principle — Task ↔ Diagnostic 1:1 Mapping**: Every completed task must have a corresponding diagnostic that verifies it works correctly.

[한국어 README](./README.ko.md)

## Project partition

| Area | Responsibility |
| --- | --- |
| `backend/` | Runtime engine, CLI, MCP, and tests |
| `frontend/` | Production V2 UI and archived V1 UI |
| `shared/` | API contract source of truth |
| `docs/` | Plans, handoffs, operations, and non-runtime assets |
| `integrations/` | VS Code extension and Claude Vibe Check integration |
| `handbook/` | The Vaccine Method — a tool-agnostic handbook for finding hidden defects |

All AI tools use `backend/mcp-server/index.js` as the single MCP entry point.

---

## 📗 The Vaccine Method — [handbook/](./handbook/README.md)

Passing tests is not proof that something works. Software has two faces: the one you
see when everything is fine, and the one that only appears when something breaks.
Nobody looks at the second one, so that is where defects live.

The handbook teaches you to induce failures on purpose — the way a vaccine introduces
a weakened pathogen — and then open the screen and look. It is written in Korean for
readers who do not code, and it works on any project, not just this one.

Applied to this repository with **47 tests passing and a clean linter**, it surfaced
**3 real defects in a single day** — none of which produced an error message.
See [실증 사례](./handbook/05-실증-사례.md).

---

## 🚀 Quick Start (MCP — Easiest)

The fastest way to use vibe-clinic is through **MCP** (Model Context Protocol). Just add the config to your AI tool and start coding.

### 1. Add MCP config

Add the following JSON block to your AI tool's config file:

| AI Tool | Config File Path |
|---|---|
| **Antigravity** (Gemini) | `.gemini/settings.json` (project) or `~/.gemini/config/mcp_config.json` (global) |
| **Claude Code** | `~/.claude.json` |
| **Codex** | `~/.codex/config.toml` |
| **Claude Desktop** | `%APPDATA%/Claude/claude_desktop_config.json` (Win) · `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac) |
| **Cursor** | `.cursor/mcp.json` |
| **Windsurf** | `~/.codeium/windsurf/mcp_config.json` |

```json
{
  "mcpServers": {
    "vibe-clinic": {
      "command": "node",
      "args": ["<absolute-path-to-repository>/backend/mcp-server/index.js"]
    }
  }
}
```

> **Local-only by design.** `vibe-clinic` is a private package and is **not published to npm** — there is no `npx vibe-clinic` install. Point the MCP config at the repository's `backend/mcp-server/index.js` by absolute path, as shown above. (If a project currently pulls in the upstream `vibe-diagnosis` from npm, that is a separate, older package; switch it to this MCP config to use vibe-clinic.)

**Codex uses TOML, not JSON** — put this in `~/.codex/config.toml` instead:

```toml
[mcp_servers.vibe_clinic]
command = "node"
args = ["<absolute-path-to-repository>/backend/mcp-server/index.js"]
startup_timeout_sec = 60.0
```

### 2. Tell your AI agent

> "Apply vibe-clinic to this project"

Done. The AI will initialize diagnostics, generate `.clinic.js` files, and open the dashboard automatically.

---

## 💬 Quick Triggers

Once MCP is installed, just talk to your AI:

### English

| Say this | What happens |
|---|---|
| "Apply vibe-clinic to this project" | `init_clinic` → setup + generate diagnostics + dashboard |
| "Run diagnostics" | `run_clinic` → run all checks |
| "Open diagnosis dashboard" | `open_dashboard` → browser dashboard |
| "Write error pattern" | `write_error_pattern` → log error pattern |

### 한국어

| 말하기 | 실행 결과 |
|---|---|
| "자가진단 MCP 적용해줘" | `init_clinic` → 초기화 + 진단 생성 + 대시보드 |
| "자가진단 실행해줘" | `run_clinic` → 전체 진단 실행 |
| "대시보드 열어줘" | `open_dashboard` → 브라우저 대시보드 |
| "진단 돌려줘" | `run_clinic` → 결과 요약 |

### Example Workflow

```
You: "Apply vibe-clinic to this project"
 AI: → init_clinic          ← .vibe-clinic/ created
 AI: → generates .clinic.js files  ← diagnostics for existing code
 AI: → open_dashboard            ← browser opens http://localhost:7700
 AI: → run_clinic           ← Health 100% ✅
```

---

## 📦 CLI

Run the CLI from the repository root:

> [!IMPORTANT]
> Running via npm/npx registry package is currently **not** supported/standard as the registry version does not align with the latest repository changes. You must execute from the local repository root via `node ./backend/bin/vibe-clinic.js` (or `node .\backend\bin\vibe-clinic.js` on Windows).

```bash
# Windows PowerShell
node .\backend\bin\vibe-clinic.js init                        # Initialize .vibe-clinic/ + auto-configure MCP
node .\backend\bin\vibe-clinic.js run                         # Run all diagnostics
node .\backend\bin\vibe-clinic.js run --json                  # JSON output (for CI/CD)
node .\backend\bin\vibe-clinic.js dashboard                   # Open web dashboard
node .\backend\bin\vibe-clinic.js config get                  # Show BYOK configuration
node .\backend\bin\vibe-clinic.js config set provider gemini  # Set AI provider (gemini only)
node .\backend\bin\vibe-clinic.js config set apiKey ...       # Set API key
node .\backend\bin\vibe-clinic.js config set model gemini-3.5-flash  # Set model name
node .\backend\bin\vibe-clinic.js repair <diagId>             # Auto-repair a specific diagnostic
node .\backend\bin\vibe-clinic.js repair --all                # Auto-repair all failing diagnostics
npm run sync:rules                        # Validate the project adapter and local skill (no writes)
npm run sync:rules:global                 # Explicitly copy the full local skill to the user-global Claude skill

# macOS/Linux/Git Bash
node ./backend/bin/vibe-clinic.js init
node ./backend/bin/vibe-clinic.js run
node ./backend/bin/vibe-clinic.js run --json
node ./backend/bin/vibe-clinic.js dashboard
node ./backend/bin/vibe-clinic.js config get
node ./backend/bin/vibe-clinic.js config set provider gemini
node ./backend/bin/vibe-clinic.js config set apiKey ...
node ./backend/bin/vibe-clinic.js config set model gemini-3.5-flash
node ./backend/bin/vibe-clinic.js repair <diagId>
node ./backend/bin/vibe-clinic.js repair --all
npm run sync:rules
npm run sync:rules:global
```

> **Note on `init`:** In addition to creating `.vibe-clinic/`, `init` registers the MCP server by creating or updating `.gemini/settings.json` in your project (adding a `vibe-clinic` entry under `mcpServers`). An existing `vibe-clinic` entry is left untouched. It also adds `.vibe-clinic/config.json` to your `.gitignore`.

### Writing a diagnostic

Create `.clinic.js` files in `.vibe-clinic/diagnostics/`:

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

**Optional fields:** `linkedTask` (the task id this diagnostic verifies) and `timeout` (per-diagnostic time budget in milliseconds, default `30000`). If a diagnostic exceeds its timeout it is reported as `ERROR` instead of hanging the whole run.

### Output example

```
  Vibe Clinic v2.0.0 — my-project
  ─────────────────────────────────────────

  TASK │ task-001-user-login       │ ✅ OK      │ Login flow verified
  FUNC │ func-auth-token           │ ✅ OK      │ JWT validation passed
  SYS  │ sys-database              │ ⚠️ WARNING │ Connection pool at 80%

  ─────────────────────────────────────────
  Total: 3 nodes │ OK: 2 │ WARN: 1 │ ERR: 0
  Overall: ⚠️ WARNING — Health 67%
```

---

## 🖥️ Web Dashboard

```bash
# Windows PowerShell
node .\backend\bin\vibe-clinic.js dashboard            # http://localhost:7700
node .\backend\bin\vibe-clinic.js dashboard --port 8080

# macOS/Linux/Git Bash
node ./backend/bin/vibe-clinic.js dashboard
node ./backend/bin/vibe-clinic.js dashboard --port 8080
```

The dashboard server binds to `127.0.0.1` only, so it is not exposed to other machines on your network.

> [!TIP]
> **Dashboard Verified:** Local dashboard execution has been successfully verified under Windows PowerShell environment using `node .\backend\bin\vibe-clinic.js dashboard` and API calls on `http://localhost:7700`.

Features:
- **Korean Localization**: Fully localized UI text and dynamic auto-repair feedback
- Health ring gauge with percentage
- Diagnostic cards grid (color-coded by layer)
- One-click "Run Diagnostics" button
- Error pattern viewer with modal
- Dark mode premium UI
- BYOK configuration bar (Provider / API Key / Model)
- Auto Repair button on ERROR and WARNING cards
- AI status indicator (connected / disconnected)

---

## 🤖 BYOK Auto Repair

**Bring Your Own Key** — connect your own AI provider to automatically analyze and fix failing diagnostics, right from the dashboard.

No vendor lock-in. Your API key stays on your machine and is never sent anywhere except the provider you choose.

### Supported Provider

Vibe Clinic 2.0.1 is **Google Gemini only** (other providers were removed to keep the UI simple):

| Provider | Model examples |
|---|---|
| **Google Gemini** | `gemini-3.5-flash`, `gemini-2.5-flash`, `gemini-2.5-pro` |

### Dashboard Configuration

Open the dashboard and use the BYOK settings panel:

1. Enter your **Gemini API Key**
2. Optionally pick a **Model** (default: `gemini-3.5-flash`)
3. Click **Save** — settings are stored locally in `.vibe-clinic/config.json`

Once configured, ERROR and WARNING diagnostic cards will show an **Auto Repair** button. It creates an AI repair proposal; review the Diff and explicitly approve it before any file is changed.

### How Auto Repair works (boundaries)

- Auto Repair first creates a **read-only proposal** — no file or backup is written until you click **Approve & Apply**.
- A proposal is one-time, expires after 10 minutes, and is rejected if its original file changed after preview.
- Approved repairs use **whole-file replacement** — the AI returns complete file contents, not partial patches.
- A `.bak` backup of each file is created **only when an approved change is written**.
- After applying changes, the failing diagnostic is **re-run automatically**.
- Success is judged **only by the re-run result** (`status === 'OK'`), never by the AI's own claim.

### Environment Variable Override

You can also configure BYOK via environment variables (useful for CI/CD or team-shared setups):

```bash
export VIBE_CLINIC_PROVIDER=gemini      # gemini only in 2.0.1
export VIBE_CLINIC_API_KEY=...
export VIBE_CLINIC_MODEL=gemini-3.5-flash  # optional, uses provider default
```

Environment variables take precedence over `config.json` settings.

### Security

- API keys are stored locally in `.vibe-clinic/config.json`
- `config.json` is automatically added to `.gitignore` during `init`
- Keys are never logged, transmitted to third parties, or included in diagnostics output

---

## 🧩 VS Code Extension

Search `vibe-clinic` in VS Code Extensions Marketplace, or install from `.vsix`:

1. `Ctrl+Shift+P` → "Install from VSIX..."
2. Select `vibe-clinic-vscode-2.0.1.vsix`

**Commands:**
- `Vibe Clinic: Run` — Run all diagnostics
- `Vibe Clinic: Init` — Initialize project
- `Vibe Clinic: Open Dashboard` — Open the workspace dashboard
- `Vibe Clinic: Open Dashboard for Folder` — Pick any folder with VS Code's native selector
- `Vibe Clinic: Auto Repair` — Opens the dashboard so you can review and approve a repair proposal
- Status bar shows health percentage

---

## 🤖 MCP Tools Reference

| Tool | Description |
|---|---|
| `run_clinic` | Run all diagnostics → JSON results |
| `init_clinic` | Initialize .vibe-clinic/ |
| `list_clinics` | List diagnostic files + metadata |
| `read_error_pattern` | Read past error pattern logs |
| `write_error_pattern` | Record new error patterns |
| `open_dashboard` | Open web dashboard in browser |

---

## 🔁 One-Touch Check Mode (VIBE_CHECK_AUTORUN_MODE)

An approval-based autorun mode: you approve the session once, and the agent runs the full **init → diagnose → minimal fix → re-diagnose → report** loop by itself. The complete procedure lives in [.claude/skills/vibe-check/SKILL.md](./.claude/skills/vibe-check/SKILL.md) (Claude Code). [GEMINI.md](./GEMINI.md) is the lightweight Antigravity/Gemini project adapter; both share the same triggers.

### First time (one-shot session approval)

```text
VIBE_CHECK_AUTORUN_MODE를 이 프로젝트에 적용해줘.
로컬 파일 수정과 로컬 테스트 실행까지 승인한다.
원격 push, publish, release는 금지한다.
```

### Every time after

<table align="center">
  <thead>
    <tr>
      <th align="center" width="150">Trigger style</th>
      <th align="center" width="760">Say this</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="center">Short</td>
      <td align="center"><code>"vibe-check 해줘"</code></td>
    </tr>
    <tr>
      <td align="center"><strong>Normal<br>(recommended)</strong></td>
      <td align="center"><strong>"이 프로젝트 점검해서 교정해줘"</strong></td>
    </tr>
    <tr>
      <td align="center">Precise</td>
      <td align="left">"이 프로젝트를 vibe-clinic 기준으로 점검해서 교정해줘. 초기화가 안 되어 있으면 초기화하고, 진단을 실행하고, 실패한 항목만 최소 수정한 뒤, 다시 진단해서 결과를 단계별로 설명해줘."</td>
    </tr>
  </tbody>
</table>

What the agent will **never** do without separate explicit approval: `git push`, `npm publish`, creating releases, requesting/storing real API keys, or declaring the project release-ready.

---

## 🔄 Agent Automation

Add to your project's `.agents/AGENTS.md` or `CLAUDE.md`:

```markdown
## Vibe Clinic Rules
- Run `run_clinic` after every completed task
- Record error patterns with `write_error_pattern`
- Create a matching .clinic.js file for each new task
```

---

## Three-Layer Diagnostics

| Layer | Verifies |
|---|---|
| **TASK** | Was the task's intent achieved? |
| **FUNCTION** | Do critical functions produce correct outputs including edge cases? |
| **SYSTEM** | External service connectivity, data integrity, infrastructure health |

---

## Error Patterns

When the agent encounters recurring errors, they are recorded in `.vibe-clinic/error-patterns/`:

```
.vibe-clinic/error-patterns/
└── ERR_001_division_nan.md
```

These logs are referenced in future sessions to avoid repeating the same mistakes.

---

## Release Mode

For production, remove or gitignore the diagnostics directory:

```gitignore
.vibe-clinic/
```

---

## Development

Run the unit test suite (Node's built-in test runner, no dependencies):

```bash
npm test              # unit tests in test/
npm run test:self     # dogfooding — run this project's own diagnostics
npm run test:example  # run the calculator example diagnostics
```

---

## License

Apache License 2.0 — Open, Royalty-Free

Vibe Clinic modifications are Copyright 2026 gyeomsVibe. The original Vibe Diagnosis work remains Copyright 2025 Rejard.

See [LICENSE](./LICENSE) and [NOTICE](./NOTICE) for details.
