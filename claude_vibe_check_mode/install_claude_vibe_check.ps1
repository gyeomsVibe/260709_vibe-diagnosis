param(
  [switch]$RunSmokeTest = $true
)

$ErrorActionPreference = "Stop"

function Ensure-Dir($Path) {
  if (!(Test-Path $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }
}

function Write-Utf8($Path, $Text) {
  $dir = Split-Path -Parent $Path
  Ensure-Dir $dir
  [System.IO.File]::WriteAllText($Path, $Text, [System.Text.UTF8Encoding]::new($false))
}

$HomeDir = $env:VIBE_CHECK_TEST_HOME
if ([string]::IsNullOrEmpty($HomeDir)) {
  $HomeDir = [Environment]::GetFolderPath("UserProfile")
}
$ClaudeDir = Join-Path $HomeDir ".claude"
$SkillDir = Join-Path $ClaudeDir "skills\vibe-check"
$SkillPath = Join-Path $SkillDir "SKILL.md"
$ClaudeMdPath = Join-Path $ClaudeDir "CLAUDE.md"

$SourceRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $SourceRoot
$McpServerPath = Join-Path $ProjectRoot "backend\mcp-server\index.js"
$SkillSource = Join-Path $SourceRoot ".claude\skills\vibe-check\SKILL.md"
$SnippetSource = Join-Path $SourceRoot "global\CLAUDE.md.snippet"

Ensure-Dir $SkillDir
Copy-Item $SkillSource $SkillPath -Force

$snippet = Get-Content $SnippetSource -Raw -Encoding UTF8
$start = "<!-- VIBE_CHECK_GLOBAL_RULES_START -->"
$end = "<!-- VIBE_CHECK_GLOBAL_RULES_END -->"

if (Test-Path $ClaudeMdPath) {
  $existing = Get-Content $ClaudeMdPath -Raw -Encoding UTF8
} else {
  $existing = ""
}

$pattern = [regex]::Escape($start) + "(?s).*?" + [regex]::Escape($end)
$wrappedSnippet = $start + "`n" + $snippet.Trim() + "`n" + $end
if ($existing -match $pattern) {
  $updated = [regex]::Replace($existing, $pattern, [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $wrappedSnippet })
} else {
  $updated = ($existing.TrimEnd() + "`n`n" + $wrappedSnippet + "`n")
}
Write-Utf8 $ClaudeMdPath $updated

$claude = Get-Command claude -ErrorAction SilentlyContinue
if ($null -ne $claude) {
  $mcpList = ""
  try {
    $mcpList = (& claude mcp list 2>&1 | Out-String)
  } catch {
    $mcpList = ""
  }

  if ($mcpList -notmatch "vibe-clinic") {
    & claude mcp add vibe-clinic -- node $McpServerPath
  }
} else {
  Write-Host "WARN: Claude Code CLI was not found on PATH. Skill and CLAUDE.md were installed; MCP registration was skipped."
}

if ($RunSmokeTest) {
  $verify = Join-Path $SourceRoot "scripts\verify_vibe_check_temp.ps1"
  & powershell -ExecutionPolicy Bypass -File $verify
}

Write-Host "VIBE_CHECK_CLAUDE_CODE_MODE installation/update completed."
Write-Host "Installed skill: $SkillPath"
Write-Host "Updated memory: $ClaudeMdPath"
