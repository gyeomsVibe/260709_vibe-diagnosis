# Change Log

## 2.0.0
- Breaking: rebranded the extension and all command IDs to Vibe Clinic
- Breaking: project state now uses `.vibe-clinic/` and `*.clinic.js` exclusively
- Changed: CLI discovery now targets `bin/vibe-clinic.js` and the `vibeClinic.cliPath` setting
- Changed: repository metadata now points to `gyeomsVibe/260709_vibe-clinic`
## 1.1.4
- Fixed: removed the registry fallback; the extension now requires an explicit local Vibe Clinic CLI path
- Added: `vibeClinic.cliPath` setting — point it at an absolute `bin/vibe-clinic.js` to run diagnostics in ANY project via `--cwd`
- Changed: when no CLI is found, auto-run on activation degrades quietly (neutral `$(circle-slash)` status bar) instead of dumping an npm error; explicit Run shows a clear, actionable message

## 1.1.3
- Historical: attempted to correct the registry fallback before local-only execution became the project standard

## 1.1.2
- Changed: publisher and repository metadata updated to the renamed GitHub account gyeomsVibe (was gyeoms-vibe); no functional changes

## 1.1.1
- Fixed: dashboard launched from VS Code was killed after 5 seconds (exec timeout → detached spawn)
- Fixed: Auto Repair now syncs dashboard run state before repairing and reports a clear error when the dashboard server is not running
- Changed: publisher/repository metadata now points to gyeoms-vibe/260709_vibe-clinic (original author Rejard preserved in contributors)

## 1.1.0
- Added: Auto Repair command (BYOK AI-powered auto-repair)
- Added: QuickPick UI for selecting which diagnostic to repair
- Added: Dashboard API integration for repair workflow

## 1.0.1
- Added: Open Dashboard command
- Added: Marketplace icon
- Improved: Extension metadata

## 1.0.0
- Initial release
- Run diagnostics from VS Code
- Status bar health indicator
- Problems panel integration
