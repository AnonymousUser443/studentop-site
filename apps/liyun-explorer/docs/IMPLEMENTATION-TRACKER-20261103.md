# 全量重构实施跟踪 · 2026-11-03

## 当前目标与最新决策

**后续在线版本（最新）**：用户要求在线多人自动同步、动态景点/图文照片、中键平移、实时边界和覆盖整理，并明确选择“草稿自动保存，预览确认后再发布”。本轮仅主代理执行；用户随后接手多人端测试，授权直接提交/推送Git远端及部署树莓派。进度见[在线工坊实施记录](COLLABORATIVE-AUTHORING-20261103.md)，用它覆盖旧的本地作者工具限制。原重构goal已完成，不重新启动，也不新增定时续跑。

用户已授权全自动实现 TODO.md 的全部要求，使用子代理并行；本文件是续跑入口，不能仅按旧计划的未更新状态重新开始。

- 设计依据：UI-REFACTOR-PLAN-V2.md + TODO.md；**最新用户要求优先**。
- 菜单采用原神派蒙式**左侧抽屉**，保留右侧游戏世界，替换旧全屏菜单方向。按 `.tmp/ui-audit/` 两段视频提取元件比例、悬停、选中、进退场；项目风格为玉绿、宣纸、金线。
- 推荐游戏边界、8 个分区和点位/范围初稿，与定位采样 control hull 分开。团队在交互标定工作台手动确认、校验、导出；推荐数据不得冒称现场实测。
- ImageGen 生成点位概念占位插画及云纹遮罩，生成图明确标注，保留程序化兜底。
- 保持现有底图、UV、WGS84 标定文件和真实打卡校验；已确认的内容覆盖必须走显式导入与校验，不悄悄修改冻结标定。
- 原开发阶段限本地；所有者随后明确授权正式发布，已于2026-11-03 20:08完成，见[发布回执](LIYUN-UI-RELEASE-20261103.md)。该授权不扩展为后续自动发布权限。

## 持续目标与一次性续跑

一次性续跑`automation-2`已于北京时间 **2026-11-03 05:23:25** 触发并随后删除，没有新增周期任务。额度中断后用户恢复工作；本轮开发、本地验收和交付审计已完成，goal已设为 **complete**。最终检查点：**2026-11-03 17:43（Asia/Shanghai）**。用户已明确选择“稍后由队员按验收表实测”，真机/现场事项移交给团队并保持未执行标记。目标累计有效执行约2小时3分，额度等待不计入该执行时长。

恢复时先读 goal、此文档与 TODO.md，再检查 git 状态、子代理状态和真实文件。若目标已完成，只核实记录，不重复生成图像或修改。

## 并行边界

| 执行者 | 独占职责 | 当前状态 |
| --- | --- | --- |
| root | 主应用集成、地图遮罩/演出、ImageGen、最终构建与验收文档 | 已完成14构建门禁、生产键盘17/音频19、降级10、HUD13与世界51；工坊33在官方开发端口复验通过，编辑器不进dist |
| settings_contracts | 设置白名单、spec/store、自动降级、state/account、server测试 | 已完成；App控制器也已拆分 |
| menu_settings_ui | 菜单、八类设置、参考crop、HUD面板与交接文档 | 已完成114流程+36按下+45面板；20控件/安全区/按住42唯一断言通过，浏览器关闭 |
| regions_calibration | content、作者工具、导入、区域与演出浏览器验收 | 已完成标定与103项有限像素；场景由root收口至最终51，已交接 |
| app_final_verification | 主应用故障注入、遗留主题令牌、真实背景对比度 | 已完成37应用流程；旧11帧149文字/70边界，新53帧1380文字/84halo/645控件通过；computed联合77，源码hex51，浏览器关闭 |

## 已锁定接口

- GameSettings 新增 `baseQualityPreset`、`dragSensitivity`、`zoomLimit`、`doubleZoom`、`messageDuration`（秒）、`showCinematic`、`redDot`；现有 `hudScale` 保持。
- `useAutoDegrade(paused, onDegrade?)`，回调 `{from,to,originalPreset}`；父 App 传完整暂停条件。
- 菜单和设置使用常驻 `open?: boolean` 切换、内部 AnimatePresence + Dialog，关闭有退场；设置可传 `initialCategory`。
- SettingsScreen 接 `account/onLoginPrompt/onLogout/onResetProgress/onClearLocalSave/onExportSave/isFullscreen/onFullscreen/onOpenCalibration`；数据操作必须通过应用回调，不能直接删键+reload。
- `content/regions.ts` 导出 REGIONS / REGION_IDS / isRegionId / getRegion / regionsForLandmark / GAME_BOUNDARY / REGION_DOCUMENT；ID保持当前8个。
- `CalibrationScreen({onClose})` 懒加载，`?tool=calibration` 直达；草稿编辑与正式游戏数据分离。
- 地标占位图目标 `/assets/landmarks/<id>/hero.webp`；水墨纹理目标 `/assets/regions/ink-cloud.webp`。

## 证据与待办

- 基线：git HEAD `14a087b`，上一轮审查记录位于 `qa/ui-refactor-audit-20261102/`。
- 新证据：`qa/ui-implementation-20261103/`；参考contact sheet已经提取，子代理另存原分辨率状态crop。
- 开始前已有与校园网相关的用户改动，保持不动；TODO与前轮QA目录尚未提交，不能当成他人残留删除。
- 生成记录、已落盘路径、实际像素和压缩尺寸必须写在后续资产记录，避免重试重复计费。
- 当前测试基线：前端93项、存储9项、HTTP9项；本轮新实现完成后重新验证，不沿用基线冒充通过。

## 已完成的实际实现（恢复时不要重做）

- App 约70行组合；探索/会话/保存生命周期/路由/地图/质量/演出/消息分别有控制器与store。p5、GSAP、菜单/设置/演出/标定与图鉴面板真实懒加载，菜单等空闲预取。
- 左侧抽屉、右侧世界保留；参考两段视频已抽状态crop。菜单/设置常驻受控退场、冷启动焦点归还、Select优先Esc、Fullscreen覆盖body portals。八类设置接线、账户、二次确认、HUD缩放、真实控制值均已完成。
- 保存v3迁移、共享白名单、独立unlockedRegionIds、内存导出、保留设置的探索重置、清本机与退出、串行云PUT、GET失败禁止覆盖云端、迟到GET不覆盖重置，均已实现并有测试。
- 自动降级使用连续两个有效窗口（首5s、后30s）；暂停/hidden丢弃窗口，关闭零采样，保留多次降级前原档，一次播报。quality字段真实消费，FIFO消息、UI反馈音已接。
- 推荐游戏边界/八区/八点初稿、通用凹多边形/自交验证、reviewed覆盖契约已完成。推荐均待人工确认；冻结六份地图/标定文件未改。
- `?tool=calibration`隔离普通存档/令牌/GPS；团队可编辑UV边界/分区/点位半径/WGS84、撤销重做、校验、草稿、导入导出。CLI默认dry-run，显式review后原子导入固定目标。见 `src/calibration/AUTHORING.md`。
- RegionVeil八块不透明纸云、纹理/程序云对比、GSAP径向墨散、低档淡出/减少动态立即结束、独立卸载、marker在其上。Cinematic两型内容、5.2/2.4/1s、占位hero/程序SVG、队列与跳过已接。
- 演出时间轴结束后保留可读终态，用户继续/点击/Esc/Space返回；这符合原任务书“靠继续才停”，不是自动关闭。测试已按此真实语义修正。
- ImageGen **9次均成功且全部落盘，严禁重复请求**：8个`hero.webp`各768×432，云纹1024²；总637,808B。源图/提示词/实际尺寸/SHA在`qa/ui-implementation-20261103/assets/`。均明确概念占位，真理塔为虚构游戏地标。
- 字体已按运行时文案子集：NotoSerifSC、MaShan、8符号LiyunSymbols；946个非空白字符覆盖0缺字，含DejaVu许可。最终dist 20,908,923B（19.9403028MiB，62文件），20MiB门禁余62,597B；首屏静态JS图gzip214,068B，不含p5/GSAP。p5动态大chunk提示保留。
- 遗留颜色已归令牌，源码hex298→51（原始更早基线609）；旧页面11帧149处正常文字对真实去文字背景抽样通过，控件布局9帧新旧相同。新增界面对比度仍补验，不能把computed颜色数量当全像素颜色数。
- 新增区域像素检查发现13共享边约1px AA透底；root用同向nonzero联合纸底修复，保持原坐标/轮廓。8区24内部点、13共享边、5外边及相邻解锁重锁、实际pan/wheel对齐共103项全过。真实SVG程序云纹备用已补，A/B对照和ImageGen优先/low纯纸路线证据齐全。
- root已在4174生产预览用普通临时profile完成12项真实Audio/AudioContext+analyser反馈/播放检查、15项纯键盘全流程（GPS明确为CDP模拟）；auto-degrade真实5s/30s墙钟低帧注入10项全过。PoC低/高两段真实Page.screencast视频已录，帧时间戳/VFR编码，无生成插帧。
- 原TODO已保存到`qa/ui-refactor-audit-20261102/TODO-snapshot.md`，当前TODO保留原54项映射并实时勾选。人工待验表已创建`qa/ui-implementation-20261103/FIELD-ACCEPTANCE.md`，没有把现场内容或手机实测勾成完成。

## 当前可复核的证据

所有路径相对仓库根目录；完整汇总为`qa/ui-implementation-20261103/README.md`，结构化索引`evidence-index.json`、19个独立范围，不把重叠数量相加成全产品覆盖。

| 文件 | 已核实结果 |
| --- | --- |
| `qa/ui-implementation-20261103/menu-settings/verified-focus-fullscreen-2/results.json` | 114通过，错误0 |
| `qa/ui-implementation-20261103/menu-settings/press-hitareas/results.json` | 36通过，错误0 |
| `qa/ui-implementation-20261103/hud-panels/results.json` | 45通过，错误0 |
| `qa/ui-implementation-20261103/app-runtime/results.json` | 37通过；仅故意注入HTTP503的预期网络错误 |
| `qa/ui-implementation-20261103/world-cinematic/final/results.json` | 49通过，错误0；包括三档实际Canvas/墨散、有图无图与缩放 |
| `apps/liyun-explorer/src/calibration/qa/final/browser-results.json` | 33通过，错误0 |
| `apps/liyun-explorer/src/calibration/qa/cli-results.json` | 10个临时fixture流程通过 |
| `qa/ui-implementation-20261103/theme/after/results.json` | 11帧、149处文本通过（限定抽样范围） |
| `qa/ui-implementation-20261103/font-coverage.json` | 946个非空白运行时字符，打包字体联合覆盖0缺字 |

## 最终审计与团队下一步

- `checks.json`14项门禁通过，19文件153单测、服务端10+9、CLI10场景、内容/地图/manifest/字体/编译/体积全绿。`invariants.json`确认六冻结文件和data.ts公共锚点不变、旧testid静态签名未减少。
- P0隔离清场对照补齐：从原始git版本提取HUD死样式与已删除地图规则，在最终App六档四态恢复/移除，24对PNG字节完全相同；149个历史选择器无匹配。它和主题重画的非零像素差分分开报告，见`pure-cleanup/results.json`。
- 世界最终51项显式把普通动画no-preference与系统reduce分开；宿主系统开启reduce导致旧脚本9项不匹配，原结果保留`world-cinematic/host-reduced-20261103.json`。正常动态三档真实rAF60.12/60.14/60.03，实际Canvas帧数另报，不假称手机性能。
- 菜单安全区/按下、标定普通小字、控件边界和共享区透底问题均已修复，最终完整/定向证据保留失败历史。根代理已查看最终生成素材、桌面与小横屏演出、标定及设置截图。
- 原54项51项完成；余3项均含物理设备实测，用户明确交给队员稍后执行，见`FIELD-ACCEPTANCE.md`和`requirements.json`。推荐边界、中心、范围也由团队现场确认后导出、dry-run、显式apply；本轮不自动确认内容。
- 恢复时若目标已完成，仅核对上述记录；不得重复9次ImageGen、重新实施重构或新增周期续跑。只有新明确要求或新的真实失败才继续改源码。

## 本地服务与隔离

开发阶段记录：旧服务核实停止后重启，官方5174开发/工坊root session3607，4174生产预览root session95372，留给用户审阅；QA5176 root session22724收尾关闭。编辑器及包装页已按原任务书从dist移出，5174完整33项回归通过，生产工具URL提示/隔离/44px本地链接另增2项，键盘最终17项。当时仅本地工作。随后所有者新授权生产发布，最终版本`0a068ea850ed2b2b33c325f1`，公网8项及浏览器5项简检通过，独立生产QA浏览器已关闭；没有发布消息或提交校园网原有用户改动。真机与现场确认仍由队员执行。
