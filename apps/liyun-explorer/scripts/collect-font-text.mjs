import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = process.argv.indexOf('--out');
if (output < 0 || !process.argv[output + 1]) throw new Error('Usage: node collect-font-text.mjs --out FILE');
const strings = ['0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz .,!?;:-_/%+()[]', '×–—•·◇◆▲▼←→↑↓…°±≥≤✓✕'];
let sourceFiles = 0;
function jsonText(value) {
  if (typeof value === 'string') strings.push(value);
  else if (Array.isArray(value)) value.forEach(jsonText);
  else if (value && typeof value === 'object') Object.values(value).forEach(jsonText);
}
function walk(folder) {
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const filename = path.join(folder, entry.name);
    if (entry.isDirectory()) { if (entry.name !== 'qa') walk(filename); continue; }
    if (/\.test\.|\.d\.(?:ts|mts)$/.test(entry.name)) continue;
    const extension = path.extname(filename);
    if (!['.ts', '.tsx', '.mjs', '.js', '.json', '.css'].includes(extension)) continue;
    const text = fs.readFileSync(filename, 'utf8');
    sourceFiles += 1;
    if (extension === '.json') { jsonText(JSON.parse(text)); continue; }
    if (extension === '.css') {
      for (const match of text.matchAll(/\bcontent\s*:\s*(['"])(.*?)\1/g)) {
        strings.push(match[2].replace(/\\([a-f\d]{1,6})\s?/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16))));
      }
      continue;
    }
    const source = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true,
      extension === '.tsx' ? ts.ScriptKind.TSX : extension === '.ts' ? ts.ScriptKind.TS : ts.ScriptKind.JS);
    function visit(node) {
      if (ts.isStringLiteralLike(node) || ts.isJsxText(node)
        || node.kind === ts.SyntaxKind.TemplateHead || node.kind === ts.SyntaxKind.TemplateMiddle || node.kind === ts.SyntaxKind.TemplateTail) strings.push(node.text);
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
}
walk(path.join(app, 'src'));
const characters = [...new Set(Array.from(strings.join('').replace(/[\r\n\t]/g, '')))].sort().join('');
if (characters.length < 100) throw new Error('Unexpectedly empty runtime text; refusing font replacement.');
fs.writeFileSync(process.argv[output + 1], characters, 'utf8');
console.log(JSON.stringify({ sourceFiles, characters: Array.from(characters).length,
  scope: 'Runtime literals, JSX text, JSON values and CSS content; excludes tests, QA artifacts, declarations and source comments.' }));
