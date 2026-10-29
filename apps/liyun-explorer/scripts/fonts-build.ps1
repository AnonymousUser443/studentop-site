param(
  [string]$SerifSource = 'C:/Windows/Fonts/NotoSerifSC-VF.ttf',
  [string]$BrushSource = '',
  [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'
$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$env:PYTHONIOENCODING = 'utf-8'
$webRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$fontRoot = Join-Path $webRoot 'public/assets/fonts'
$sourceRoot = Join-Path $webRoot 'src'
$characterFile = Join-Path $PSScriptRoot 'fonts-characters.txt'
if (-not $BrushSource) { $BrushSource = Join-Path $fontRoot 'MaShanZheng-Regular.ttf' }
# Check ALL sources and executable before writing character lists or output fonts.
foreach ($source in @($SerifSource, $BrushSource)) {
  if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw ('Source font missing: ' + $source) }
  if ((Get-Item -LiteralPath $source).Length -le 0) { throw ('Source font empty: ' + $source) }
}
if (-not (Test-Path -LiteralPath $sourceRoot -PathType Container)) { throw 'Application src directory is missing.' }
$subsetCommand = (Get-Command pyftsubset -CommandType Application -ErrorAction Stop).Source
& $subsetCommand --help | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'pyftsubset preflight failed.' }
$fontFiles = @(Get-ChildItem -LiteralPath $sourceRoot -File -Recurse | Where-Object { $_.Extension -in '.ts', '.tsx', '.css', '.json' })
if ($fontFiles.Count -eq 0) { throw 'No source text found; refusing to replace fonts with an empty subset.' }
$fontText = [System.Text.StringBuilder]::new()
[void]$fontText.Append('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz .,!?;:-_/%+()[]')
foreach ($source in $fontFiles) { [void]$fontText.Append([System.IO.File]::ReadAllText($source.FullName, [System.Text.Encoding]::UTF8)) }
$fontCharacters = -join ($fontText.ToString().ToCharArray() | Sort-Object -Unique)

# Stage both complete subsets. Checks fontTools/Brotli and readable font tables;
# failure (including missing Brotli) never replaces committed project files.
$stage = Join-Path ([System.IO.Path]::GetTempPath()) ('liyun-fonts-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage | Out-Null
try {
  $stageCharacters = Join-Path $stage 'fonts-characters.txt'
  [System.IO.File]::WriteAllText($stageCharacters, $fontCharacters, [System.Text.UTF8Encoding]::new($false))
  $jobs = @(
    @{ Source = $SerifSource; Name = 'NotoSerifSC-UI.woff2' },
    @{ Source = $BrushSource; Name = 'MaShanZheng-UI.woff2' }
  )
  foreach ($job in $jobs) {
    $output = Join-Path $stage $job.Name
    & $subsetCommand $job.Source "--text-file=$stageCharacters" "--output-file=$output" '--flavor=woff2' '--layout-features=*' '--no-hinting'
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $output) -or (Get-Item -LiteralPath $output).Length -le 0) { throw ('Font subset failed: ' + $job.Name) }
  }
  if ($CheckOnly) { Write-Output 'Both staged subsets passed; no project files written.'; return }
  New-Item -ItemType Directory -Path $fontRoot -Force | Out-Null
  foreach ($job in $jobs) { Copy-Item -LiteralPath (Join-Path $stage $job.Name) -Destination (Join-Path $fontRoot $job.Name) -Force }
  Copy-Item -LiteralPath $stageCharacters -Destination $characterFile -Force
  Get-Item -LiteralPath (Join-Path $fontRoot 'NotoSerifSC-UI.woff2'), (Join-Path $fontRoot 'MaShanZheng-UI.woff2') | Select-Object Name, Length
} finally {
  if ((Split-Path -Parent $stage) -eq [System.IO.Path]::GetTempPath().TrimEnd([char[]]'\/') -and (Split-Path -Leaf $stage) -like 'liyun-fonts-*') {
    Remove-Item -LiteralPath $stage -Recurse -Force
  }
}
