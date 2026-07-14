Add-Type -AssemblyName System.Windows.Forms
$d = New-Object System.Windows.Forms.OpenFileDialog
$t = $d.GetType()
$parent = $t.BaseType

# GetOptions 메서드 호출
$getOptionsMethod = $parent.GetMethod("GetOptions", [System.Reflection.BindingFlags]::Instance -bor [System.Reflection.BindingFlags]::NonPublic)
$fosValue = $getOptionsMethod.Invoke($d, $null)
Write-Host "=== GetOptions (FOS enum) value: $([int]$fosValue) (0x$([int]$fosValue | ForEach-Object { $_.ToString('X8') }))"
Write-Host "FOS_PICKFOLDERS (0x20) is set: $(([int]$fosValue -band 0x20) -ne 0)"

# FOS enum values 확인
Write-Host ""
Write-Host "=== FOS enum type ==="
$fosType = $fosValue.GetType()
Write-Host "Type: $fosType"
$enumNames = [System.Enum]::GetNames($fosType)
foreach ($name in $enumNames) {
    $val = [int]([System.Enum]::Parse($fosType, $name))
    Write-Host "  $name = 0x$($val.ToString('X8'))"
}

# CreateVistaDialog 메서드 확인
Write-Host ""
Write-Host "=== CreateVistaDialog return type ==="
$createMethod = $parent.GetMethod("CreateVistaDialog", [System.Reflection.BindingFlags]::Instance -bor [System.Reflection.BindingFlags]::NonPublic)
Write-Host "Return type: $($createMethod.ReturnType.FullName)"

# IFileDialog 인터페이스 메서드 확인
$ifdType = $createMethod.ReturnType
$ifdMethods = $ifdType.GetMethods()
foreach ($m in $ifdMethods) {
    Write-Host "  $($m.Name)($($m.GetParameters() | ForEach-Object { $_.ParameterType.Name }) -join ', ')"
}
