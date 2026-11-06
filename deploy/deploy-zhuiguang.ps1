param(
  [Parameter(Mandatory)][string]$PackageDirectory,
  [string]$PiHost = 'biteraiden-pi',
  [switch]$Check
)
$ErrorActionPreference = 'Stop'
$package = (Resolve-Path -LiteralPath $PackageDirectory).Path
$infra = Join-Path $package 'infra'
$release = [DateTime]::UtcNow.ToString("yyyyMMdd'T'HHmmss'Z'") + '-' + [guid]::NewGuid().ToString('N').Substring(0,8)
$archive = Join-Path ([IO.Path]::GetTempPath()) "zhuiguang-$release.tar"
$route = Join-Path $PSScriptRoot 'nginx/win11-home-projects.conf'
if (-not (Test-Path -LiteralPath (Join-Path $package 'dist/assets/manifest.json') -PathType Leaf)) {
  throw 'Build and stage the presentation with scripts/package-pi.mjs first.'
}
New-Item -ItemType Directory -Path $infra -Force | Out-Null
foreach ($name in @('zhuiguang.service','zhuiguang-backup.service','zhuiguang-backup.timer')) {
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot "pi-zhuiguang/$name") -Destination $infra
}
Copy-Item -LiteralPath $route -Destination (Join-Path $infra 'route.conf')
tar -cf $archive -C $package dist server src package.json package-lock.json infra
if ($LASTEXITCODE -ne 0) { throw 'Could not create release archive' }
Write-Output "Release archive: $archive"
if ($Check) { return }
$remote = "/tmp/zhuiguang-$release.tar"
scp -o BatchMode=yes -o ConnectTimeout=10 $archive "${PiHost}:$remote"
if ($LASTEXITCODE -ne 0) { throw 'Upload failed' }
$apply = "/tmp/zhuiguang-$release.sh"
scp -o BatchMode=yes -o ConnectTimeout=10 (Join-Path $PSScriptRoot 'pi-zhuiguang/apply-release.sh') "${PiHost}:$apply"
if ($LASTEXITCODE -ne 0) { throw 'Could not upload the release command' }
$unit = "zhuiguang-release-" + $release.Substring($release.Length - 8)
ssh -o BatchMode=yes -o ConnectTimeout=10 -o ServerAliveInterval=10 $PiHost "sudo -n systemd-run --unit=$unit --property=Type=oneshot --wait /usr/bin/bash '$apply' '$remote' '$release'"
if ($LASTEXITCODE -ne 0) { throw 'Remote release failed' }
Remove-Item -LiteralPath $archive
