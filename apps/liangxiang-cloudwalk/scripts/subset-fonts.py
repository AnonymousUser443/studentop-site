"""Bundle the OFL Noto faces used by the interface, limited to project glyphs."""
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[1]
texts = ''.join(p.read_text(encoding='utf-8') for p in [ROOT / 'index.html', *ROOT.joinpath('src').glob('*.js')])
texts += ''.join(chr(i) for i in range(32, 127))
target = ROOT / 'public' / 'fonts'
target.mkdir(parents=True, exist_ok=True)
sources = [('NotoSerifSC-VF.ttf', 'campus-serif.woff2', 500), ('NotoSansSC-VF.ttf', 'campus-sans.woff2', 400)]
for source, output, weight in sources:
    font = TTFont(Path('C:/Windows/Fonts') / source)
    if 'fvar' in font:
        font = instantiateVariableFont(font, {'wght': weight}, inplace=True)
    options = subset.Options()
    options.flavor = 'woff2'
    options.desubroutinize = True
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(text=texts)
    subsetter.subset(font)
    font.flavor = 'woff2'
    font.save(target / output)
    print(f'{output}: {(target / output).stat().st_size:,} bytes')
