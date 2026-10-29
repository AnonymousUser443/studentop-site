# 素材来源与维护

本清单依据工程实际文件整理。素材均从本地 `public/assets/` 加载；开发和预览不依赖外部字体、图片或音频服务。本版用于用户提供素材的本地项目，未进行线上发布。

## 校园地图

原始包为上层目录的 `图片资产/其他预置资产/liyun-map-v04-calibrated-20261026T122237Z.zip`。其中 `assets/maps/campus_no_labels.webp` 与 `campus_no_labels.png` 已分别作为本项目的 `campus.webp` 与 `campus.png` 保留；原包同时包含 SVG、校准与控制点记录。`scripts/map-source.svg` 是地图装饰处理的源文件。

| 本地文件 | 用途 |
| --- | --- |
| `public/assets/maps/campus-enhanced.webp` | 桌面主地图，4000×4958，约 560 KiB |
| `public/assets/maps/campus-enhanced-mobile.webp` | 移动横屏主地图，2000×2479，约 213 KiB |
| `public/assets/maps/campus.webp` | 完整无字原图，4000×4958；增强图加载失败时回退 |
| `public/assets/maps/campus.png` | 原始无损 PNG 留档 |
| `public/assets/maps/metadata.json` | 原地图包的来源、尺寸、哈希与坐标约定 |
| `scripts/map-enhanced-source.svg` | 补充树冠、统一色彩与建筑分级阴影后的可编辑地图 |

固定坐标契约：

```text
map_id = campus-v04-eaa124716c51375f
logical_canvas = 4000 × 4958
viewBox = 0 0 1000.56 1240.28003
u = svg_x / 1000.56
v = svg_y / 1240.28003
screen_x = camera.x + u × 4000 × camera.scale
screen_y = camera.y + v × 4958 × camera.scale
```

移动图只降低像素分辨率，仍表示同一完整画布。视口通过相机变换展示其中一部分，不能用视口裁图重新计算 UV。地标数据集中在 `src/data.ts`。源包记载 WGS84 校准信息，本前端没有启用地理定位或经纬度转换服务。

`metadata.json` 内的 `image.url` 与 `fallback_url` 保留原包路径，不是当前前端运行时路径；实际请求由 `MapScene.tsx` 指向上表中的文件。其源哈希用于追溯原图，不应被解释为增强图的哈希。

增强图使用 `scripts/map-enhance.ps1` 调整配色、绘制俯视树冠与硬边阴影，保留建筑、道路与湖岸几何。树冠是装饰分布，不是现实树木清点或精确定位数据。维护流程如下：

1. 在 `web` 目录运行 `powershell -ExecutionPolicy Bypass -File scripts/map-enhance.ps1`。
2. 用 Chrome 打开并完整渲染 `scripts/map-render.html`，画幅为 2800×3471；检查草地蒙版中的树冠确实显示。
3. 将完整画幅编码成 4000×4958 的桌面 WebP 和 2000×2479 的移动 WebP，再复核地标落点。不要裁切画布。

该辅助脚本只生成增强 SVG，不自动启动浏览器。现有脚本明确记录：ImageMagick 直接渲染此 SVG 会丢失蒙版树冠层，因此地图栅格化采用浏览器渲染后的完整图像。

## 用户提供的 BGM

原始音频位于上层目录 `BGM/`。没有推断歌名、作者或公开授权；原文件名及本地格式如下：

| 曲目 ID / 设置显示 | 原始文件 | 时长（秒） | 运行时资源 |
| --- | --- | ---: | --- |
| 0 / 校园配乐 · 壹 | `BGM/bgm1.opus` | 216.382 | `bgm1.opus`、`bgm1.mp3` |
| 1 / 校园配乐 · 贰 | `BGM/bgm2.opus` | 114.786 | `bgm2.opus`、`bgm2.mp3` |
| 2 / 校园配乐 · 叁 | `BGM/bgm3.opus` | 108.209 | `bgm3.opus`、`bgm3.mp3` |

运行时文件均在 `public/assets/audio/`，时长与转换记录见同目录 `manifest.json`。Opus 从用户文件复制，MP3 由 FFmpeg `libmp3lame -q:a 4` 生成并移除原元数据。重新准备音频可运行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/audio-assets.ps1
```

脚本需要 FFmpeg。播放器优先尝试 Opus；浏览器不支持或解码失败时回退 MP3。音乐循环播放，页面入场手势启动；只有一个背景音乐元素。切曲、音量、静音与页面隐藏由 `useAudio` 管理。发现提示音通过 Web Audio 正弦振荡器生成，没有额外采样音效文件。用户提供音频的所有权与再分发权未独立核验；当前交付范围为本地使用。

## 字体

| 字体 | 来源与用途 | 运行时文件 | 许可文件 |
| --- | --- | --- | --- |
| Noto Serif SC | 本机 `C:/Windows/Fonts/NotoSerifSC-VF.ttf`；正文、数值、菜单 | `NotoSerifSC-UI.woff2`，222,552 字节 | `NotoSerifSC-OFL.txt` |
| Ma Shan Zheng | 工程保留 `MaShanZheng-Regular.ttf`；品牌与书法标题 | `MaShanZheng-UI.woff2`，187,600 字节 | `MaShanZheng-OFL.txt` |

文件均位于 `public/assets/fonts/`。两份许可文件均声明 SIL Open Font License 1.1；交付时应保留许可。CSS 使用本地 WOFF2 子集，不发起在线字体请求。

`scripts/fonts-build.ps1` 扫描 `src/` 下的 TS、TSX、CSS 与 JSON 文本，生成 `fonts-characters.txt` 并调用 fontTools 的 `pyftsubset`。新增中文文案后运行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/fonts-build.ps1
```

需要 `pyftsubset` 与 Brotli 支持；可用 `-SerifSource` 指定其他 Noto 源字体路径。子集不覆盖任意用户输入或未来所有汉字；若引入动态内容，应扩展字符范围或提供相应字体策略。

## 独立图像与 SVG 界面

| 文件或模块 | 来源与用途 |
| --- | --- |
| `public/assets/paintings/*.webp` | 取自本项目「霜降雅集」应用的手绘校园插画（frost.studentop.cn，1400×880），用作备选底图 |
| `public/assets/paintings/frost-frame.webp` | 霜降雅集主界面的边框原画截取（1920×1080），作为理韵寻踪的主背景 |
| `src/hud/Scenery.tsx` | 程序内 SVG：地图四周的远山、雾带、湖面、坡岸、松枝、山亭与扁舟 |
| `src/hud/Ornaments.tsx` | 程序内 SVG：品牌门景、菜单底形、罗盘、纸片云纹与边饰 |
| `src/hud/Icon.tsx` | 程序内 SVG：书本、枫叶、图鉴、设置等 UI 图标 |
| `src/map/MapScene.tsx` | 程序内 SVG：地标菱形、真理之塔、玩家箭头与水纹 |
| `src/effects/Atmosphere.tsx` | p5/Canvas 绘制云片、落叶、微光和发现光效 |

角落前景由 Scenery 组件矢量绘制（松枝、山亭、芦苇与坡岸），不再依赖 ImageGen 位图构件。构图与艺术方向参考上层 `参考图/游戏HUD设计参考图底图/` 和 `参考图/整体风格基调的参考图/原神参考图1.png`。参考图用于布局、色块层次与剪纸语汇，运行时地图与界面来自上述实际资源。

所有新增构件遵循利落剪影、平涂色块、分级阴影、玉绿与奶油金。后续替换图像时保持透明边界、图层位置及中央地图可读区域，并记录新来源。
