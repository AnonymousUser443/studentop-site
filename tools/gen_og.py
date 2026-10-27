# -*- coding: utf-8 -*-
import os
from PIL import Image
base = r'D:/Users/Desktop/北理的文件夹/CodeWhale工作文件夹'
src = Image.open(os.path.join(base, 'qa', 'final-desktop.png')).convert('RGB')
W, H = src.size
# 裁成 1200x630 比例（1.9048）
target_ratio = 1200 / 630
new_h = int(W / target_ratio)
top = max(0, int((H - new_h) * 0.45))
crop = src.crop((0, top, W, min(H, top + new_h)))
crop = crop.resize((1200, 630), Image.LANCZOS)
out = os.path.join(base, 'win11-homepage', 'assets', 'img', 'og-cover.jpg')
crop.save(out, 'JPEG', quality=86, optimize=True, progressive=True)
print('og cover saved', os.path.getsize(out) // 1024, 'KB')
