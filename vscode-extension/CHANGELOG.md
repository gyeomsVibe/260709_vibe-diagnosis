# Change Log

## 1.1.3
- Fixed: npx fallback execution command for CLI in non-cached environments (corrected from package-name-only fallback to target executable `vibe-diag` within `vibe-diagnosis` package using `--package=vibe-diagnosis`)

## 1.1.2
- Changed: publisher and repository metadata updated to the renamed GitHub account gyeomsVibe (was gyeoms-vibe); no functional changes

## 1.1.1
- Fixed: dashboard launched from VS Code was killed after 5 seconds (exec timeout → detached spawn)
- Fixed: Auto Repair now syncs dashboard run state before repairing and reports a clear error when the dashboard server is not running
- Changed: publisher/repository metadata now points to gyeoms-vibe/260709_vibe-diagnosis (original author Rejard preserved in contributors)

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
