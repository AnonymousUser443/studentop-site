import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(here, '../../../apps/liyun-explorer/src');
const files = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(path.join(directory, entry.name)) : entry.name.endsWith('.css') ? [path.join(directory, entry.name)] : []);
const total = new Set(), hexBase = new Set(), rgba = new Set();
const report = files(source).map(file => {
  const css = fs.readFileSync(file, 'utf8');
  const hex = [...new Set((css.match(/#[0-9a-f]{3,8}\b/gi) ?? []).map(color => color.toLowerCase()))].sort();
  const rgb = [...new Set(css.match(/rgba?\([^)]*\)/gi) ?? [])].sort();
  hex.forEach(color => { total.add(color); let base=color.slice(1); if(base.length===3||base.length===4)base=[...base].map(digit=>digit+digit).join(''); hexBase.add('#'+base.slice(0,6)); });
  rgb.forEach(color => rgba.add(color));
  return { file: path.relative(source, file).replaceAll('\\', '/'), hexCount: hex.length, hex, rgbCount: rgb.length, rgb };
});
const output = { at: new Date().toISOString(), metric: 'Literal CSS #hex tokens in src/**/*.css; includes 8-digit alpha variants; excludes TS/SVG/raster pixels and computed colors.', uniqueHex: total.size, uniqueHexBase: hexBase.size, uniqueRgb: rgba.size, files: report };
if (process.argv[2]) fs.writeFileSync(path.resolve(here, process.argv[2]), JSON.stringify(output, null, 2));
console.log(JSON.stringify({ uniqueHex: output.uniqueHex, uniqueHexBase: output.uniqueHexBase, uniqueRgb: output.uniqueRgb, files: report.map(({ file, hexCount, rgbCount }) => ({ file, hexCount, rgbCount })) }, null, 2));
