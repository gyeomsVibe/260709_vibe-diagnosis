# Vibe Clinic Folder Picker - Compile-free Reflection v3
# Strategy: Skip GetOptions (out param fails in PS), use GetOptions from
#           the .NET wrapper level, then SetOptions on the COM dialog directly

Add-Type -AssemblyName System.Windows.Forms

$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.CheckFileExists = $false
$dialog.CheckPathExists = $true
$dialog.FileName = "Select"

$parentType = $dialog.GetType().BaseType

# Step 1: Get FOS options from the .NET wrapper (this works - already tested)
$getOptionsManaged = $parentType.GetMethod(
    "GetOptions",
    [System.Reflection.BindingFlags]::Instance -bor [System.Reflection.BindingFlags]::NonPublic
)
$currentFOS = $getOptionsManaged.Invoke($dialog, $null)
Write-Host "Current FOS from .NET wrapper: $([int]$currentFOS) (0x$([int]$currentFOS | ForEach-Object { $_.ToString('X8') }))"

# Step 2: Add FOS_PICKFOLDERS (0x20)
$newFOSValue = [int]$currentFOS -bor 0x20
$fosEnumType = $currentFOS.GetType()
$newFOSEnum = [System.Enum]::ToObject($fosEnumType, $newFOSValue)
Write-Host "New FOS with PICKFOLDERS: $newFOSValue (0x$($newFOSValue.ToString('X8')))"

# Step 3: Create the internal Vista dialog
$createVistaDialog = $parentType.GetMethod(
    "CreateVistaDialog",
    [System.Reflection.BindingFlags]::Instance -bor [System.Reflection.BindingFlags]::NonPublic
)
$vistaDialog = $createVistaDialog.Invoke($dialog, $null)
Write-Host "Vista dialog created: $($vistaDialog -ne $null)"

# Step 4: Apply .NET properties to the dialog first
$onBefore = $parentType.GetMethod(
    "OnBeforeVistaDialog",
    [System.Reflection.BindingFlags]::Instance -bor [System.Reflection.BindingFlags]::NonPublic
)
$onBefore.Invoke($dialog, @($vistaDialog))
Write-Host "OnBeforeVistaDialog applied"

# Step 5: Set options with FOS_PICKFOLDERS via COM interface type
$ifdType = $createVistaDialog.ReturnType
$setOptionsMethod = $ifdType.GetMethod("SetOptions")
Write-Host "SetOptions method found: $($setOptionsMethod -ne $null)"
$setOptionsMethod.Invoke($vistaDialog, @($newFOSEnum))
Write-Host "FOS_PICKFOLDERS injected successfully"

# Step 6: Set title
$setTitleMethod = $ifdType.GetMethod("SetTitle")
$setTitleMethod.Invoke($vistaDialog, @("Vibe Clinic - Select Target Folder"))

# Step 7: Show the dialog
$showMethod = $ifdType.GetMethod("Show")
$hr = $showMethod.Invoke($vistaDialog, @([System.IntPtr]::Zero))
Write-Host "Show result: $hr"

if ($hr -eq 0) {
    # Step 8: Get result - GetResult has out IShellItem param
    $getResultMethod = $ifdType.GetMethod("GetResult")
    $shellItemInterfaceType = $getResultMethod.GetParameters()[0].ParameterType

    # Need to handle out parameter correctly
    $args = @($null)
    $getResultMethod.Invoke($vistaDialog, $args)
    $shellItem = $args[0]
    Write-Host "Shell item retrieved: $($shellItem -ne $null)"

    if ($shellItem -ne $null) {
        # GetDisplayName with SIGDN_FILESYSPATH
        $getDisplayNameMethod = $shellItemInterfaceType.GetMethod("GetDisplayName")
        $dnArgs = @([int]0x80028000, $null)
        $getDisplayNameMethod.Invoke($shellItem, $dnArgs)
        $selectedPath = $dnArgs[1]
        Write-Host "SELECTED:$selectedPath"
    }
}
