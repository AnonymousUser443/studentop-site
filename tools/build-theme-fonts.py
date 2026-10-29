"""Build reproducible local OFL font subsets for the two new themes.
Requires fontTools[woff] / pyftsubset; shipped fonts are ready for normal browsing.
Uses only explicit source directories, never changes the original font files.
"""
from pathlib import Path
import argparse
import hashlib
import json
import shutil
import subprocess
import tempfile

p = argparse.ArgumentParser()
p.add_argument('--sans', type=Path, required=True)
p.add_argument('--serif', type=Path, required=True)
p.add_argument('--subsetter', default='pyftsubset')
p.add_argument('--site-only', action='store_true', help='Update only homepage font files; keep campus assets unchanged.')
a = p.parse_args()
root = Path(__file__).resolve().parents[1]
exe = shutil.which(a.subsetter)
if not exe:
    raise SystemExit('pyftsubset is required only to rebuild fonts; install fonttools[woff] or pass --subsetter.')
for path in (a.sans, a.serif):
    if not path.is_file():
        raise SystemExit(f'Missing font source: {path}')
chars = set(chr(c) for c in range(32, 127))
chars.update('青玉纸境北理工校园入场文博中心徐特立图书馆综合教学楼理韵寻踪正在加载进入探索返回关闭打开开始取消确认保存下载新建全部应用更多今天星期年月日一二三四五六七八九十百千零〇春夏秋冬早午晚你好欢迎同学设置减少动态音量亮度壁纸个性化任务视图最小大还原移动贴靠分屏左右上下全屏重新连接选择恢复文件帮助搜索通知清除已读网络模拟状态学习研究非官方作品。，“”‘’！？：；、（）【】《》—…·→←↑↓↗×＋−％℃')
paths = []
for folder in (root / 'site', root / 'apps/genshin-start/src'):
    for path in sorted(folder.rglob('*')):
        if path.is_file() and path.suffix in ('.html', '.js', '.ts', '.tsx', '.css', '.less') and 'libs' not in path.parts:
            paths.append(path)
paths.append(root / 'apps/genshin-start/index.html')
for path in paths:
    if path.is_file():
        chars.update(path.read_text(encoding='utf-8'))
text = ''.join(sorted(chars))
destinations = [root / 'site/assets/fonts', root / 'apps/genshin-start/public/campus/fonts']
if a.site_only:
    destinations = destinations[:1]
results = []
with tempfile.TemporaryDirectory(prefix='paper-theme-fonts-') as td:
    temp = Path(td)
    textfile = temp / 'characters.txt'
    textfile.write_text(text, encoding='utf-8')
    for source, name in ((a.sans, 'noto-sans-sc.woff2'), (a.serif, 'noto-serif-sc.woff2')):
        output = temp / name
        subprocess.run([exe, str(source), '--flavor=woff2', '--layout-features=*', '--name-IDs=*', '--name-languages=*', '--ignore-missing-glyphs', '--notdef-glyph', '--notdef-outline', '--recommended-glyphs', f'--text-file={textfile}', f'--output-file={output}'], check=True)
        results.append({'name': name, 'bytes': output.stat().st_size, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest()})
    # Only replace deployed files after both subsets completed.
    for dest in destinations:
        dest.mkdir(parents=True, exist_ok=True)
        for item in results:
            shutil.copyfile(temp / item['name'], dest / item['name'])
print(json.dumps({'characters': len(chars), 'sourceFiles': len(paths), 'fonts': results}, ensure_ascii=False, indent=2))
