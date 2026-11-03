param(
  [string]$SerifSource = 'C:/Windows/Fonts/NotoSerifSC-VF.ttf',
  [string]$BrushSource = '',
  [string]$SymbolsSource = '',
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
if ($SymbolsSource -and -not (Test-Path -LiteralPath $SymbolsSource -PathType Leaf)) { throw 'Symbols source font missing.' }
# Check ALL sources and executable before writing character lists or output fonts.
foreach ($source in @($SerifSource, $BrushSource)) {
  if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw ('Source font missing: ' + $source) }
  if ((Get-Item -LiteralPath $source).Length -le 0) { throw ('Source font empty: ' + $source) }
}
if (-not (Test-Path -LiteralPath $sourceRoot -PathType Container)) { throw 'Application src directory is missing.' }
$subsetCommand = (Get-Command pyftsubset -CommandType Application -ErrorAction Stop).Source
& $subsetCommand --help | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'pyftsubset preflight failed.' }
$nodeCommand = (Get-Command node -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
$collector = Join-Path $PSScriptRoot 'collect-font-text.mjs'
if (-not (Test-Path -LiteralPath $collector -PathType Leaf)) { throw 'Runtime font text collector missing.' }

# Stage both complete subsets. Checks fontTools/Brotli and readable font tables;
# failure (including missing Brotli) never replaces committed project files.
$stage = Join-Path ([System.IO.Path]::GetTempPath()) ('liyun-fonts-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage | Out-Null
try {
  $stageCharacters = Join-Path $stage 'fonts-characters.txt'
  & $nodeCommand $collector '--out' $stageCharacters
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $stageCharacters)) { throw 'Runtime text collection failed.' }
  $jobs = @(
    @{ Source = $SerifSource; Name = 'NotoSerifSC-UI.woff2' },
    @{ Source = $BrushSource; Name = 'MaShanZheng-UI.woff2' }
  )
  foreach ($job in $jobs) {
    $output = Join-Path $stage $job.Name
    & $subsetCommand $job.Source "--text-file=$stageCharacters" "--output-file=$output" '--flavor=woff2' '--layout-features=*' '--no-hinting'
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $output) -or (Get-Item -LiteralPath $output).Length -le 0) { throw ('Font subset failed: ' + $job.Name) }
  }
  $extraNames = @()
  if ($SymbolsSource) {
    $pythonCommand = (Get-Command python -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
    & $pythonCommand (Join-Path $PSScriptRoot 'build-symbol-font.py') '--source' $SymbolsSource '--out' (Join-Path $stage 'LiyunSymbols-UI.woff2') '--license-out' (Join-Path $stage 'DejaVu-LICENSE.txt')
    if ($LASTEXITCODE -ne 0) { throw 'Symbol subset failed.' }
    $extraNames = @('LiyunSymbols-UI.woff2', 'DejaVu-LICENSE.txt')
  }
  if ($CheckOnly) { Write-Output 'Both staged subsets passed; no project files written.'; return }
  New-Item -ItemType Directory -Path $fontRoot -Force | Out-Null
  foreach ($job in $jobs) { Copy-Item -LiteralPath (Join-Path $stage $job.Name) -Destination (Join-Path $fontRoot $job.Name) -Force }
  foreach ($name in $extraNames) { Copy-Item -LiteralPath (Join-Path $stage $name) -Destination (Join-Path $fontRoot $name) -Force }
  Copy-Item -LiteralPath $stageCharacters -Destination $characterFile -Force
  Get-Item -LiteralPath (Join-Path $fontRoot 'NotoSerifSC-UI.woff2'), (Join-Path $fontRoot 'MaShanZheng-UI.woff2') | Select-Object Name, Length
} finally {
  if ((Split-Path -Parent $stage) -eq [System.IO.Path]::GetTempPath().TrimEnd([char[]]'\/') -and (Split-Path -Leaf $stage) -like 'liyun-fonts-*') {
    Remove-Item -LiteralPath $stage -Recurse -Force
  }
}
