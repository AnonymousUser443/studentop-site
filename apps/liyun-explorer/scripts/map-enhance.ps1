$ErrorActionPreference = 'Stop'
$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$sourcePath = Join-Path $PSScriptRoot 'map-source.svg'
$outputRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../public/assets/maps'))
$svgText = [System.IO.File]::ReadAllText($sourcePath)
$svgText = $svgText.Replace('#7C8846','#80926b').Replace('#60692E','#526c4f').Replace('#39411C','#365444').Replace('#338D9E','#4c9399').Replace('#BCC7BD','#d6d3b2')
$doc = [System.Xml.XmlDocument]::new()
$doc.XmlResolver = $null
$doc.LoadXml($svgText)
$svgNS = 'http://www.w3.org/2000/svg'
$defs = $doc.DocumentElement.SelectSingleNode('*[local-name()="defs"]')
$extraDefs = $doc.CreateDocumentFragment()
$extraDefs.InnerXml = @'
<g xmlns="http://www.w3.org/2000/svg">
 <filter id="cel-roof-shadow" x="-10%" y="-10%" width="130%" height="140%"><feDropShadow dx="2.3" dy="3.1" stdDeviation="0" flood-color="#405344" flood-opacity=".30"/></filter>
 <pattern id="map-paper-speckle" width="17" height="19" patternUnits="userSpaceOnUse"><circle cx="2" cy="4" r=".18" fill="#fff5cf"/><circle cx="12" cy="14" r=".22" fill="#6d734c"/><path d="m9 8 1.1-.2M4 16l.8-.3" stroke="#b9b694" stroke-width=".15"/></pattern>
 <g id="tree-green"><path d="M-7 5 1 12 10 6 8-3-4-5Z" fill="#344d3e" opacity=".3"/><path d="M-9 1C-12-4-8-8-4-7-5-12 2-12 4-8 9-10 13-5 9-1 13 3 10 8 5 7 2 12-4 9-4 6-9 8-12 5-9 1Z" fill="#42664f"/><path d="M-8 0C-9-4-5-6-2-5-2-10 3-9 4-5 9-6 10-1 6 1 8 5 4 7 1 4-3 7-7 4-5 1Z" fill="#73916b"/><path d="M-4-4C-3-7 1-7 3-4L4-1 0 0-4-1Z" fill="#a4b47b"/><path d="m-6 2 4-1m4-6 1 3m3 5-3 1" stroke="#c0c696" stroke-width=".5" fill="none"/></g>
 <g id="tree-olive"><path d="M-7 5 1 12 10 6 8-3-4-5Z" fill="#344d3e" opacity=".25"/><path d="M-9 1C-12-4-8-8-4-7-5-12 2-12 4-8 9-10 13-5 9-1 13 3 10 8 5 7 2 12-4 9-4 6-9 8-12 5-9 1Z" fill="#687c4e"/><path d="M-8 0C-9-4-5-6-2-5-2-10 3-9 4-5 9-6 10-1 6 1 8 5 4 7 1 4-3 7-7 4-5 1Z" fill="#9aa76a"/><path d="M-4-4C-3-7 1-7 3-4L4-1 0 0-4-1Z" fill="#c5cd8e"/><path d="m-5 1 3-1m3-4 1 3" stroke="#d8dba7" stroke-width=".5" fill="none"/></g>
 <g id="tree-gold"><path d="M-7 5 1 12 10 6 8-3-4-5Z" fill="#5e5c37" opacity=".3"/><path d="M-9 1C-12-4-8-8-4-7-5-12 2-12 4-8 9-10 13-5 9-1 13 3 10 8 5 7 2 12-4 9-4 6-9 8-12 5-9 1Z" fill="#ad914d"/><path d="M-8 0C-9-4-5-6-2-5-2-10 3-9 4-5 9-6 10-1 6 1 8 5 4 7 1 4-3 7-7 4-5 1Z" fill="#d2b45e"/><path d="M-4-4C-3-7 1-7 3-4L4-1 0 0-4-1Z" fill="#efdb91"/><path d="m-5 1 3-1m3-4 1 3" stroke="#f4e1a3" stroke-width=".5" fill="none"/></g>
</g>
'@
foreach ($node in @($extraDefs.FirstChild.ChildNodes)) { [void]$defs.AppendChild($node.CloneNode($true)) }
$trees=$doc.CreateElement('g',$svgNS)
$trees.SetAttribute('id','game-cel-canopies')
$trees.SetAttribute('mask','url(#grass-silhouette)')
$trees.SetAttribute('data-authority','decorative_top_view_not_tree_inventory')
$rng=[System.Random]::new(12929)
$points=[System.Collections.Generic.List[object]]::new()
foreach($x in @(168,324,450,480,744)){for($y=166;$y -le 1090;$y+=15){$points.Add(@(($x+($rng.NextDouble()-.5)*4),($y+($rng.NextDouble()-.5)*5)))}}
foreach($y in @(246,318,390,523,704,747,900,1090)){for($x=170;$x -le 742;$x+=16){$points.Add(@(($x+($rng.NextDouble()-.5)*5),($y+($rng.NextDouble()-.5)*5)))}}
for($i=0;$i -lt 380;$i++){ $points.Add(@((170+$rng.NextDouble()*570),(170+$rng.NextDouble()*920))) }
$invariant=[System.Globalization.CultureInfo]::InvariantCulture
$count=0
foreach($point in $points){
 $x=[double]$point[0];$y=[double]$point[1]
 if(($x -gt 180 -and $x -lt 315 -and $y -gt 168 -and $y -lt 215) -or ($x -gt 350 -and $x -lt 447 -and $y -gt 170 -and $y -lt 214) -or ($x -gt 242 -and $x -lt 316 -and $y -gt 784 -and $y -lt 879) -or ($x -gt 646 -and $x -lt 717 -and $y -gt 776 -and $y -lt 804)){continue}
 $use=$doc.CreateElement('use',$svgNS)
 $choice=$rng.NextDouble()
 $tree=if($choice -gt .76){'tree-gold'}elseif($choice -gt .42){'tree-olive'}else{'tree-green'}
 $use.SetAttribute('href','http://www.w3.org/1999/xlink',('#'+$tree)) | Out-Null
 $s=(.42+$rng.NextDouble()*.38).ToString('0.###',$invariant)
 $transform='translate('+ $x.ToString('0.###',$invariant)+' '+$y.ToString('0.###',$invariant)+') rotate('+ $rng.Next(0,360)+') scale('+$s+')'
 $use.SetAttribute('transform',$transform)
 [void]$trees.AppendChild($use)
 $count++
}
$building=$doc.SelectSingleNode('//*[@id="09_Buildings_Base"]')
[void]$doc.DocumentElement.InsertBefore($trees,$building)
$building.SetAttribute('filter','url(#cel-roof-shadow)')
$texture=$doc.CreateElement('rect',$svgNS)
$texture.SetAttribute('width','1000.56');$texture.SetAttribute('height','1240.28003');$texture.SetAttribute('fill','url(#map-paper-speckle)');$texture.SetAttribute('opacity','.28')
[void]$doc.DocumentElement.AppendChild($texture)
$enhancedPath=Join-Path $PSScriptRoot 'map-enhanced-source.svg'
$doc.Save($enhancedPath)
Write-Output ('Prepared cel canopy layer with '+$count+' sprites. Geometry remains unchanged.')
Write-Output 'Render scripts/map-render.html in Chrome at 2800x3471 using OpenCLI. ImageMagick SVG rendering drops the masked tree canopy layer and must not be used.'
Write-Output 'Encode the inspected PNG to campus-enhanced.webp at 4000x4958 and campus-enhanced-mobile.webp at 2000x2479.'
