import argparse
import json
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools import subset

parser = argparse.ArgumentParser(description='Create the eight-glyph UI symbol fallback from a licensed local DejaVu Sans source.')
parser.add_argument('--source', required=True)
parser.add_argument('--out', required=True)
parser.add_argument('--license-out', required=True)
args = parser.parse_args()
font = TTFont(args.source)
license_text = font['name'].getDebugName(13) or ''
copyright_text = font['name'].getDebugName(0) or ''
if 'Permission is hereby granted' not in license_text or 'DejaVu' not in copyright_text:
    raise SystemExit('Expected the locally installed, redistributable DejaVu Sans source with its embedded license.')
characters = '↩↵↶↷▴▾◈✕'
options = subset.Options()
options.hinting = False
options.layout_features = ['*']
subsetter = subset.Subsetter(options=options)
subsetter.populate(unicodes=[ord(char) for char in characters])
subsetter.subset(font)
for record in font['name'].names:
    if record.nameID in {1, 2, 3, 4, 6, 16, 17}:
        name = 'Regular' if record.nameID in {2, 17} else 'Liyun Symbols'
        if record.nameID == 6:
            name = 'LiyunSymbols-Regular'
        record.string = name.encode(record.getEncoding(), errors='replace')
font.flavor = 'woff2'
output = Path(args.out)
output.parent.mkdir(parents=True, exist_ok=True)
font.save(output)
font.close()
Path(args.license_out).write_text(copyright_text + '\n' + license_text + '\n', encoding='utf-8')
print(json.dumps({'font': 'Liyun Symbols', 'glyphs': len(characters), 'bytes': output.stat().st_size, 'licenseCopied': True}))
