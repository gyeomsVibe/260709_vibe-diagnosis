# Vibe Clinic for VS Code

Self-diagnosis framework for vibe coding projects.

## Features

- **Status Bar Health Indicator** — Shows project health percentage at a glance
- **Run Diagnostics** — Execute all `.clinic.js` files with one command
- **Auto Repair** — AI-powered auto-repair for failing diagnostics (BYOK)
- **Open Dashboard** — Visual web dashboard with one-click diagnosis
- **Problems Panel** — ERROR/WARNING items appear in VS Code Problems panel

## Commands

| Command | Description |
|---|---|
| `Vibe Clinic: Run` | Run all diagnostics and show results |
| `Vibe Clinic: Init` | Initialize .vibe-clinic/ in current project |
| `Vibe Clinic: Open Dashboard` | Open web dashboard in browser |
| `Vibe Clinic: Auto Repair` | AI-powered auto-repair for failing diagnostics |
| `Vibe Clinic: Run (JSON)` | Output results as JSON |

## Quick Start

1. Open Command Palette (`Ctrl+Shift+P`)
2. Run `Vibe Clinic: Init`
3. Create `.clinic.js` files in `.vibe-clinic/diagnostics/`
4. Run `Vibe Clinic: Run` or click the status bar item

## Links

- [GitHub](https://github.com/gyeomsVibe/260709_vibe-clinic)
- [npm (CLI)](https://www.npmjs.com/package/vibe-clinic)
- [npm (MCP Server)](https://www.npmjs.com/package/vibe-clinic-mcp)
