# 地图遮罩 / 全屏演出集成验收

本轮使用`qa/lib.js`创建独立临时Edge，只访问本地隔离QA。当前最终记录为 **51 / 51通过**，非预期浏览器错误0，见[final/results.json](final/results.json)与[最终截图](final/shots)。父目录results/shots是较早49项记录，不替代本次最终复验。

最终运行明确指定普通动画条件`prefers-reduced-motion:no-preference`，再独立切系统`reduce`验证渲染投影和1秒演出；两条路径都完成。此前宿主系统实际开启减少动态，旧脚本却按普通动画断言产生9个预期不匹配，保留[原记录](host-reduced-20261103.json)；没有因此修改产品去忽略系统偏好。

运行方式（仓库根目录）：

```powershell
node qa/ui-implementation-20261103/world-cinematic/browser.cjs
```

其他本地端口可通过 `WORLD_QA_URL` 指定。目标必须保持 `?qa=1`，脚本不会读取、改写普通存档，不使用真实设备 GPS。页面交互用 CDP 鼠标 / 键盘；DEV 桥仅控制预设、独立分区解锁、设置与呈现预览，没有伪造定位或跳过生产打卡判定。脚本另外调用 `discover('wencui')` 验证在没有合格位置时状态保持原样。

## 功能结果

- fog 初态 0%，8 个不透明遮罩存在；explored 稳态 37%，仅国防教育主题公园仍未解锁。
- 独立解锁北湖不增加打卡记录或探索百分比，经历 `revealing` 后物理卸载该区 `<g>`；其他 7 个保留，重新上锁可恢复遮罩。
- 北湖区域内部固定相机 / 时间的 5×5 像素均值：锁定 `[218,222,204]`，独立解锁后 `[150,190,190]`，全部解锁基准也是 `[150,190,190]`。原生 SVG 纸底为不透明，锁定时 reveal 圆半径为 0。此像素证据是一处区域内部抽样，不能当作全图每条边缘逐像素验证。
- 低 / 高 / 极致实际 Canvas 像素密度为 1 / 1.25 / 1.5，雾 / 光层 target FPS 分别为 24/30、30/45、30/60；SVG 纹理 image 数为 0 / 8 / 16。
- 单帧真实绘制方法观察：light `arc` 为 11 / 29 / 45，`fill` 为 17 / 43 / 66；实际 halo 色标 alpha 不同，验证光晕质量不是只改设置文字。观察后立即还原 Canvas 方法。
- 低档实际 opacity 淡出且 reveal 圆保持 0；高 / 极致实际 reveal 圆扩大，位移滤镜 scale 为 12 / 28。三档实际定位卡阴影不同，收集弹层 backdrop blur 为 0 / 6 / 10px，ambient 为 off / on / on。
- 有图演出显示本地 hero，缺图分区演出显示程序化 SVG 山水。缺图测试按请求 URL + requestId + `blockedReason: inspector` 精确记录一次预期拦截；没有忽略其他网络错误。
- 真实 GSAP 时间轴 normal 5.2s、quick 2.4s、reduced 1s；reduced 在 timeline-ready 后约 1061ms，文字已全部可见。演完停留在终态等待继续属于设计行为，背景画面另有持续镜头移动，不按“未自动关页”记为失败。
- Escape、Space、quick、reduced 和 FIFO 两项队列跳过前后的完整存档快照相同。关闭演出设置会清除活动演出及队列。
- 地图和分区演出均覆盖 1920×1080、1440×900、1280×720、1024×600、844×390、667×375 六档；HUD / 继续按钮无小于 44px 的命中区，没有按钮越界。故事区域允许内部滚动，未把可滚动内容判为屏幕溢出。
- 844 横屏额外验证 HUD 0.9 / 1.12：按钮达到 44px、没有越界，按钮中心 `elementFromPoint` 均命中对应按钮。
- 普通 `liyun.exploration.v1 / v2` 存档的 get / set / remove 调用为 0，设备 GPS 调用为 0。

## 844×390 性能窗口

每档关闭 autoDegrade，解除时间冻结，窗口至少 5 秒。此次渲染器为 **Intel Iris Xe / ANGLE Direct3D11**，DPR 1，页面可见。

| 档位 | rAF FPS | 中位帧间隔 | P95 | 实际 fog 帧 / 约5s | 实际 light 帧 / 约5s |
| --- | ---: | ---: | ---: | ---: | ---: |
| 低 | 60.12 | 16.7ms | 16.9ms | 100 | 151 |
| 高 | 60.14 | 16.7ms | 16.8ms | 151 | 151 |
| 极致 | 60.03 | 16.7ms | 16.8ms | 151 | 301 |

rAF 是桌面浏览器回调频率，不等于每个 Canvas 的实际绘制频率。高档 light 目标 45fps，本次实际约 30fps；低档 fog 目标 24fps，本次实际约 20fps。原始帧数与目标都保留在 JSON，未只报“约60fps”。此结果不能外推为手机帧率、真机触摸或低端 GPU 验证。

新增[103项逐区有限像素复验](final/region-pixels/README.md)覆盖8区24内部点、13共享边、5外边、相邻解锁/重锁和相机输入，替代最初仅一处北湖采样的弱证据。SVG程序云纹与ImageGen纹理对照、联合纸底修复均有实际图片。PoC短片为[低档淡出](poc/ink-reveal-low-844x390.mp4)、[高档墨散](poc/ink-reveal-high-844x390.mp4)，来自真实绘制帧及时间戳，无生成插帧。

## 主要截图

- [正常有图演出](shots/cinematic-normal-hero.png)
- [缺图 SVG 兜底](shots/cinematic-fallback.png)
- [667×375 演出](shots/cinematic-667x375.png)
- [844×390 高档地图](shots/map-844-high.png)
- [844×390 HUD 1.12](shots/hud-844-1.12.png)

推荐边界、打卡点的人工现场核对、真实设备 GPS / 朝向、手机触摸、云端发布与全图遮罩边缘穷举均不包含在本轮浏览器证据中。标定工坊自己的 33 项交互及普通存档隔离记录位于应用 `src/calibration/qa/browser-results.json`；CLI 导入确认 / 拒绝的临时副本测试位于该目录 `cli-results.json`。
