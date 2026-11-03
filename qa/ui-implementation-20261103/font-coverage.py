import json
from pathlib import Path
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parents[2]
app = root / 'apps' / 'liyun-explorer'
required = {ord(char) for char in (app / 'scripts' / 'fonts-characters.txt').read_text(encoding='utf-8') if not char.isspace()}
fonts = {}
coverage = set()
for name in ['NotoSerifSC-UI.woff2', 'MaShanZheng-UI.woff2', 'LiyunSymbols-UI.woff2']:
    filename = app / 'public' / 'assets' / 'fonts' / name
    font = TTFont(filename)
    cmap = set().union(*(table.cmap.keys() for table in font['cmap'].tables))
    coverage |= cmap
    cjk = {code for code in required if 0x3400 <= code <= 0x9fff}
    fonts[name] = {'bytes': filename.stat().st_size, 'missingCjk': [chr(code) for code in sorted(cjk - cmap)] if name != 'LiyunSymbols-UI.woff2' else [],
                   'role': 'symbol fallback' if name == 'LiyunSymbols-UI.woff2' else 'primary CJK'}
    font.close()
missing = [chr(code) for code in sorted(required - coverage)]
result = {'ok': not missing and all(not item['missingCjk'] for item in fonts.values()),
          'requiredCodepoints': len(required), 'scope': 'runtime literals/JSX/JSON/CSS-content collected by TypeScript parser; no tests or source comments',
          'fonts': fonts, 'missingAcrossPackagedFonts': missing}
(Path(__file__).parent / 'font-coverage.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(result, ensure_ascii=False, indent=2))
raise SystemExit(0 if result['ok'] else 1)
