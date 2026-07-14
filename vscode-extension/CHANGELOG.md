# Change Log

## 1.1.4
- Fixed (root cause): removed the `npx vibe-clinic` fallback entirely — it caused `npm 404 Not Found (vibe-clinic@*)` in any project without a local CLI, because no npm package named `vibe-clinic` exists (the package is `vibe-clinic`)
- Added: `vibeClinic.cliPath` setting — point it at an absolute `bin/vibe-clinic.js` to run diagnostics in ANY project via `--cwd`
- Changed: when no CLI is found, auto-run on activation degrades quietly (neutral `$(circle-slash)` status bar) instead of dumping an npm error; explicit Run shows a clear, actionable message

## 1.1.3
- Fixed: npx fallback execution command for CLI in non-cached environments (corrected from package-name-only fallback to target executable `vibe-clinic` within `vibe-clinic` package using `--package=vibe-clinic`)

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
