# 校园标定工坊 · 团队作者指南

本工具用于把游戏外边界、分区和打卡候选整理成可审查的 JSON。默认数据是 **recommended 推荐初稿，尚未现场确认**。网页内的编辑不会直接改游戏，不读取设备 GPS，不上传位置，不修改普通探索存档。

## 打开工具

在 `apps/liyun-explorer` 运行 `npm run dev`，访问 `http://127.0.0.1:5174/?tool=calibration`。设置页的“校园标定工坊”入口可打开同一工具；`/calibrate.html` 会跳到该路由。团队有其他本地端口时，只替换端口。

网页通过React懒加载，**仅本地开发环境可用**。`scripts/region-author.html`为离线说明入口。完整编辑器、样式和`calibrate.html`包装页不会进入生产dist，正式设置页不提供作者按钮；生产误入工具URL只显示本地入口提示，并保持普通存档/会话隔离。团队运行`npm run dev`后可使用全部编辑、校验、导出功能，生产包仍使用经审查的区域与打卡配置。

## 推荐数据的含义

- `gameBoundary` 是游戏内容可覆盖的范围。初稿参考无字主图的校园主区轮廓，覆盖现有 8 个地标，不包含主图右侧的独立建筑图块；它不是校园行政边界或实测围墙。
- 8 个分区按主图道路与现有地标锚点划为推荐轮廓，初稿共享边界，铺满推荐游戏范围。团队可以现场重新分段，原有地标必须保留在对应分区中。
- `support_polygon_uv` / 蓝色虚线只表示定位模型的采样覆盖。现有 8 个参考锚点中只有北湖、综合教学大楼在该凸包内；它不能替代游戏外边界。
- 初稿的所有打卡中心和半径都保留 `src/data.ts` 当前原值，没有通过移动原有地标 UV 迁就分区。真理之塔仍标记为虚拟信标，不宣称已经测得实体建筑位置。
- `recommended`、`draft`、`confirmed` 分别表示项目推荐、正在编辑、团队已明确现场确认。结构和几何校验通过不会自动获得 `confirmed`。

## 调整外边界和分区

桌面左侧选择外边界或分区；小屏使用地图上方的“编辑对象”。选择模式可以拖动顶点，也可以在右侧输入 U / V（均为 `0–1`）。顶点序号按钮将画面移到该点；聚焦地图顶点后可用方向键微调，按住 Shift 加速，Delete 删除顶点。多边形至少需要三个顶点，首点无需重复闭合。

“重新绘制”会保留旧轮廓供参考。依次点击或触摸放置新顶点，使用“退一点”撤回刚放置的点；按“完成轮廓”或 Enter 才替换原轮廓。绘制中仍可拖动空白地图或双指缩放。底部浮动操作条所在位置不能放点，可以先移动地图再点击目标位置。Esc 取消本次绘制。

滚轮 / 双指缩放，拖动空白平移；地图聚焦后方向键平移，`+ / -` 缩放，`0` 显示全图。“居中所选”适合 844 / 667 横屏精修。`V / D / P` 切换选择、绘制、平移，`Ctrl+Z / Ctrl+Y` 撤销和重做。一段连续拖动是一次撤销操作；绘制中的 Ctrl+Z 先退一个新点。

工具支持凹多边形，不以凸包同侧判断代替包含。会检测 UV 越界、零长边、重复闭合、自交、相邻边折返、面积退化、分区越过外边界、原地标未被覆盖、打卡候选未落在所属分区等问题。右侧错误可点击，跳转到相关分区 / 点位并突出顶点。可安全打开的自交草稿可以导入后修复；地图版本、ID 或数据结构不合法的文件会直接拒绝。

## 两种打卡中心来源

| 模式 | 操作和保存内容 | 应用到打卡判定的坐标来源 |
| --- | --- | --- |
| UV / 模型候选 | 输入 U / V 或拖动中心，保存 `centerUv`；SDK 导出 WGS84 候选及 support 来源 | 现场确认后，导入脚本用冻结 SDK 从该 UV 重新计算候选 WGS84 |
| 手填现场 WGS84 | 展开“填写现场 WGS84 坐标”，填写**纬度在前、经度在后**并点击“按 WGS84 放置候选”；保存 `wgs84: {latitude, longitude, source: 'manual-field'}`，同步生成地图 UV | 现场确认后，优先使用这组明确手填的 WGS84；导入脚本验证它与 UV 的模型映射一致 |

只接受 WGS84，不接受 GCJ-02 / 火星坐标或 BD-09。工具不会从当前设备自动取得位置；团队应自行在安全、可达的室外位置核对中心和范围。模型换算值保留 `independent_accuracy_verified: false`，即使在采样覆盖内，也不等于独立实测精度。

导入脚本不信任导出文件附带的 `candidateCoordinates` 或说明文字来决定实际坐标。UV 模式会用冻结 SDK 重新推算；手填模式必须有 `wgs84.source: 'manual-field'`、合法 WGS84 值和一致的地图映射。候选来源说明不会绕过现场确认要求。

**拖动或重新输入 UV 中心会清除旧的手填 WGS84 绑定**，避免画面中心已经改变、实际打卡却使用旧经纬度。仅调整半径会保留手填坐标。撤销会同时还原中心及来源。

半径可以输入数值、使用滑条或拖动金色方形手柄，范围为 `5–200` 米。预览先在 WGS84 上采样米制圆，再经过现有定位模型映射到地图；它会受局部缩放和外推影响，可能不圆。**不是直接把 UV 圆当精确米圈，也不是对现场定位精度的保证。** 手填 WGS84 模式以手填坐标为范围中心；UV 模式以 SDK 候选为中心，两者与最终覆盖配置的来源一致。

## 保存、审查和明确确认

“存本机”使用独立键 `liyun.calibration.campus-v04-eaa124716c51375f.v1`。刷新后从工具栏 `⋯ → 恢复本机草稿` 恢复；它不与游戏云存档同步。浏览器禁止存储时会给出反馈，此时可下载 JSON。工具栏 `⋯` 和桌面侧栏都提供恢复推荐，两次点击后替换当前草稿，仍可撤销。

“导出审查稿”下载含 `gameBoundary / regions / checkInPoints`、模型候选来源和审查说明的 JSON。推荐稿、未确认稿和存在可修复几何问题的审查稿均可交团队讨论；它们不能被 `--apply` 应用。导出不会改游戏。

全部问题解决并完成现场核对后，在右侧填写核对人和审查备注，再勾选确认声明。该声明覆盖外边界、全部分区、打卡中心、范围及可达性。修改几何、UV、半径或手填 WGS84 后，工具会撤销确认；需要重新核对。该确认由团队负责，不会由工具推断。

## CLI 审查与应用

以下命令在 `apps/liyun-explorer` 执行：

```powershell
# 验证当前项目分区，报告原锚点覆盖、模型来源与定位凸包关系
node scripts/verify-regions.mjs

# 验证导出的文档；需要确认稿时显式加 --require-confirmed
node scripts/verify-regions.mjs C:/team/review.json --require-confirmed

# 默认 dry-run：报告具体目标、分区变化、中心 / 半径变化，不写文件
node scripts/import-calibration.mjs C:/team/review.json

# 经团队检查 JSON / diff 后，才显式应用完整确认稿
node scripts/import-calibration.mjs C:/team/review.json --apply

# 应用后重新核对地图冻结文件并构建
node scripts/verify-calibrated-map.mjs
npm test
npm run build
```

导入脚本严格绑定 `map_id: campus-v04-eaa124716c51375f` 和固定 ID：`wencui / beihu / library / teaching / wenbo / sports / tower / park`。ID 不重命名，方便独立存档白名单保持稳定。它验证完整 8 分区 / 8 点位、一般多边形几何、原锚点覆盖、点位所属分区、合法半径、解锁引用、插画本地路径和手填 WGS84 绑定。应用还要求文档、外边界、全部分区及点位都是确认态，确认人和时间有效，所有点位都已取消“仍需现场确认”。文件上限为 1 MB。

`--apply` 只写两份可审查的独立配置：

- `src/content/regions.json`：分区、故事、插画路径与作者确认信息。
- `src/content/checkin-overrides.json`：已启用且确认的打卡中心 WGS84 / 半径覆盖。

默认覆盖配置 `enabled: false` 且无点位，因此推荐稿和网页草稿不会影响实际打卡。游戏通过 `getConfirmedCheckInOverride(id)` 消费明确应用的中心与半径，显示 pin 可以使用确认的 `centerUv` 与实际打卡中心对齐；`data.ts` 的公共锚点仍保留原值，旧存档锚点由显示映射兼容。确认配置变更后需重新构建 / 发布，网页草稿不会热改其他人的游戏。

脚本先完整验证并生成候选输出，再在固定内容目录暂存并替换；失败时还原两份配置。它不会写 `data.ts`，不会修改下面六份冻结文件，也不会将候选点重新用于拟合定位模型：

```text
src/location/vendor/coordinates.mjs
src/location/vendor/model-transform.mjs
src/location/data/map.json
src/location/data/selected_model.json
public/assets/maps/calibrated/campus_no_labels.webp
public/assets/maps/calibrated/campus_no_labels.png
```

## 内容和素材契约

`src/content/regions.ts` 导出 `REGION_DOCUMENT / GAME_BOUNDARY / REGIONS / REGION_IDS / isRegionId / getRegion / regionsForLandmark / cleanRegionIds / getConfirmedCheckInOverride`。未知 ID 查询返回 `undefined` / 空数组；持久化层应清洗 ID，不能从打卡记录强制重算覆盖独立分区解锁状态。

每个分区包含 `map_id / polygon: {u,v}[] / maskImage / unlock / revealOrder / subtitle / story / art`。`maskImage` 为本项目 `/assets/` 路径或 `null`，可供渲染层优先使用；polygon 是几何兜底。`unlock` 关联原地标，`revealOrder` 唯一。故事有 `chapter / title / body / verse`；插画预留 `/assets/landmarks/<id>/hero.webp`，并带 `alt / palette`。插画缺失时由游戏渲染层提供程序图形兜底，不能因此中断编辑工具。

## 验证证据与范围

- `src/content/geometry.test.ts / regions.test.ts` 和 `src/calibration/model.test.ts`：17 项已通过，覆盖凹口、边界点、相交 / 折返、穿越凹父边界、推荐锚点、ID / 来源约束、确认撤销和不完整审查元数据的拒绝。`src/content/checkin-overrides.test.ts` 另有 4 项覆盖消费 API 的明确确认、地图 / 值域 / 来源状态拒绝规则。
- `node src/calibration/cli-qa.mjs`：10 场景已通过。应用测试在自建临时迷你项目中使用合成确认稿，生产内容及六份冻结输入始终字节不变。记录为 `qa/cli-results.json`。Windows 限制沙箱内替换文件可能得到 EPERM；此轮在同一临时副本中获准沙箱外验证后通过，没有绕过确认规则。
- `node src/calibration/browser-qa.cjs`：在仓库 `qa/lib.js` 创建的临时 Edge 档案中执行本地 UI 验收，结果与截图位于 `src/calibration/qa/`。默认目标为本轮集成服务 `5176`；常规 `5174` 可设置 `CALIBRATION_QA_URL`。输入来自 CDP 鼠标、键盘、模拟双指与文件输入，包含存储隔离哨兵。它不是手机真机触摸、现场 GPS 或现场边界验证。

OpenCLI 本轮在限制沙箱中报告浏览器桥未连接；没有修改其安装或用户档案。浏览器验证改用已有的隔离 Edge QA 路径。最终以 `qa/browser-results.json` 中的实际通过项和截图为准，不将未执行的人工现场确认记为完成。
