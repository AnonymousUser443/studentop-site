import json
from fontTools.ttLib import TTFont
from pathlib import Path
import os

source = Path('C:/Users/12929/AppData/Local/Microsoft/Windows/Fonts/DejaVuSans.ttf')
font = TTFont(source)
cmap = set().union(*(table.cmap.keys() for table in font['cmap'].tables))
print(json.dumps({'family': font['name'].getDebugName(1), 'license': font['name'].getDebugName(13),
                  'copyright': font['name'].getDebugName(0), 'missing': [char for char in '↩↵↶↷▴▾◈✕' if ord(char) not in cmap]}, ensure_ascii=False, indent=2))
