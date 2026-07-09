$ErrorActionPreference = "Stop"

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("vibe-check-claude-" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null

try {
  Push-Location $tempRoot
  & npx vibe-diagnosis init
  & npx vibe-diagnosis run
  if (!(Test-Path ".vibe-diagnosis")) {
    throw ".vibe-diagnosis was not created."
  }
  Write-Host "Vibe diagnosis temp smoke test completed: $tempRoot"
}
finally {
  Pop-Location
}
