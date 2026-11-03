# 素材来源与维护

本清单依据工程实际文件整理。素材均从本地 `public/assets/` 加载；开发和预览不依赖外部字体、图片或音频服务。已记录的版本发布见[融合发布记录](../../../docs/PR2-LOCATION-RELEASE-20261028.md)；发布记录不改变用户素材的权利归属。

## 2026-11-03 新增素材与证据入口

本轮新增 8 张地标 `hero.webp` 与 1 张分区墨纹，均由 ImageGen 生成，服务于剪纸 / 水墨概念占位。它们不是校园实景照片、已确认建筑外观或定位证据；演出内保留占位标注，加载失败时以程序化山水兜底。

| 资源 | 使用位置 | 记录 |
| --- | --- | --- |
| `/assets/landmarks/{wencui,beihu,library,teaching,wenbo,sports,tower,park}/hero.webp` | 地标 / 区域 Cinematic 内容插图 | [生成元数据目录](../../../qa/ui-implementation-20261103/assets/) |
| `/assets/regions/ink-cloud.webp` | 分区遮罩单层 / 叠层墨纹，不替代冻结底图 | [本轮素材证据目录](../../../qa/ui-implementation-20261103/assets/) |
| 菜单 / 设置视频关键帧、连续采样 | 布局比例、悬停、选中扫光与进场对照；不作为运行时截图贴图 | [reference](../../../qa/ui-implementation-20261103/menu-settings/reference/)、[说明](../../../qa/ui-implementation-20261103/menu-settings/README.md) |

8 张 hero 的实际交付尺寸均为 **768×432**，水墨云纹为 **1024×1024**，9 张合计 **637,808 字节**。原生生成尺寸为 1672×941（教学楼为1672×940）及云纹1254×1254；它们和提示请求尺寸分别记录，不能混用。原生图已经目视检查，再用本地 FFmpeg 转为 WebP；`scripts/prepare-placeholder-assets.mjs` 仅重做本地转码，不调用生成服务。提示词、源图路径、实际尺寸、压缩字节和SHA-256见[assets/index.json](../../../qa/ui-implementation-20261103/assets/index.json)，运行时校验见[asset-manifest.json](asset-manifest.json)。真理之塔为虚构游戏信标，图像不声称存在对应实体建筑。

本轮分区 / 打卡候选仍为未现场确认推荐稿。地图 `map_id`、完整画幅、六份冻结输入和 `src/data.ts` 公共 UV 不因生成素材或推荐轮廓而改变；人工确认 / `--apply` 流程见[作者指南](../src/calibration/AUTHORING.md)。

最终产物62文件、20,908,923B（19.9403028MiB），距既有20MiB门禁剩62,597B。首屏静态JS图gzip214,068B；p5/GSAP不在该静态图中，p5仍有动态大chunk提示。替换实景图或扩充字体后须重新执行体积/manifest门禁，不能沿用此数字。精确记录见[不变量](../../../qa/ui-implementation-20261103/invariants.json)与[14项构建检查](../../../qa/ui-implementation-20261103/checks.json)。

## 校园地图

2026-10-28 FE-01 接入更新：当前 `MapScene.tsx` 直接加载 `public/assets/maps/calibrated/campus_no_labels.webp`，失败回退同目录 PNG。二者从用户指定的 v0.4 标定包原样复制，均为完整 4000×4958 画布；不再把下列增强图作为运行底图。原文件保留用于追溯。`npm run verify:map` 校验两张原图、模型、元数据及 SDK 的固定 SHA-256。映射代码在 `src/location/vendor/`，未经重拟合或修改。

迁移前记录的原始包为外部素材 `图片资产/其他预置资产/liyun-map-v04-calibrated-20261026T122237Z.zip`；它未随当前源码迁入，不再假定相邻目录存在。其中 `assets/maps/campus_no_labels.webp` 与 `campus_no_labels.png` 已分别作为本项目的 `campus.webp` 与 `campus.png` 保留；原包同时包含 SVG、校准与控制点记录。`scripts/map-source.svg` 是地图装饰处理的源文件。

| 本地文件 | 用途 |
| --- | --- |
| `public/assets/maps/calibrated/campus_no_labels.webp` | 当前运行底图，4000×4958；保留标定包原始字节 |
| `public/assets/maps/calibrated/campus_no_labels.png` | 当前运行底图的 PNG 回退，4000×4958 |
| `public/assets/maps/campus-enhanced.webp` | 历史增强桌面图，4000×4958，约 560 KiB；当前不作为运行底图 |
| `public/assets/maps/campus-enhanced-mobile.webp` | 历史增强移动图，2000×2479，约 213 KiB；当前不作为运行底图 |
| `public/assets/maps/campus.webp` | 历史完整无字原图，4000×4958；保留用于追溯 |
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

移动图只降低像素分辨率，仍表示同一完整画布。视口通过相机变换展示其中一部分，不能用视口裁图重新计算 UV。地标数据集中在 `src/data.ts`。当前前端已经通过原包的无依赖 SDK 启用 WGS84 真实定位映射，详见 [REAL-LOCATION.md](REAL-LOCATION.md)。

`metadata.json` 内的 `image.url` 与 `fallback_url` 保留原包路径，不是当前前端运行时路径；实际请求由 `MapScene.tsx` 指向上表中的文件。其源哈希用于追溯原图，不应被解释为增强图的哈希。

增强图使用 `scripts/map-enhance.ps1` 调整配色、绘制俯视树冠与硬边阴影，保留建筑、道路与湖岸几何。树冠是装饰分布，不是现实树木清点或精确定位数据。维护流程如下：

1. 在实际应用目录 `apps/liyun-explorer` 运行 `pwsh -File scripts/map-enhance.ps1`；这仅用于主动维护，不是启动前置。
2. 用 Chrome 打开并完整渲染 `scripts/map-render.html`，画幅为 2800×3471；检查草地蒙版中的树冠确实显示。
3. 将完整画幅编码成 4000×4958 的桌面 WebP 和 2000×2479 的移动 WebP，再复核地标落点。不要裁切画布。

该辅助脚本只生成增强 SVG，不自动启动浏览器。现有脚本明确记录：ImageMagick 直接渲染此 SVG 会丢失蒙版树冠层，因此地图栅格化采用浏览器渲染后的完整图像。

## 用户提供的 BGM

原始音频来自迁移前的外部 `BGM/`。当前仓库不含这个输入目录，不假定 `../BGM` 存在。重建必须通过 `-SourceDir` 指向你已确认的原始素材目录；没有推断歌名、作者或公开授权，历史文件名与时长记录如下：

| 曲目 ID / 设置显示 | 原始文件 | 时长（秒） | 运行时资源 |
| --- | --- | ---: | --- |
| 0 / 校园配乐 · 壹 | `BGM/bgm1.opus` | 216.382 | `bgm1.opus`、`bgm1.mp3` |
| 1 / 校园配乐 · 贰 | `BGM/bgm2.opus` | 114.786 | `bgm2.opus`、`bgm2.mp3` |
| 2 / 校园配乐 · 叁 | `BGM/bgm3.opus` | 108.209 | `bgm3.opus`、`bgm3.mp3` |

运行时文件均在 `public/assets/audio/`，时长与转换记录见同目录 `manifest.json`。Opus 从用户文件复制，MP3 由 FFmpeg `libmp3lame -q:a 4` 生成并移除原元数据。重新准备音频可运行：

```powershell
pwsh -File scripts/audio-assets.ps1 -SourceDir "X:\实际原始BGM目录" -CheckOnly
# 确认全部预检成功后，去掉 -CheckOnly 才复制/转换项目资源
```

脚本先检查 SourceDir、全部三份非空 Opus、FFmpeg 与 libmp3lame，并解码预检每一份源文件；全通过后才在临时目录生成全部六个输出，成功后才替换项目文件。`-CheckOnly` 不写项目文件。转换失败不覆盖现有素材；复制提交阶段并非多文件原子事务，操作前仍应保留版本备份。更换源音频后要核对运行时 manifest 的时长/来源并更新素材哈希，脚本不伪造时长记录。播放器优先尝试 Opus；浏览器不支持或解码失败时回退 MP3。音乐循环播放，页面入场手势启动；只有一个背景音乐元素。切曲、音量、静音与页面隐藏由 `useAudio` 管理。发现提示音通过 Web Audio 正弦振荡器生成，没有额外采样音效文件。用户提供音频的所有权与再分发权未独立核验；当前交付范围为本地使用。

## 字体

`npm run build` 在 Vite 后执行 `scripts/trim-dist.mjs`，从生成的 `dist/` 剔除源 TTF 与历史地图副本，保留源码资产、当前冻结标定 WebP/PNG、三份WOFF2与各自许可。2026-11-03 已按菜单、设置、区域、标定与演出的运行时文案重建子集；[cmap检查](../../../qa/ui-implementation-20261103/font-coverage.json)覆盖946个非空白字符，联合字体缺字数0。字体覆盖范围不包含任意未来用户输入。

| 字体 | 来源与用途 | 2026-11-03 运行时字节 | 许可文件 |
| --- | --- | --- | --- |
| Noto Serif SC | 本机 `C:/Windows/Fonts/NotoSerifSC-VF.ttf`；正文、数值、菜单 | `NotoSerifSC-UI.woff2`，357,528 字节 | `NotoSerifSC-OFL.txt` |
| Ma Shan Zheng | 工程保留 `MaShanZheng-Regular.ttf`；品牌与书法标题 | `MaShanZheng-UI.woff2`，357,572 字节 | `MaShanZheng-OFL.txt` |
| Liyun Symbols | 本机DejaVu Sans的8个界面符号子集，重命名字体族；补几何/方向字符 | `LiyunSymbols-UI.woff2`，1,036 字节 | `DejaVu-LICENSE.txt`（Bitstream Vera / Arev） |

旧版两份子集字节分别为327,384 / 316,300；它们是2026-11-02历史值，不能作为当前字体预算。

文件均位于 `public/assets/fonts/`。Noto和MaShan许可声明SIL Open Font License 1.1；Liyun Symbols另保留源字体嵌入许可。关于页面可分别查看三份许可。CSS使用本地WOFF2子集，符号face限定unicode-range，不发起在线字体请求。

许可文本同样参与 `docs/asset-manifest.json` 的字节数和 SHA-256 校验；`.gitattributes` 固定这两份文件使用 LF，避免 Windows/Linux 检出换行不同造成误报。素材有意变更后先审核，再运行 `node scripts/asset-manifest.mjs` 更新清单，并用 `--check` 复核。

`scripts/collect-font-text.mjs`通过TypeScript AST采集`src/`中的运行时字符串、JSX、模板字符串、JSON值及CSS content；包括`.mjs`运行时错误文案，排除测试、声明与注释。`fonts-build.ps1`据此生成`fonts-characters.txt`并调用fontTools的`pyftsubset`。新增中文文案后运行：

```powershell
pwsh -File scripts/fonts-build.ps1 -SerifSource "C:/Windows/Fonts/NotoSerifSC-VF.ttf" -CheckOnly
# 临时目录中的两份子集都成功后，去掉 -CheckOnly 才写入工程
```

需要`pyftsubset`与Brotli支持；可用`-SerifSource` / `-BrushSource`显式指定源字体。脚本先验证输入、读取源码，再暂存两份WOFF2；子集失败不替换工程，`-CheckOnly`仅验证暂存结果并清理。符号补集可另传`-SymbolsSource`，由`scripts/build-symbol-font.py`生成并复制嵌入许可；没有此参数时保留已有符号字体。最终复制不是多文件原子事务，脚本不自行安装依赖。若引入新动态内容，须扩展字符范围或提供相应字体策略。

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

历史 Scenery / Ornaments 矢量构件与本地 paintings / art 前景继续按实际引用使用；本轮另有上表明确列出的 ImageGen hero 与墨纹，不应再笼统描述为“运行界面不依赖 ImageGen 位图”。用户参考图 / 视频只用于布局、色块、剪纸与交互语汇，冻结运行地图仍来自标定包原图。

所有新增构件遵循利落剪影、平涂色块、分级阴影、玉绿与奶油金。后续替换图像时保持透明边界、图层位置及中央地图可读区域，并记录新来源。

## 素材哈希校验

2026-10-29 活动页复用团队已有的 `paintings/waterbirds.webp`、`north-lake.webp` 和 `library.webp`，新增 `public/assets/activity/` 独立位图：柔焦环境、透明银杏枝、旅行手札和四枚奖励。关键资产使用 ImageGen，UI文字与命中区保持DOM；小叶/线饰可用矢量。提示词、图像尺寸、透明度、来源和限制分别记录在 [activity/asset-manifest.json](activity/asset-manifest.json) 与 [activity/reward-assets.json](activity/reward-assets.json)。本轮补字沿用现有公开字体，最终cmap检查见 [activity/font-coverage.json](activity/font-coverage.json)，未修改原TTF或OFL许可。上面的历史场景构件说明不作为活动页素材来源。

从仓库根执行 `node apps/liyun-explorer/scripts/asset-manifest.mjs --check`，只比较当前素材与已提交清单，不改文件。脚本通过 import.meta.url 定位应用根，不受执行 cwd 影响；主动更新素材后去掉 --check 才重建 [清单](asset-manifest.json)。文件缺失、符号链接或哈希差异都会失败，不把异常当作通过。
