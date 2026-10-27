param(
  [string]$SerifSource = 'C:/Windows/Fonts/NotoSerifSC-VF.ttf'
)

$ErrorActionPreference = 'Stop'
$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$env:PYTHONIOENCODING = 'utf-8'
$webRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$fontRoot = Join-Path $webRoot 'public/assets/fonts'
$characterFile = Join-Path $PSScriptRoot 'fonts-characters.txt'
$fontFiles = Get-ChildItem -LiteralPath (Join-Path $webRoot 'src') -File -Recurse
$fontText = [System.Text.StringBuilder]::new()
[void]$fontText.Append('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz .,!?;:-_/%+()[]')
foreach ($source in $fontFiles) {
  if ($source.Extension -in '.ts', '.tsx', '.css', '.json') {
    [void]$fontText.Append([System.IO.File]::ReadAllText($source.FullName, [System.Text.Encoding]::UTF8))
  }
}
$fontCharacters = -join ($fontText.ToString().ToCharArray() | Sort-Object -Unique)
[System.IO.File]::WriteAllText($characterFile, $fontCharacters, [System.Text.UTF8Encoding]::new($false))

if (-not (Test-Path -LiteralPath $SerifSource)) {
  throw 'Noto Serif SC source font is missing; pass -SerifSource with its file path.'
}
$subsetCommand = Get-Command pyftsubset -ErrorAction Stop
& $subsetCommand.Source $SerifSource "--text-file=$characterFile" "--output-file=$fontRoot/NotoSerifSC-UI.woff2" '--flavor=woff2' '--layout-features=*' '--no-hinting'
if ($LASTEXITCODE -ne 0) { throw 'Noto Serif SC subset failed.' }
& $subsetCommand.Source "$fontRoot/MaShanZheng-Regular.ttf" "--text-file=$characterFile" "--output-file=$fontRoot/MaShanZheng-UI.woff2" '--flavor=woff2' '--layout-features=*' '--no-hinting'
if ($LASTEXITCODE -ne 0) { throw 'Ma Shan Zheng subset failed.' }
Get-Item -LiteralPath "$fontRoot/NotoSerifSC-UI.woff2", "$fontRoot/MaShanZheng-UI.woff2" | Select-Object Name, Length
