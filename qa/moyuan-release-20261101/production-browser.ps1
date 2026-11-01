param([string]$Report = 'qa/moyuan-release-20261101/browser-production.json')
$ErrorActionPreference = 'Stop'
$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
if (Test-Path -LiteralPath $Report) { throw 'Use a new report filename.' }
$sessionName = 'codex-moyuan-release-20261101'
$result = [ordered]@{ ok = $false; checkedAt = [DateTime]::UtcNow.ToString('o'); engine = 'Chrome through OpenCLI 2.0.1 / extension 1.0.26'; url = 'https://studentop.cn:14355/liyun-moyuan/'; checks = [System.Collections.Generic.List[object]]::new(); screenshots = [System.Collections.Generic.List[string]]::new() }
function Invoke-Browser([string]$Action, [string[]]$CliArgs = @()) {
    $raw = & opencli --profile vm3f9xvh browser $Action @CliArgs --session $sessionName 2> .release-local/moyuan-opencli-stderr.log
    if ($LASTEXITCODE -ne 0) { throw ('OpenCLI failed: ' + $Action + ' ' + ($raw -join "`n")) }
    $packet = ($raw -join "`n") | ConvertFrom-Json
    if (-not $packet.ok) { throw ('OpenCLI error: ' + ($packet | ConvertTo-Json -Depth 8 -Compress)) }
    return $packet.data
}
function Assert-Page([string]$Name, [string]$Expression) {
    $actual = Invoke-Browser 'eval' @('Boolean(' + $Expression + ')')
    $pass = ($actual -eq $true -or $actual -eq 'true')
    $result.checks.Add([ordered]@{ name = $Name; pass = $pass })
    if (-not $pass) { throw ('Page assertion failed: ' + $Name) }
}
function Save-View([string]$Name, [string[]]$ExtraArgs = @()) {
    $file = 'qa/moyuan-release-20261101/production-' + $Name + '.png'
    if (Test-Path -LiteralPath $file) { throw ('Screenshot exists: ' + $file) }
    $null = Invoke-Browser 'screenshot' (@($file) + $ExtraArgs)
    $result.screenshots.Add($file)
}
try {
    Assert-Page 'production-WebGL-ready' 'location.pathname==="/liyun-moyuan/"&&window.__MOYUAN__?.ready&&__MOYUAN__.triangles>10000&&!!document.querySelector("#scene canvas")'
    Assert-Page 'loading-cleared-and-fonts-loaded' 'document.querySelector("#loading").hidden&&document.querySelector("#error").hidden&&document.fonts.check("16px MoyuanSerif")&&document.fonts.check("16px MoyuanSans")'
    Assert-Page 'model-and-decor-counts' '__MOYUAN__.referencePages===6&&__MOYUAN__.stats.room.desks===16&&__MOYUAN__.stats.decor.porcelainPieces===25'
    foreach ($view in @('interior', 'overview', 'tea', 'desk', 'stage')) {
        $null = Invoke-Browser 'click' @('button[data-view="' + $view + '"]')
        Assert-Page ('view-' + $view) ('__MOYUAN__.view==="' + $view + '"&&document.querySelector("button[data-view=' + $view + ']").getAttribute("aria-pressed")==="true"')
    }
    $null = Invoke-Browser 'click' @('button[data-view="overview"]')
    Save-View 'overview'
    $null = Invoke-Browser 'click' @('button[data-view="tea"]')
    $null = Invoke-Browser 'click' @('#light-toggle')
    Assert-Page 'night-mode' '__MOYUAN__.night===true'
    Save-View 'night'
    $null = Invoke-Browser 'click' @('#light-toggle')
    Assert-Page 'day-mode' '__MOYUAN__.night===false'
    $null = Invoke-Browser 'click' @('#detail-toggle')
    Assert-Page 'detail-off' '__MOYUAN__.detail===false'
    $null = Invoke-Browser 'click' @('#detail-toggle')
    Assert-Page 'detail-on' '__MOYUAN__.detail===true'
    $null = Invoke-Browser 'click' @('#tour-toggle')
    Assert-Page 'orbit-on' 'document.querySelector("#tour-toggle").getAttribute("aria-pressed")==="true"'
    $null = Invoke-Browser 'click' @('#tour-toggle')
    $null = Invoke-Browser 'click' @('#about-toggle')
    Assert-Page 'notes-open' '!document.querySelector("#about-panel").hidden&&document.activeElement.id==="about-close"'
    $null = Invoke-Browser 'keys' @('Escape')
    Assert-Page 'notes-close-Escape' 'document.querySelector("#about-panel").hidden&&document.activeElement.id==="about-toggle"'
    Assert-Page 'desktop-layout' 'document.documentElement.scrollWidth<=innerWidth&&Array.from(document.querySelectorAll("button[data-view]")).every(e=>e.getBoundingClientRect().right<=innerWidth)'
    $null = Invoke-Browser 'click' @('button[data-view="interior"]')
    Save-View 'interior'
    Save-View 'mobile' @('--width', '390', '--height', '844')
    $console = Invoke-Browser 'console' @('--level', 'error')
    $result.console = $console
    $result.checks.Add([ordered]@{ name = 'no-runtime-console-errors'; pass = ($console.count -eq 0) })
    if ($console.count -ne 0) { throw 'Production console reported errors.' }
    $state = Invoke-Browser 'eval' @('JSON.stringify({title:document.title,ready:__MOYUAN__.ready,view:__MOYUAN__.view,detail:__MOYUAN__.detail,night:__MOYUAN__.night,triangles:__MOYUAN__.triangles,viewport:[innerWidth,innerHeight]})')
    $result.state = $state | ConvertFrom-Json
    $result.notes = @('The mobile image uses a temporary browser viewport override; this is not a physical phone or iOS test.')
    $result.ok = $true
} catch {
    $result.error = $_.Exception.Message
} finally {
    $result | ConvertTo-Json -Depth 20 | Set-Content -Encoding utf8 -LiteralPath $Report
    [ordered]@{ ok = $result.ok; checks = $result.checks.Count; report = $Report; error = $result.error } | ConvertTo-Json -Compress
}
if (-not $result.ok) { exit 1 }
