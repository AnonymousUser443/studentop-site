param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$SourceDir,
  [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'
$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$webRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$audioDir = Join-Path $webRoot 'public/assets/audio'
# Complete preflight BEFORE creating directories or overwriting any project asset.
if (-not (Test-Path -LiteralPath $SourceDir -PathType Container)) { throw 'SourceDir does not exist. Pass the original BGM directory explicitly.' }
$SourceDir = (Resolve-Path -LiteralPath $SourceDir).Path
$ffmpeg = (Get-Command ffmpeg -CommandType Application -ErrorAction Stop).Source
$sources = @(foreach ($index in 1..3) {
  $source = Join-Path $SourceDir ('bgm' + $index + '.opus')
  if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw ('Missing input: ' + $source) }
  if ((Get-Item -LiteralPath $source).Length -le 0) { throw ('Empty input: ' + $source) }
  $source
})
$encoders = & $ffmpeg -hide_banner -encoders 2>&1
if ($LASTEXITCODE -ne 0 -or -not (($encoders -join ' ') -match '\blibmp3lame\b')) { throw 'FFmpeg with libmp3lame is required.' }
foreach ($source in $sources) {
  & $ffmpeg -hide_banner -loglevel error -xerror -i $source -map 0:a:0 -f null -
  if ($LASTEXITCODE -ne 0) { throw ('Input decode preflight failed: ' + $source) }
}
if ($CheckOnly) { Write-Output 'Preflight passed; no project files written.'; return }

$stage = Join-Path ([System.IO.Path]::GetTempPath()) ('liyun-audio-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage | Out-Null
try {
  foreach ($index in 1..3) {
    $source = $sources[$index - 1]
    Copy-Item -LiteralPath $source -Destination (Join-Path $stage ('bgm' + $index + '.opus'))
    $mp3 = Join-Path $stage ('bgm' + $index + '.mp3')
    & $ffmpeg -hide_banner -loglevel error -y -i $source -map 0:a:0 -map_metadata -1 -codec:a libmp3lame -q:a 4 $mp3
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $mp3) -or (Get-Item -LiteralPath $mp3).Length -le 0) { throw ('Audio conversion failed: bgm' + $index) }
  }
  # All six outputs exist before the first project write.
  New-Item -ItemType Directory -Path $audioDir -Force | Out-Null
  foreach ($item in (Get-ChildItem -LiteralPath $stage -File)) { Copy-Item -LiteralPath $item.FullName -Destination (Join-Path $audioDir $item.Name) -Force }
  Write-Output 'Prepared three Opus/MP3 pairs. Review audio/manifest.json durations and provenance if sources changed.'
} finally {
  # Only remove the exact temporary directory created by this invocation.
  if ((Split-Path -Parent $stage) -eq [System.IO.Path]::GetTempPath().TrimEnd('\', '/') -and (Split-Path -Leaf $stage) -like 'liyun-audio-*') {
    Remove-Item -LiteralPath $stage -Recurse -Force
  }
}
