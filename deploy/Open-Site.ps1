<#
.SYNOPSIS
    Local preview entry for the win11-home site on the Raspberry Pi.

.DESCRIPTION
    Opens an SSH local port forward  127.0.0.1:<Port> -> pi:127.0.0.1:80
    and then opens the site in the default browser. This lets you preview the
    deployed site even while the public SakuraFrp tunnel is down.

    * Re-uses an already running tunnel (PID is recorded in a state file).
    * Refuses to start if the port is held by a foreign process.
    * -Stop stops the tunnel started by this script.

.EXAMPLE
    .\Open-Site.ps1
    .\Open-Site.ps1 -Port 8081
    .\Open-Site.ps1 -Stop
    .\Open-Site.ps1 -Stop -Port 8081
#>
[CmdletBinding()]
param(
    [int]$Port = 8080,
    [string]$HostAlias = 'pi',
    [switch]$Stop,
    [switch]$NoBrowser,
    [int]$TimeoutSeconds = 20
)

$ErrorActionPreference = 'Stop'

$RunDir    = Join-Path $env:LOCALAPPDATA 'win11-home-opensite'
$StateFile = Join-Path $RunDir ("instance-{0}.json" -f $Port)
$ErrFile   = Join-Path $RunDir ("instance-{0}.stderr.log" -f $Port)
$OutFile   = Join-Path $RunDir ("instance-{0}.stdout.log" -f $Port)
$Url       = "http://127.0.0.1:$Port/"

function Write-Step([string]$Message) { Write-Host "[opensite] $Message" }
function Fail([string]$Message) {
    Write-Host "[opensite] ERROR: $Message" -ForegroundColor Red
    exit 1
}

function Test-PortOpen([int]$P) {
    $client = $null
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $iar = $client.BeginConnect('127.0.0.1', $P, $null, $null)
        $signaled = $iar.AsyncWaitHandle.WaitOne(500)
        if ($signaled -and $client.Connected) { return $true }
        return $false
    } catch {
        return $false
    } finally {
        if ($client) { try { $client.Close() } catch { } }
    }
}

function Get-InstanceRecord {
    if (-not (Test-Path -LiteralPath $StateFile)) { return $null }
    try { return (Get-Content -LiteralPath $StateFile -Raw | ConvertFrom-Json) } catch { return $null }
}

function Test-OurTunnel($Record) {
    if (-not $Record) { return $false }
    $proc = Get-Process -Id ([int]$Record.pid) -ErrorAction SilentlyContinue
    if (-not $proc) { return $false }
    if ($proc.ProcessName -notmatch '^ssh') { return $false }
    try {
        $cim = Get-CimInstance Win32_Process -Filter ("ProcessId={0}" -f ([int]$Record.pid))
        if ($cim -and $cim.CommandLine -and ($cim.CommandLine -notmatch '-L\s+127\.0\.0\.1:' + $Port)) { return $false }
    } catch { }
    return $true
}

function Get-ErrorLogTail {
    if (-not (Test-Path -LiteralPath $ErrFile)) { return '<no stderr>' }
    $txt = Get-Content -LiteralPath $ErrFile -Raw -ErrorAction SilentlyContinue
    if ([string]::IsNullOrWhiteSpace($txt)) { return '<empty stderr>' }
    return $txt.Trim()
}

# ------------------------------------------------------------------ -Stop -----
if ($Stop) {
    $record = Get-InstanceRecord
    if (-not $record) {
        if (Test-PortOpen $Port) {
            Fail "port $Port is in use, but no instance record was found at $StateFile; refusing to kill a foreign process"
        }
        Write-Step "no running tunnel instance for port $Port"
        exit 0
    }
    if (Test-OurTunnel $record) {
        try {
            Stop-Process -Id ([int]$record.pid) -Force -ErrorAction Stop
            Write-Step "stopped ssh tunnel (pid $($record.pid))"
        } catch {
            Fail "failed to stop pid $($record.pid): $($_.Exception.Message)"
        }
        Start-Sleep -Milliseconds 500
    } else {
        Write-Step "instance record is stale (pid $($record.pid) is not our ssh tunnel) - cleaning up"
    }
    Remove-Item -LiteralPath $StateFile -Force -ErrorAction SilentlyContinue
    if (Test-PortOpen $Port) {
        Write-Step "WARNING: port $Port is still open (held by some other program)"
    } else {
        Write-Step "port $Port is now closed"
    }
    exit 0
}

# ------------------------------------------------------------------ start -----
$record = Get-InstanceRecord
if ($record -and (Test-OurTunnel $record)) {
    Write-Step "re-using running tunnel (pid $($record.pid) -> $Url)"
    if (-not $NoBrowser) { Start-Process $Url; Write-Step 'browser opened' }
    exit 0
}
if ($record) { Remove-Item -LiteralPath $StateFile -Force -ErrorAction SilentlyContinue }

if (Test-PortOpen $Port) {
    Fail ("port {0} is already in use by another program; stop it or use:  .\Open-Site.ps1 -Port {1}" -f $Port, ($Port + 1))
}

$sshCommand = Get-Command ssh.exe -ErrorAction SilentlyContinue
if (-not $sshCommand) { $sshCommand = Get-Command ssh -ErrorAction SilentlyContinue }
if (-not $sshCommand) {
    Fail 'ssh.exe was not found in PATH (install the Windows OpenSSH client, or run from a shell where ssh works)'
}

New-Item -ItemType Directory -Force -Path $RunDir | Out-Null
Remove-Item -LiteralPath $ErrFile, $OutFile -Force -ErrorAction SilentlyContinue

$forward = ('127.0.0.1:{0}:127.0.0.1:80' -f $Port)
$sshArgs = @(
    '-N', '-T',
    '-o', 'ExitOnForwardFailure=yes',
    '-o', 'ConnectTimeout=10',
    '-o', 'ServerAliveInterval=30',
    '-o', 'ServerAliveCountMax=3',
    '-L', $forward,
    $HostAlias
)
Write-Step ("starting: ssh -N -L {0} {1}" -f $forward, $HostAlias)

try {
    $proc = Start-Process -FilePath $sshCommand.Source -ArgumentList $sshArgs -WindowStyle Hidden -PassThru -RedirectStandardError $ErrFile -RedirectStandardOutput $OutFile
} catch {
    Fail "could not start ssh: $($_.Exception.Message)"
}

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
while ((Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 400
    if ($proc.HasExited) {
        Fail ("ssh exited with code {0} before the tunnel was up. ssh message: {1}" -f $proc.ExitCode, (Get-ErrorLogTail))
    }
    if (Test-PortOpen $Port) { break }
}
if (-not (Test-PortOpen $Port)) {
    try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch { }
    Fail ("the tunnel did not listen on 127.0.0.1:{0} within {1}s. ssh message: {2}" -f $Port, $TimeoutSeconds, (Get-ErrorLogTail))
}

# quick HTTP sanity check through the tunnel
try {
    $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 10
    Write-Step ("HTTP {0} from {1}" -f [int]$resp.StatusCode, $Url)
    if ($resp.Content -match '<title>([^<]*)</title>') {
        Write-Step ("page title: {0}" -f $Matches[1])
    }
} catch {
    Write-Step ("WARNING: tunnel is up but the HTTP check failed: {0}" -f $_.Exception.Message)
}

$state = [pscustomobject]@{
    pid     = $proc.Id
    port    = $Port
    host    = $HostAlias
    forward = $forward
    url     = $Url
    ssh     = $sshCommand.Source
    started = (Get-Date).ToString('o')
}
$state | ConvertTo-Json | Set-Content -LiteralPath $StateFile -Encoding UTF8

Write-Step ("tunnel is up: 127.0.0.1:{0} -> {1}:127.0.0.1:80  (pid {2})" -f $Port, $HostAlias, $proc.Id)
Write-Step "state file: $StateFile"
Write-Step 'stop with: deploy\Open-Site.cmd -Stop'
if (-not $NoBrowser) {
    Start-Process $Url
    Write-Step 'browser opened'
}
exit 0
