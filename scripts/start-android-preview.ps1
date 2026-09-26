[CmdletBinding()]
param(
    [switch]$CheckOnly,
    [switch]$OpenOnly
)

$ErrorActionPreference = 'Stop'
if ($CheckOnly -and $OpenOnly) { throw 'Use either -CheckOnly or -OpenOnly.' }

$repoRoot = Split-Path -Parent $PSScriptRoot
$mobileRoot = Join-Path $repoRoot 'apps\mobile'
$expoCli = Join-Path $repoRoot 'node_modules\expo\bin\cli'
$avdName = 'tomurai_pixel_api35'
$deviceSerial = 'emulator-5556'
$metroPort = 8081
$nodePath = (Get-Command node.exe -ErrorAction Stop).Source

$sdkRoot = @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT, (Join-Path $env:LOCALAPPDATA 'Android\Sdk')) |
    Where-Object { $_ -and (Test-Path -LiteralPath (Join-Path $_ 'platform-tools\adb.exe')) } |
    Select-Object -First 1
if (-not $sdkRoot) { throw 'Android SDK was not found. Install/configure it separately; this launcher does not install SDK components.' }
$adbPath = Join-Path $sdkRoot 'platform-tools\adb.exe'
$emulatorPath = Join-Path $sdkRoot 'emulator\emulator.exe'
foreach ($requiredPath in @($expoCli, $emulatorPath)) {
    if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) { throw "Required file is missing: $requiredPath" }
}
$availableAvds = @(& $emulatorPath -list-avds)
if ($LASTEXITCODE -ne 0) { throw 'Could not list existing Android virtual devices.' }
if ($availableAvds -notcontains $avdName) {
    throw "The dedicated AVD '$avdName' is missing. Create it separately using the installed Android 35 image. This launcher never creates or wipes an AVD."
}

function Get-PreviewListeners {
    @(Get-NetTCPConnection -State Listen -ErrorAction Stop)
}

function Get-TargetState {
    $devices = @(& $adbPath devices)
    if ($LASTEXITCODE -ne 0) { throw 'ADB could not list devices.' }
    foreach ($deviceLine in $devices) {
        if ($deviceLine -match ('^' + [regex]::Escape($deviceSerial) + '\s+(\S+)')) { return $Matches[1] }
    }
    return 'absent'
}

function Assert-TargetAvd {
    $targetName = @(& $adbPath -s $deviceSerial emu avd name)
    if ($LASTEXITCODE -ne 0 -or $targetName -notcontains $avdName) {
        throw "$deviceSerial does not identify '$avdName'. No other device will be modified."
    }
}

function Assert-ExpoGoInstalled {
    $packagePath = @(& $adbPath -s $deviceSerial shell -n pm path host.exp.exponent)
    if ($LASTEXITCODE -ne 0 -or -not ($packagePath -match '^package:')) {
        throw "Expo Go is missing on $deviceSerial. Install the SDK 57 compatible official Expo Go separately; this launcher does not download/install apps."
    }
}

# The same bounded operation is used directly and by a hidden PowerShell background job.
$openPreview = {
    param($Adb, $Serial, $ExpectedAvd, $ProjectRoot, $Port, $WaitSeconds)
    $ErrorActionPreference = 'Stop'
    $deadline = [DateTime]::UtcNow.AddSeconds($WaitSeconds)
    do {
        $status = $null
        try {
            $status = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/status" -TimeoutSec 2
        } catch {
            if ([DateTime]::UtcNow -ge $deadline) { throw "Metro HTTP request to 127.0.0.1:$Port failed: $($_.Exception.Message)" }
        }
        if ($status) {
            $statusText = if ($status.Content -is [byte[]]) {
                [Text.Encoding]::UTF8.GetString($status.Content)
            } else { [string]$status.Content }
            if ($statusText.Trim() -eq 'packager-status:running') { break }
        }
        if ([DateTime]::UtcNow -ge $deadline) { throw "Port $Port is not a ready Metro server." }
        Start-Sleep -Milliseconds 500
    } while ($true)

    $listeners = @(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object { $_.LocalPort -eq $Port })
    if (-not $listeners -or ($listeners | Where-Object { $_.LocalAddress -notin @('127.0.0.1', '::1') })) {
        throw 'Metro must listen only on loopback addresses. No device connection was changed.'
    }
    $manifest = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/" -Headers @{
        'Expo-Platform' = 'android'
        Accept = 'application/expo+json,application/json'
    } -TimeoutSec 15
    if ($manifest -is [byte[]]) {
        $manifest = [Text.Encoding]::UTF8.GetString($manifest) | ConvertFrom-Json
    } elseif ($manifest -is [string]) {
        $manifest = $manifest | ConvertFrom-Json
    }
    $servedRoot = $manifest.extra.expoClient._internal.projectRoot
    if (-not $servedRoot -or -not [string]::Equals(
        [IO.Path]::GetFullPath($servedRoot).TrimEnd('\', '/'),
        [IO.Path]::GetFullPath($ProjectRoot).TrimEnd('\', '/'),
        [StringComparison]::OrdinalIgnoreCase)) {
        throw "Port $Port does not serve this Tomurai project. No device connection was changed."
    }
    $targetAvd = @(& $Adb -s $Serial emu avd name)
    if ($LASTEXITCODE -ne 0 -or $targetAvd -notcontains $ExpectedAvd) { throw 'The target AVD identity changed; stopping.' }
    & $Adb -s $Serial reverse "tcp:$Port" "tcp:$Port"
    if ($LASTEXITCODE -ne 0) { throw 'ADB reverse failed.' }
    & $Adb -s $Serial shell -n am start -a android.intent.action.VIEW -d "exp://127.0.0.1:$Port" -p host.exp.exponent
    if ($LASTEXITCODE -ne 0) { throw 'Could not open Tomurai in Expo Go.' }
    Write-Output "Opened Tomurai in Expo Go on $Serial."
}

$listeners = @(Get-PreviewListeners)
if ($CheckOnly) {
    Write-Host "OK: Node, installed Expo CLI, Android SDK, and AVD '$avdName'."
    if ($listeners | Where-Object { $_.LocalPort -eq 5037 }) {
        $state = Get-TargetState
        if ($state -eq 'device') {
            Assert-TargetAvd
            Assert-ExpoGoInstalled
            Write-Host "OK: $deviceSerial is the dedicated AVD and has Expo Go."
        } else { Write-Host "Device state: $state. Expo Go will be checked after the dedicated AVD boots." }
    } else { Write-Host 'ADB is not running. Device/Expo Go checks are deferred until normal startup.' }
    if ($listeners | Where-Object { $_.LocalPort -eq $metroPort }) {
        Write-Host "Port $metroPort is occupied. Normal startup will stop; use -OpenOnly only to attach to this project's existing Metro."
    } else { Write-Host "OK: Metro port $metroPort is free." }
    return
}
if (-not $OpenOnly -and ($listeners | Where-Object { $_.LocalPort -eq $metroPort })) {
    throw "Port $metroPort is already in use. Stop your existing preview or run npm run android:preview -- -OpenOnly. No process was stopped."
}

$previousAndroidHome = $env:ANDROID_HOME
$previousAndroidSdkRoot = $env:ANDROID_SDK_ROOT
$previousPackagerHostname = $env:REACT_NATIVE_PACKAGER_HOSTNAME
$previousExpoTelemetry = $env:EXPO_NO_TELEMETRY
$openJob = $null
try {
    # These values exist only in this launcher and its child processes.
    $env:ANDROID_HOME = $sdkRoot
    $env:ANDROID_SDK_ROOT = $sdkRoot
    $env:REACT_NATIVE_PACKAGER_HOSTNAME = '127.0.0.1'
    $env:EXPO_NO_TELEMETRY = '1'
    if ($env:EXPO_PACKAGER_PROXY_URL) { throw 'EXPO_PACKAGER_PROXY_URL is set. Run in a terminal without that proxy override for a localhost preview.' }

    $state = Get-TargetState
    if ($state -eq 'absent') {
        if ($listeners | Where-Object { $_.LocalPort -in @(5556, 5557) }) {
            throw 'Emulator port 5556/5557 is occupied. Resolve that conflict without wiping or stopping unrelated devices.'
        }
        Write-Host "Starting the visible emulator '$avdName'..."
        Start-Process -FilePath $emulatorPath -ArgumentList @('-avd', $avdName, '-port', '5556', '-no-snapshot-load', '-gpu', 'software', '-camera-back', 'none', '-camera-front', 'none') -WindowStyle Normal | Out-Null
    } elseif ($state -ne 'device' -and $state -ne 'offline') {
        throw "Unexpected $deviceSerial state: $state"
    }
    $bootDeadline = [DateTime]::UtcNow.AddMinutes(3)
    do {
        if ((Get-TargetState) -eq 'device') {
            Assert-TargetAvd
            $bootComplete = (& $adbPath -s $deviceSerial shell -n getprop sys.boot_completed | Out-String).Trim()
            if ($LASTEXITCODE -eq 0 -and $bootComplete -eq '1') { break }
        }
        if ([DateTime]::UtcNow -ge $bootDeadline) { throw 'The dedicated emulator did not finish booting within 3 minutes. Inspect its window; no data was reset.' }
        Start-Sleep -Seconds 1
    } while ($true)
    Assert-ExpoGoInstalled

    if ($OpenOnly) {
        & $openPreview $adbPath $deviceSerial $avdName $mobileRoot $metroPort 0
        return
    }
    $openJob = Start-Job -ScriptBlock $openPreview -ArgumentList @($adbPath, $deviceSerial, $avdName, $mobileRoot, $metroPort, 90)
    Write-Host 'Starting Metro on IPv4 localhost. Keep this terminal open; press Ctrl+C to stop Metro, then close the emulator window.'
    Write-Host 'If Expo Go does not open, use npm run android:preview -- -OpenOnly in another terminal to see the connection error.'
    Push-Location $mobileRoot
    try {
        & $nodePath '--dns-result-order=ipv4first' $expoCli 'start' '--go' '--localhost' '--port' "$metroPort"
        if ($LASTEXITCODE -ne 0) { throw "Metro exited with code $LASTEXITCODE." }
    } finally { Pop-Location }
} finally {
    if ($openJob) {
        if ($openJob.State -eq 'Running') { Stop-Job -Job $openJob }
        Receive-Job -Job $openJob -ErrorAction Continue
        Remove-Job -Job $openJob -Force
    }
    $env:ANDROID_HOME = $previousAndroidHome
    $env:ANDROID_SDK_ROOT = $previousAndroidSdkRoot
    $env:REACT_NATIVE_PACKAGER_HOSTNAME = $previousPackagerHostname
    $env:EXPO_NO_TELEMETRY = $previousExpoTelemetry
}
