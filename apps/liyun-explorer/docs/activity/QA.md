# 活动页局部验收

开发基线为团队 PR #7 合并后的 `230f80d`。本轮验证活动菜单、地图/图鉴交接与相关降级，未重跑旧整站全流程，未登录真实账号或读取生产云存档。

后续已由所有者授权发布到生产环境，见[发布收据说明](../../../../docs/ACTIVITY-MONITOR-RELEASE-20261029.md)。本文继续记录开发阶段的局部检查，不冒充生产实机结果。

## 实现与内容边界

左下活动入口替代旧探索指引位置；主线大条幅和体力残留移除，个人主页及团队新纸浪、雾效、点亮音效保留。图鉴分母来自实际地标，身份来自账号或游客，没有假在线人数、固定 UID 或假进度。

五个主题采用独立 DOM 目录和信息、中央横卷及上下柔焦背景。前四项为未上线主题预告，奖励标为构想；往期纪事仅回顾实际地标记录。北湖/图书馆预览只移动已有地图镜头，不打卡、不发奖，可返回原目录。未来配置为 active/completed 的目的地也须通过应用内白名单。

复用团队校园插画，ImageGen 制作柔焦环境、透明银杏枝、旅行手札和四枚奖励；不是整屏截图热区。完整提示词、来源与限制见[素材清单](asset-manifest.json)和[奖励记录](reward-assets.json)。本地两份字体覆盖活动与全应用中文，见[字形检查](font-coverage.json)。

## 验证证据

- [交互收据](../../../../qa/liyun-activity-20261029/browser-checks.json)：37 项，覆盖五主题、快速切换、奖励说明、预告、地图/图鉴返回、键盘、焦点、触屏、竖屏、减少动态和十次开关。
- [故障与生命周期](../../../../qa/liyun-activity-20261029/fallbacks-checks.json)：12 项，图片故障注入、回退、取消、焦点圈及合成可见性。
- [类型、构建与契约检查](../../../../qa/feature-20261029/checks.json)：本轮实际结果，不沿用历史通过数。
- [桌面](../../../../qa/liyun-activity-20261029/activity-1920x1080.png)、[手机横屏](../../../../qa/liyun-activity-20261029/activity-844x390.png)、[入场过程](../../../../qa/liyun-activity-20261029/activity-opening.png)、[地图预览](../../../../qa/liyun-activity-20261029/map-preview.png)。

```powershell
npm --prefix apps/liyun-explorer test
npm --prefix apps/liyun-explorer run build
node apps/liyun-explorer/scripts/verify-calibrated-map.mjs
node apps/liyun-explorer/scripts/asset-manifest.mjs --check
node qa/liyun-activity-20261029/browser.cjs
node qa/liyun-activity-20261029/fallbacks.cjs
```

## 两轮画面复核

首轮静帧确认悬挂卷轴、横卷、柔焦留白及独立信息控件，同时发现程序绘制的大银杏枝与手札过于简陋，按用户要求换成精细透明位图，奖励同步重制。第二轮查看替换后的 1920×1080、1366×768、915×412、844×390、740×320 静帧，并用真实浏览器输入检查入场、换章、导航和关闭。矮屏信息局部滚动，主动作保持可见。

浏览器为独立 profile 的 headless Edge，软件渲染、模拟 CSS 视口和 CDP 触屏输入。暂停检查使用显式合成可见性信号。未测物理手机、iOS/微信或中档手机帧率，不据此宣称实机 60fps。未接正式活动后台、日期授权或奖励发放；图景为校园意象插画，不是实拍或地理测绘。
