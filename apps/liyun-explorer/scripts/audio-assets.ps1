$ErrorActionPreference = 'Stop'
$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$webRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Split-Path -Parent $webRoot
$audioDir = Join-Path $webRoot 'public/assets/audio'
New-Item -ItemType Directory -Path $audioDir -Force | Out-Null
foreach ($index in 1..3) {
  $source = Join-Path $workspaceRoot ('BGM/bgm' + $index + '.opus')
  $opus = Join-Path $audioDir ('bgm' + $index + '.opus')
  $mp3 = Join-Path $audioDir ('bgm' + $index + '.mp3')
  Copy-Item -LiteralPath $source -Destination $opus -Force
  & ffmpeg -hide_banner -loglevel error -y -i $source -map_metadata -1 -codec:a libmp3lame -q:a 4 $mp3
  if ($LASTEXITCODE -ne 0) { throw ('Audio conversion failed: bgm' + $index) }
  Write-Output ('Prepared bgm' + $index + ' (Opus + MP3)')
}
