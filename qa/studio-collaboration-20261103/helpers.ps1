$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$ErrorActionPreference = 'Stop'
$studioTabA = 'BFBC46D479E5CA61BBA5C9022663E1BC'
$studioTabB = 'AA0353F977F7B6FBEE2CDA7C397C10C0'
$studioSession = 'liyun-studio-qa'
function Invoke-StudioPage([string]$Tab,[string[]]$Action) {
    $raw = & opencli @Action --session $studioSession --tab $Tab
    if ($LASTEXITCODE -ne 0) { throw ('OpenCLI failed: ' + ($raw -join '')) }
    $parsed = ($raw -join '') | ConvertFrom-Json
    if (-not $parsed.ok) { throw ('OpenCLI rejected: ' + $parsed.error.message) }
    return $parsed.data
}
function Read-StudioPage([string]$Tab,[string]$Script) {
    return Invoke-StudioPage $Tab @('browser','eval',$Script)
}
function Wait-StudioPage([string]$Tab,[string]$Script) {
    $deadline = [DateTime]::UtcNow.AddSeconds(15)
    do {
        if ((Read-StudioPage $Tab $Script) -eq $true) { return }
        Start-Sleep -Milliseconds 200
    } while ([DateTime]::UtcNow -lt $deadline)
    throw ('Browser condition timed out: ' + $Script)
}
function Add-StudioCheck([string]$Name,[bool]$Pass,$Detail=$null) {
    $recordPath = 'qa/studio-collaboration-20261103/browser.json'
    $record = if (Test-Path -LiteralPath $recordPath) { Get-Content -LiteralPath $recordPath -Raw -Encoding utf8 | ConvertFrom-Json } else { [PSCustomObject]@{scope='Isolated localhost:5193 author workspace; OpenCLI native actions plus explicitly labelled synthetic middle-pointer and network fault fixtures';checks=@()} }
    $record.checks = @($record.checks) + [PSCustomObject]@{name=$Name;pass=$Pass;detail=$Detail}
    $record | ConvertTo-Json -Depth 15 | Set-Content -LiteralPath $recordPath -Encoding utf8
    Write-Output ($Name + ': ' + $Pass)
    if (-not $Pass) { throw $Name }
}
