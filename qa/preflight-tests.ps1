# Offline negative tests only: missing inputs must fail before touching project assets.
$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$app = Join-Path $root 'apps/liyun-explorer'
$paths = @((Join-Path $app 'scripts/fonts-characters.txt'))
foreach ($folder in @('public/assets/audio', 'public/assets/fonts')) {
  $paths += @(Get-ChildItem -LiteralPath (Join-Path $app $folder) -File | Select-Object -ExpandProperty FullName)
}
function AssetHashes {
  return (($paths | Sort-Object | ForEach-Object { (Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash + ' ' + $_ }) -join [Environment]::NewLine)
}
$before = AssetHashes
$missing = Join-Path $PSScriptRoot '__qa_missing_input_must_not_exist__'
if (Test-Path -LiteralPath $missing) { throw 'Negative-test fixture path unexpectedly exists.' }
$audioFailed = $false
try { & (Join-Path $app 'scripts/audio-assets.ps1') -SourceDir $missing -CheckOnly }
catch {
  if ($_.Exception.Message -notlike '*SourceDir does not exist*') { throw }
  $audioFailed = $true
}
if (-not $audioFailed) { throw 'Missing SourceDir did not fail.' }
$fontFailed = $false
try { & (Join-Path $app 'scripts/fonts-build.ps1') -SerifSource $missing -CheckOnly }
catch {
  if ($_.Exception.Message -notlike '*Source font missing*') { throw }
  $fontFailed = $true
}
if (-not $fontFailed) { throw 'Missing source font did not fail.' }
if ($before -ne (AssetHashes)) { throw 'A negative preflight changed project assets.' }
Write-Output ('PASS: 2 missing-input tests; ' + $paths.Count + ' existing asset/character files unchanged.')
