# 理韵寻踪 · V2全量实施与本地验收

2026-11-03；仓库基线HEAD `14a087b`，最初重构提交`05b7e32`。本轮开发和本地自动化验收已收口：按用户追加要求实现派蒙式左抽屉、团队手动标定、推荐八区/八点、ImageGen概念占位和水墨遮罩；未发布生产。原54项中51项完成，3项含物理设备测试，由用户明确安排“稍后由队员按验收表实测”，保持[TODO](../../apps/liyun-explorer/TODO.md)未勾状态，不能冒称手机或现场已测。

## 交付内容

App拆为职责明确的控制器与四store，存档/账户/设置真实闭环；菜单与设置按两段本地参考视频提取进退场、悬停、分类选中与扫光，保留右侧世界。p5/GSAP、页面和HUD正文独立延迟载入。探索和分区先提交状态，再演出，跳过不会撤销记录。

推荐外边界与8分区覆盖全部原锚点；它们是游戏内容初稿，不是校园行政边界。标定工坊支持UV轮廓、打卡中心/米制范围、现场WGS84、撤销重做、草稿、几何校验和审查导出。默认实际打卡覆盖关闭，团队确认后才能显式CLI应用。六份冻结地图/模型/SDK与原公共UV不变。

8张768×432地标主插画与1024²云纹已全部生成，合计637,808B；均标明概念占位，真理之塔明确为虚构信标。没有重复ImageGen请求。高档优先生成纹理，纯SVG云纹备用，低档纯纸。遮罩增加联合纸底，修复相邻区域约1px抗锯齿透底缝。

## 当前有效证据

每行只证明所列范围，数量有重叠，不相加成全产品测试总数。

| 范围 | 结果 | 有效入口 |
| --- | --- | --- |
| P0纯清场隔离对照 | 原始HUD尾部及同次删除的地图选择器恢复/移除，六档×四态24对PNG字节完全相同；149个历史选择器无匹配 | [结果](pure-cleanup/results.json) |
| 菜单、八类设置、焦点、Esc、全屏Portal | 114通过 | [菜单说明](menu-settings/README.md) |
| 按住时44px命中区 | 36通过 | [结果](menu-settings/press-hitareas/results.json) |
| HUD图鉴/地标懒载与六档布局 | 45通过 | [说明](hud-panels/README.md) |
| 当前HUD锚点/地图标签交叠 | 六档×定位卡展开/收拢，13通过；可见标签零冲突且隐藏≤2 | [结果](hud-layouts/results.json) |
| 主应用/会话/云写故障注入 | 37通过 | [说明](app-runtime/README.md) |
| 团队标定编辑/导入/隔离 | 33通过 | [最终结果](../../apps/liyun-explorer/src/calibration/qa/final/browser-results.json) |
| CLI确认/拒绝/原子导入 | 10场景通过，只用临时迷你项目 | [结果](../../apps/liyun-explorer/src/calibration/qa/cli-results.json) |
| 地图质量、演出、队列、降级与六档 | 最终51通过；普通动态/系统减少动态明确分开 | [说明](world-cinematic/README.md)、[结果](world-cinematic/final/results.json) |
| 八区内部、共享边、解锁/重锁、相机 | 修复后103通过 | [范围与A/B](world-cinematic/final/region-pixels/README.md) |
| 生产音频/音量/界面反馈 | 19通过，三曲真实解码、打卡解锁图及AudioContext波形；显式模拟GPS | [结果](audio/results.json) |
| 生产纯键盘完整旅程 | 17通过，GPS明确模拟；生产工具URL不载入编辑器、保持隔离并提供44px本地链接 | [结果](keyboard-production/results.json) |
| 自动降级真实墙钟故障注入 | 10通过，首5s/后30s双有效窗 | [结果](auto-degrade/results.json) |
| 20控件反馈与非零安全区 | 42唯一断言通过；8页面组合26目标、8次小屏按住，最短边44px | [说明](control-states/README.md) |
| 主题与对比度 | 旧11帧149文字/70边界，新53帧1380文字/84halo/645控件通过；两批computed纯色联合77≤80 | [方法与限制](theme/README.md) |
| 最终单测/服务端/字体/构建/不变量 | 14门禁通过；19文件153单测，服务端10+9，0缺字 | [结果](checks.json)、[不变量](invariants.json) |

汇总文件：[范围索引](evidence-index.json)、[布局](measure.json)、[颜色与对比度](contrast.json)、[三档性能](perf.json)、[分区](regions-check.json)、[动效](motion.md)、[逐阶段要求与人工移交](requirements.json)。最终dist为20,908,923B（19.9403028MiB，62文件），既有20MiB门禁余62,597B；首屏静态JS图逐文件gzip合计214,068B，低于600,000B，且不含p5/GSAP。p5大动态chunk提示仍保留，不改门禁掩盖。

## 六档四态截图

| 视口 | 地图 | 左抽屉 | 设置 | 全屏演出 |
| --- | --- | --- | --- | --- |
| 1920×1080 | [图](world-cinematic/final/shots/map-1920x1080.png) | [图](menu-settings/verified-focus-fullscreen-2/shots/menu-1920x1080.png) | [图](menu-settings/verified-focus-fullscreen-2/shots/settings-1920x1080.png) | [图](world-cinematic/final/shots/cinematic-1920x1080.png) |
| 1440×900 | [图](world-cinematic/final/shots/map-1440x900.png) | [图](menu-settings/verified-focus-fullscreen-2/shots/menu-1440x900.png) | [图](menu-settings/verified-focus-fullscreen-2/shots/settings-1440x900.png) | [图](world-cinematic/final/shots/cinematic-1440x900.png) |
| 1280×720 | [图](world-cinematic/final/shots/map-1280x720.png) | [图](menu-settings/verified-focus-fullscreen-2/shots/menu-1280x720.png) | [图](menu-settings/verified-focus-fullscreen-2/shots/settings-1280x720.png) | [图](world-cinematic/final/shots/cinematic-1280x720.png) |
| 1024×600 | [图](world-cinematic/final/shots/map-1024x600.png) | [图](menu-settings/verified-focus-fullscreen-2/shots/menu-1024x600.png) | [图](menu-settings/verified-focus-fullscreen-2/shots/settings-1024x600.png) | [图](world-cinematic/final/shots/cinematic-1024x600.png) |
| 844×390 | [图](world-cinematic/final/shots/map-844x390.png) | [图](menu-settings/verified-focus-fullscreen-2/shots/menu-844x390.png) | [图](menu-settings/verified-focus-fullscreen-2/shots/settings-844x390.png) | [图](world-cinematic/final/shots/cinematic-844x390.png) |
| 667×375 | [图](world-cinematic/final/shots/map-667x375.png) | [图](menu-settings/verified-focus-fullscreen-2/shots/menu-667x375.png) | [图](menu-settings/verified-focus-fullscreen-2/shots/settings-667x375.png) | [图](world-cinematic/final/shots/cinematic-667x375.png) |

## PoC、素材与参考

- 真实渲染帧短片：[低档淡出](world-cinematic/poc/ink-reveal-low-844x390.mp4)、[高档墨散](world-cinematic/poc/ink-reveal-high-844x390.mp4)。保留绘制时间戳、原始JPEG与[VFR编码记录](world-cinematic/poc/results.json)，不含声音、不做生成插帧，不以视频帧率充当手机性能。
- [ImageGen实际尺寸、字节与来源](assets/index.json)，[字体cmap覆盖](font-coverage.json)。生成请求尺寸与实际像素分开记录。
- [两段参考视频的原尺寸crop](menu-settings/reference/)，[接入说明](menu-settings/README.md)。参考只用于布局和交互，运行时不是原神界面的截图贴片。

## 采用的验收口径

最新用户要求优先于旧草案：左抽屉替代全屏；定位采样凸包不作为校园边界；自动降级采用连续两个有效窗口，解决原§6.3.1与§12.4的时间冲突；演出5.2秒为视觉时间轴，末帧等待手动继续。20MiB沿用工程既有字节门禁，报告精确字节。

源码hex与computed纯色数量分别统计；图片/渐变展开像素不纳入computed数。对比度为真实截图背景P05抽样，正常文字4.5、大字/控件标识3，禁用/inert/隐藏/严重裁切排除，SVG halo独立检查；不是所有像素/设备穷举。主题存在有意颜色变化，[差分](theme/pixel-differences.json)完整保留。P0另用同一最终App、相机和暂停状态，恢复`e15901d`中560行起完整HUD规则和`05b7e32`删除的地图规则（15,869B），再移除；24对完整PNG及其SHA-256相同。该对照隔离“纯删除”，不把全部重画误称为零变化。

## 仍需人工确认

[FIELD-ACCEPTANCE.md](FIELD-ACCEPTANCE.md)是待填表，**未执行、未勾完成**：实际边界/点位/可达范围、手机定位/朝向/触摸/安全区/三档帧率及设备实听。桌面临时Edge、CDP合成输入和模拟GPS不代替上述现场测试。用户原本要求团队手动标定，工具与审查流程已准备好。

用户本轮已明确选择“稍后由队员按验收表实测”。该安排作为交付后的团队工作保留，不把实测待办重写成软件缺口或通过结论。

生产预览为`http://127.0.0.1:4174/`，完整隔离工坊为开发服务`http://127.0.0.1:5174/?tool=calibration`。作者编辑器、样式、包装页不进入生产包，正式设置页没有作者入口；生产误入工具URL只显示本地说明，保持普通存档隔离。开发5174、预览4174留给用户审阅；QA服务5176结束后关闭。均为回环，无隧道。一次性五小时续跑已触发并删除，没有新周期任务，未发布或外发消息。
