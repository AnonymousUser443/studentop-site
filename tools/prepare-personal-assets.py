"""Create web-sized copies of user supplied art; never edits source files."""
from pathlib import Path
import argparse
import hashlib
import json
import shutil
from PIL import Image, ImageOps

p = argparse.ArgumentParser()
p.add_argument('--avatar', type=Path, required=True)
p.add_argument('--wallpaper', type=Path, required=True)
a = p.parse_args()
root = Path(__file__).resolve().parents[1]
out = root / 'site/assets/img'
for source in (a.avatar, a.wallpaper):
    if not source.is_file():
        raise SystemExit(f'Missing source: {source}')
# Validate both inputs before writing any deliverable.
with Image.open(a.avatar) as im:
    avatar_size = im.size
with Image.open(a.wallpaper) as im:
    wall = ImageOps.exif_transpose(im).convert('RGB')
    wallpaper_size = wall.size
out.mkdir(parents=True, exist_ok=True)
shutil.copyfile(a.avatar, out / 'avatar-aiden.jpg')
wall.thumbnail((2560, 1440), Image.Resampling.LANCZOS)
wall.save(out / 'wall-chenyu.webp', 'WEBP', quality=91, method=6)
thumb = wall.copy()
thumb.thumbnail((480, 270), Image.Resampling.LANCZOS)
thumb.save(out / 'thumb-chenyu.webp', 'WEBP', quality=84, method=6)
files = []
for name in ('avatar-aiden.jpg', 'wall-chenyu.webp', 'thumb-chenyu.webp'):
    path = out / name
    with Image.open(path) as im:
        size, fmt = im.size, im.format
    files.append({'path': path.relative_to(root).as_posix(), 'dimensions': list(size), 'format': fmt, 'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
print(json.dumps({'sources': {'avatar': list(avatar_size), 'wallpaper': list(wallpaper_size)}, 'files': files}, ensure_ascii=False, indent=2))
