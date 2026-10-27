# -*- coding: utf-8 -*-
"""仿 Windows 11 抽象壁纸：mesh gradient + 柔光丝带 + bokeh + 颗粒"""
import os
import numpy as np
from PIL import Image

W, H = 2400, 1350
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "win11-homepage", "assets", "img")
os.makedirs(OUT, exist_ok=True)

Y, X = np.mgrid[0:H, 0:W].astype(np.float32)
NX = X / W
NY = Y / H
UX = (X - W * 0.5) / W
UY = (Y - H * 0.5) / W

rng = np.random.default_rng(20261027)


def hexrgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)], dtype=np.float32)


def base_gradient(stops):
    t = NX * 0.5 + NY * 0.5
    out = np.zeros((H, W, 3), dtype=np.float32)
    for i in range(len(stops) - 1):
        p0, c0 = stops[i]
        p1, c1 = stops[i + 1]
        a = np.clip((t - p0) / max(1e-6, (p1 - p0)), 0, 1)
        a = a * a * (3 - 2 * a)
        c0v, c1v = hexrgb(c0), hexrgb(c1)
        m = (t >= p0) & (t <= p1)
        for ch in range(3):
            out[..., ch] += np.where(m, c0v[ch] + (c1v[ch] - c0v[ch]) * a, 0)
    return out


def blob(c, cx, cy, rx, ry, ang, color, power=2.4, strength=1.0):
    dx = NX - cx
    dy = (NY - cy) * (H / W)
    ca, sa = np.cos(ang), np.sin(ang)
    u = dx * ca + dy * sa
    v = -dx * sa + dy * ca
    d = np.sqrt((u / rx) ** 2 + (v / ry) ** 2)
    a = np.clip(1 - d, 0, 1) ** power * strength
    col = hexrgb(color)
    for ch in range(3):
        c[..., ch] += col[ch] * a
    return c


def band(c, cx, cy, radius, lobes, amp, width, c1, c2, phase=0.0, strength=0.25, rot=0.0):
    """柔光丝带：绕中心的低频玫瑰线光带"""
    dx = NX - cx
    dy = (NY - cy) * (H / W)
    th = np.arctan2(dy, dx) + rot
    r = np.sqrt(dx ** 2 + dy ** 2)
    r0 = radius * (1.0 + amp * np.cos(lobes * th + phase))
    a = np.exp(-((r - r0) / width) ** 2) * strength
    t = 0.5 + 0.5 * np.cos(lobes * th + phase + 1.0)
    for ch in range(3):
        c[..., ch] += (hexrgb(c1)[ch] * (1 - t) + hexrgb(c2)[ch] * t) * a
    return c


def bokeh(c, count, colors, strength=0.10, focus=(0.5, 0.5), spread=0.85, rmin=0.008, rmax=0.075):
    for i in range(count):
        cx = focus[0] + (rng.random() - 0.5) * 2 * spread
        cy = focus[1] + (rng.random() - 0.5) * 2 * spread
        r = rmin + (rmax - rmin) * rng.random() ** 1.8
        col = colors[int(rng.integers(0, len(colors)))]
        a = (0.35 + 0.65 * rng.random()) * strength
        dx = NX - cx
        dy = (NY - cy) * (H / W)
        d = np.sqrt(dx * dx + dy * dy)
        ring = np.exp(-((d - r) / (r * 0.28)) ** 2) * a
        soft = np.clip(1 - d / r, 0, 1) ** 2 * a * 0.35
        for ch in range(3):
            c[..., ch] += hexrgb(col)[ch] * (ring + soft)
    return c


def glint(c, count, color="#ffffff", strength=0.5):
    for i in range(count):
        cx, cy = rng.random(), rng.random() * 0.7
        r = 0.0012 + rng.random() * 0.0022
        dx = NX - cx
        dy = (NY - cy) * (H / W)
        d = np.sqrt(dx * dx + dy * dy)
        a = np.exp(-(d / r) ** 2) * strength * (0.4 + 0.6 * rng.random())
        for ch in range(3):
            c[..., ch] += hexrgb(color)[ch] * a
    return c


def finish(c, vignette=0.55, grain=2.2, exposure=1.3):
    img = 1.0 - np.exp(-c * exposure)
    img = np.clip(img, 0, 1)
    vx = (NX - 0.5) * 1.25
    vy = (NY - 0.5) * 1.25
    v = np.clip(1.0 - (vx ** 2 + vy ** 2) * vignette, 0, 1) ** 0.9
    img = img * (0.30 + 0.70 * v[..., None])
    noise = rng.normal(0, grain, (H, W, 1))
    img = np.clip(img * 255.0 + noise, 0, 255).astype(np.uint8)
    return Image.fromarray(img, "RGB")


def save(img, name, quality=86):
    img.save(os.path.join(OUT, "wall-%s.jpg" % name), "JPEG", quality=quality, optimize=True, progressive=True)
    img.resize((480, 270), Image.LANCZOS).save(os.path.join(OUT, "thumb-%s.jpg" % name), "JPEG", quality=78, optimize=True)
    print("saved", name, os.path.getsize(os.path.join(OUT, "wall-%s.jpg" % name)) // 1024, "KB")


def make_bloom():
    c = base_gradient([(0.0, "#04091c"), (0.28, "#08194f"), (0.52, "#0f2f8f"), (0.76, "#2a5fd0"), (1.0, "#9ec6ff")])
    c = blob(c, 0.10, 0.12, 0.62, 0.5, 0.4, "#37c9ff", 2.6, 0.85)
    c = blob(c, 0.92, 0.18, 0.55, 0.46, -0.3, "#8b9dff", 2.4, 0.75)
    c = blob(c, 0.80, 0.95, 0.62, 0.46, 0.2, "#1b3fbe", 2.4, 0.7)
    c = blob(c, 0.28, 0.98, 0.5, 0.38, -0.4, "#0d2a86", 2.6, 0.6)
    c = blob(c, 0.55, 0.48, 0.30, 0.24, 0, "#7fdcff", 2.0, 0.55)
    # 柔光丝带（低对比，只做氛围）
    c = band(c, 0.60, 0.46, 0.34, 3, 0.22, 0.11, "#5fd8ff", "#a98bff", phase=0.6, strength=0.20, rot=0.5)
    c = band(c, 0.52, 0.55, 0.20, 5, 0.26, 0.075, "#e9f8ff", "#ffd9f2", phase=1.4, strength=0.20, rot=-0.3)
    c = blob(c, 0.58, 0.47, 0.085, 0.07, 0, "#eaf9ff", 1.5, 1.3)
    c = bokeh(c, 20, ["#9fe6ff", "#ffffff", "#c9b8ff", "#8fb4ff"], 0.05, (0.55, 0.5), 0.95)
    c = glint(c, 9, "#ffffff", 0.32)
    return finish(c, vignette=0.78, grain=2.0, exposure=1.45)


def make_dusk():
    c = base_gradient([(0.0, "#050510"), (0.28, "#150c33"), (0.52, "#3d1559"), (0.76, "#7b2a63"), (1.0, "#d97b86")])
    c = blob(c, 0.14, 0.16, 0.6, 0.48, 0.3, "#6b4bff", 2.6, 0.8)
    c = blob(c, 0.90, 0.22, 0.55, 0.46, -0.2, "#ff5b9c", 2.4, 0.7)
    c = blob(c, 0.62, 0.98, 0.55, 0.4, 0, "#20154a", 2.4, 0.6)
    c = blob(c, 0.55, 0.45, 0.28, 0.22, 0, "#c07bff", 2.0, 0.5)
    c = band(c, 0.58, 0.5, 0.33, 3, 0.24, 0.10, "#ff9bd0", "#b98bff", phase=1.0, strength=0.22, rot=0.8)
    c = band(c, 0.5, 0.55, 0.19, 5, 0.28, 0.07, "#ffe9f4", "#ffc98f", phase=1.7, strength=0.22, rot=-0.5)
    c = blob(c, 0.57, 0.47, 0.075, 0.06, 0, "#ffeaf6", 1.5, 1.2)
    c = bokeh(c, 24, ["#ffd4a8", "#ffffff", "#ff9dcb", "#b79dff"], 0.05, (0.55, 0.5), 0.95)
    c = glint(c, 8, "#fff2dc", 0.30)
    return finish(c, vignette=0.75, grain=2.1, exposure=1.5)


def make_aurora():
    c = base_gradient([(0.0, "#021018"), (0.28, "#042b34"), (0.52, "#07514f"), (0.76, "#0d7a68"), (1.0, "#7fd6be")])
    c = blob(c, 0.16, 0.86, 0.6, 0.46, 0.4, "#12cf9c", 2.6, 0.8)
    c = blob(c, 0.78, 0.10, 0.6, 0.46, -0.3, "#2fd4ff", 2.4, 0.8)
    c = blob(c, 0.86, 0.80, 0.5, 0.4, 0, "#6b39d8", 2.2, 0.45)
    c = blob(c, 0.42, 0.5, 0.26, 0.2, 0, "#8fffe0", 2.0, 0.45)
    c = band(c, 0.48, 0.52, 0.30, 3, 0.26, 0.095, "#4ff0c8", "#7ce8ff", phase=0.3, strength=0.22, rot=0.2)
    c = band(c, 0.52, 0.44, 0.18, 5, 0.30, 0.062, "#eafff9", "#b9f3ff", phase=1.2, strength=0.22, rot=-0.7)
    c = blob(c, 0.5, 0.46, 0.07, 0.056, 0, "#f0fffb", 1.5, 1.1)
    c = bokeh(c, 22, ["#9dffe4", "#ffffff", "#a8e8ff", "#b49dff"], 0.045, (0.5, 0.52), 0.95)
    c = glint(c, 7, "#e8fff8", 0.26)
    return finish(c, vignette=0.7, grain=2.1, exposure=1.45)


def make_sakura():
    c = base_gradient([(0.0, "#1c0a1c"), (0.28, "#3d1030"), (0.52, "#7a1d4a"), (0.76, "#c2487a"), (1.0, "#ffc7c2")])
    c = blob(c, 0.16, 0.16, 0.6, 0.46, 0.3, "#ff7aa8", 2.6, 0.75)
    c = blob(c, 0.88, 0.20, 0.55, 0.46, -0.2, "#ffb57a", 2.4, 0.65)
    c = blob(c, 0.72, 0.96, 0.55, 0.4, 0, "#5b1440", 2.4, 0.65)
    c = blob(c, 0.54, 0.48, 0.28, 0.22, 0, "#ff9dc6", 2.0, 0.55)
    c = band(c, 0.56, 0.5, 0.32, 3, 0.24, 0.10, "#ffc2d8", "#ffb07a", phase=0.9, strength=0.22, rot=0.6)
    c = band(c, 0.5, 0.54, 0.19, 5, 0.28, 0.068, "#fff4f8", "#ffd9a8", phase=1.5, strength=0.22, rot=-0.4)
    c = blob(c, 0.55, 0.47, 0.075, 0.06, 0, "#fff4f8", 1.5, 1.2)
    c = bokeh(c, 20, ["#ffd8e4", "#ffffff", "#ffc59a", "#ffa8c8"], 0.05, (0.55, 0.5), 0.95)
    c = glint(c, 6, "#fff2f6", 0.26)
    return finish(c, vignette=0.68, grain=2.0, exposure=1.45)


def make_solid():
    c = base_gradient([(0.0, "#080f1c"), (0.5, "#16213b"), (1.0, "#334155")])
    c = blob(c, 0.85, 0.12, 0.5, 0.4, 0, "#1e293b", 2.4, 0.6)
    return finish(c, vignette=0.6, grain=1.8, exposure=1.05)


if __name__ == "__main__":
    save(make_bloom(), "bloom")
    save(make_dusk(), "dusk")
    save(make_aurora(), "aurora")
    save(make_sakura(), "sakura")
    save(make_solid(), "solid", quality=80)
    print("done")