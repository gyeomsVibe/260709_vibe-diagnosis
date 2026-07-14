# Vibe Clinic - Compile-free modern folder picker
#
# Opens the Windows 10/11 Explorer-style folder-pick dialog (IFileOpenDialog
# with FOS_PICKFOLDERS) WITHOUT any runtime C# compilation, by driving the
# COM interfaces already defined inside System.Windows.Forms via reflection.
# This avoids Add-Type/csc.exe entirely (antivirus/security-policy safe).
#
# ASCII-only on purpose: no non-ASCII characters, so the file parses the same
# under Windows PowerShell 5.1 (CP949) and PowerShell 7 regardless of BOM.
#
# Output contract (stdout):
#   SELECTED:<absolute path>   when the user picks a folder
#   (nothing)                  when the user cancels
#   DRYRUN_OK                  with -DryRun (verifies reflection chain, no UI)
#
# Requires -STA (caller must pass:  powershell -NoProfile -STA -File <this>)

param(
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Windows.Forms

$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.CheckFileExists = $false
$dialog.CheckPathExists = $true
$dialog.FileName = 'Select'

$parentType = $dialog.GetType().BaseType
$bf = [System.Reflection.BindingFlags]::Instance -bor [System.Reflection.BindingFlags]::NonPublic

# 1) Read the FOS options computed by the .NET wrapper
$getOptionsManaged = $parentType.GetMethod('GetOptions', $bf)
$currentFOS = $getOptionsManaged.Invoke($dialog, $null)

# 2) Add FOS_PICKFOLDERS (0x20)
$newFOSValue = [int]$currentFOS -bor 0x20
$newFOSEnum = [System.Enum]::ToObject($currentFOS.GetType(), $newFOSValue)

# 3) Create the internal Vista (IFileOpenDialog) COM object
$createVistaDialog = $parentType.GetMethod('CreateVistaDialog', $bf)
$vistaDialog = $createVistaDialog.Invoke($dialog, $null)

# 4) Apply the .NET wrapper's properties, then inject our options on top
$onBefore = $parentType.GetMethod('OnBeforeVistaDialog', $bf)
$onBefore.Invoke($dialog, @($vistaDialog))

$ifdType = $createVistaDialog.ReturnType
$ifdType.GetMethod('SetOptions').Invoke($vistaDialog, @($newFOSEnum))
$ifdType.GetMethod('SetTitle').Invoke($vistaDialog, @('Vibe Clinic - Select the target folder to inspect'))

if ($DryRun) {
  Write-Host 'DRYRUN_OK'
  exit 0
}

# 5) Foreground guarantee: own the dialog with an invisible top-most form so
#    it opens in front instead of behind other windows.
$owner = New-Object System.Windows.Forms.Form
$owner.TopMost = $true
$owner.ShowInTaskbar = $false
$owner.FormBorderStyle = 'None'
$owner.StartPosition = 'CenterScreen'
$owner.Opacity = 0
$owner.Show()
$owner.Activate()

try {
  # IFileDialog.Show is [PreserveSig] -> returns HRESULT (0 = user clicked OK,
  # non-zero e.g. 0x800704C7 = cancelled). It does not throw on cancel.
  $hr = $ifdType.GetMethod('Show').Invoke($vistaDialog, @($owner.Handle))

  if ($hr -eq 0) {
    # 6) Extract the picked folder path: GetResult(out IShellItem) then
    #    IShellItem.GetDisplayName(SIGDN_FILESYSPATH, out string).
    $getResultMethod = $ifdType.GetMethod('GetResult')
    $shellItemRefType = $getResultMethod.GetParameters()[0].ParameterType
    $shellItemType = if ($shellItemRefType.IsByRef) { $shellItemRefType.GetElementType() } else { $shellItemRefType }

    $resultArgs = @($null)
    $getResultMethod.Invoke($vistaDialog, $resultArgs)
    $shellItem = $resultArgs[0]

    if ($null -ne $shellItem) {
      $getDisplayName = $shellItemType.GetMethod('GetDisplayName')
      # First arg is the SIGDN enum (NOT an int) -> parse by name so the value
      # and type both match; passing a plain Int32 throws at Invoke.
      $sigdnType = $getDisplayName.GetParameters()[0].ParameterType
      if ($sigdnType.IsByRef) { $sigdnType = $sigdnType.GetElementType() }
      $sigdnFileSysPath = [System.Enum]::Parse($sigdnType, 'SIGDN_FILESYSPATH')

      $dnArgs = @($sigdnFileSysPath, $null)
      $getDisplayName.Invoke($shellItem, $dnArgs)
      $selectedPath = $dnArgs[1]
      if ($selectedPath) {
        Write-Host "SELECTED:$selectedPath"
      }
    }
  }
}
finally {
  $owner.Close()
  $owner.Dispose()
}
