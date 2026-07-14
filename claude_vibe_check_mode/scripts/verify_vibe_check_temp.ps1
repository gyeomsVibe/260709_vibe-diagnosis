$ErrorActionPreference = "Stop"

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("vibe-check-claude-" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null

try {
  Push-Location $tempRoot
  & node "$PSScriptRoot\..\..\bin\vibe-clinic.js" init
  & node "$PSScriptRoot\..\..\bin\vibe-clinic.js" run
  if (!(Test-Path ".vibe-clinic")) {
    throw ".vibe-clinic was not created."
  }
  Write-Host "Vibe Clinic temp smoke test completed: $tempRoot"
}
finally {
  Pop-Location
}
