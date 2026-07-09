$agentsPath = "C:\Users\Kimyoongyeom\.gemini\config\AGENTS.md"
$backupPath = "C:\Users\Kimyoongyeom\.gemini\config\AGENTS.md.bak"
$templatePath = "C:\Users\Kimyoongyeom\.gemini\antigravity-ide\brain\fc09e5df-9531-4bc8-a947-ee480e2d7f7f\scratch\agents_template.txt"

if (Test-Path $templatePath) {
    $ruleContent = Get-Content $templatePath -Raw -Encoding utf8
    
    if (Test-Path $agentsPath) {
        Copy-Item $agentsPath $backupPath -Force
        $content = Get-Content $agentsPath -Raw -Encoding utf8
        
        if (-not $content.Contains("# Vibe Diagnosis Global Rules")) {
            $newline = if ($content.EndsWith("`n")) { "" } else { "`r`n" }
            [System.IO.File]::AppendAllText($agentsPath, $newline + $ruleContent, [System.Text.Encoding]::UTF8)
            Write-Output "Successfully appended rules to AGENTS.md"
        } else {
            # Overwrite to clean up any previous encoding issues
            [System.IO.File]::WriteAllText($agentsPath, $ruleContent, [System.Text.Encoding]::UTF8)
            Write-Output "Vibe Diagnosis rules overwritten to resolve encoding"
        }
    } else {
        [System.IO.File]::WriteAllText($agentsPath, $ruleContent, [System.Text.Encoding]::UTF8)
        Write-Output "Successfully created AGENTS.md with rules"
    }
} else {
    Write-Error "Template file not found"
}
