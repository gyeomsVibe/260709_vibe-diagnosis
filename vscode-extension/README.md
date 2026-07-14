# Vibe Clinic for VS Code

![Vibe Clinic Banner](vibe-clinic-banner.png)

Self-diagnosis framework for vibe coding projects.

## Features

- **Status Bar Health Indicator** — Shows project health percentage at a glance
- **Run Diagnostics** — Execute all `.clinic.js` files with one command
- **Auto Repair Review** — Opens the dashboard so you can inspect and approve an AI repair proposal (BYOK)
- **Open Dashboard** — Visual web dashboard with one-click diagnosis
- **Native Folder Picker** — Open a dashboard for any folder through VS Code's stable folder selector
- **Problems Panel** — ERROR/WARNING items appear in VS Code Problems panel

## Commands

| Command | Description |
|---|---|
| `Vibe Clinic: Run` | Run all diagnostics and show results |
| `Vibe Clinic: Init` | Initialize .vibe-clinic/ in current project |
| `Vibe Clinic: Open Dashboard` | Open the current workspace dashboard in browser |
| `Vibe Clinic: Open Dashboard for Folder` | Pick any folder with VS Code's native selector and open its dashboard |
| `Vibe Clinic: Auto Repair` | Open the dashboard to review and approve an AI repair proposal |
| `Vibe Clinic: Run (JSON)` | Output results as JSON |

## Quick Start

1. Open Command Palette (`Ctrl+Shift+P`)
2. Run `Vibe Clinic: Init`
3. Create `.clinic.js` files in `.vibe-clinic/diagnostics/`
4. Run `Vibe Clinic: Run` or click the status bar item

## Links

- [GitHub](https://github.com/gyeomsVibe/260709_vibe-clinic)
- [Issues](https://github.com/gyeomsVibe/260709_vibe-clinic/issues)
