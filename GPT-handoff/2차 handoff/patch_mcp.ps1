$configPath = "C:\Users\Kimyoongyeom\.gemini\config\mcp_config.json"
$backupPath = "C:\Users\Kimyoongyeom\.gemini\config\mcp_config.json.bak"

if (Test-Path $configPath) {
    Copy-Item $configPath $backupPath -Force
    $json = Get-Content $configPath -Raw | ConvertFrom-Json
    
    if (-not $json.mcpServers) {
        $json | Add-Member -MemberType NoteProperty -Name "mcpServers" -Value @{}
    }
    
    if (-not $json.mcpServers.'vibe-diagnosis') {
        $vibe = [PSCustomObject]@{
            command = "npx"
            args = @("-y", "vibe-diagnosis-mcp")
        }
        $json.mcpServers | Add-Member -MemberType NoteProperty -Name "vibe-diagnosis" -Value $vibe
        
        $jsonStr = $json | ConvertTo-Json -Depth 10
        [System.IO.File]::WriteAllText($configPath, $jsonStr, [System.Text.Encoding]::UTF8)
        Write-Output "Successfully patched mcp_config.json"
    } else {
        Write-Output "vibe-diagnosis already configured"
    }
} else {
    Write-Error "mcp_config.json not found"
}
