# Vibe Diagnosis for VS Code

Self-diagnosis framework for vibe coding projects.

## Features

- **Status Bar Health Indicator** — Shows project health percentage at a glance
- **Run Diagnostics** — Execute all `.diag.js` files with one command
- **Auto Repair** — AI-powered auto-repair for failing diagnostics (BYOK)
- **Open Dashboard** — Visual web dashboard with one-click diagnosis
- **Problems Panel** — ERROR/WARNING items appear in VS Code Problems panel

## Commands

| Command | Description |
|---|---|
| `Vibe Diagnosis: Run` | Run all diagnostics and show results |
| `Vibe Diagnosis: Init` | Initialize .vibe-diagnosis/ in current project |
| `Vibe Diagnosis: Open Dashboard` | Open web dashboard in browser |
| `Vibe Diagnosis: Auto Repair` | AI-powered auto-repair for failing diagnostics |
| `Vibe Diagnosis: Run (JSON)` | Output results as JSON |

## Quick Start

1. Open Command Palette (`Ctrl+Shift+P`)
2. Run `Vibe Diagnosis: Init`
3. Create `.diag.js` files in `.vibe-diagnosis/diagnostics/`
4. Run `Vibe Diagnosis: Run` or click the status bar item

## Links

- [GitHub](https://github.com/gyeoms-vibe/260709_vibe-diagnosis)
- [npm (CLI)](https://www.npmjs.com/package/vibe-diagnosis)
- [npm (MCP Server)](https://www.npmjs.com/package/vibe-diagnosis-mcp)
