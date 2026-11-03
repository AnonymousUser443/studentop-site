# 动效验收与口径

Framer负责HUD/抽屉/设置/Modal进入退场，GSAP负责区域墨散与Cinematic内部，p5负责Canvas；没有两引擎写同一对象transform。

| 行为 | 已验实现 | 证据 |
| --- | --- | --- |
| 抽屉与设置 | 受控退场、实际触发焦点、Select/确认Esc层级、hover/press/selected扫光 | menu-settings/README.md、control-states/README.md |
| 区域墨散 | low0.32s淡出，high0.9s/ultra1.4s径向位移墨散；减少动态立即收敛 | world-cinematic/final/results.json、poc/ |
| 演出 | normal5.2s/quick2.4s/reduced1s，最后视觉状态等继续，点击/Esc/Space跳过不改存档 | world-cinematic/final/results.json |
| 系统与游戏偏好 | 两者取或，不将系统投影反写个人配置；减少闪光收敛环光/环境/扫光 | 单测、world-cinematic和menu-settings记录 |
| 性能降级 | 连续双有效窗(5s/30s)，暂停清空，关闭零采样，只播报一次 | auto-degrade/results.json |

PoC视频来自真实Page.screencast绘制帧与原始时间戳，VFR编码，无生成插帧、不含声音；它不是手机FPS测量。视频在world-cinematic/poc/，纹理与SVG对照见world-cinematic/final/region-pixels/README.md。
