# 理韵寻踪 1.1.0 · 纸雾与资源生命周期
本轮按所有者授权提交并发布理韵前端，沿用已发布的区域标定，不重发团队工坊草稿。
## 用户可见变化
- 薄雾色为 #F5E6BD，区域遮挡按解锁集合缓存为一张最长边 2048 像素的图像；没有常驻雾团绘制，解锁时才淡出。
- 滚轮缩放使用带阻尼的弹簧；连续输入累积，拖动/隐藏/暂停可打断；减少动态偏好下直接缩放。
- 地图图片四边渐隐至同色纸底，消除图片矩形与空白处的硬边。
- 入场为“雾中寻路”：真实加载进度、山水/云纸/罗盘分层、可跳过演出、失败可重试。
- 初始化校验并缓存所有打包资源，以及当前发布的地标照片。CacheStorage + Service Worker 复用静态资源，音频支持缓存 Range 请求。
- 内容版本每次启动重新读取；应用版本及内容变化按分钟与页面返回前台检查，提示用户更新。旧版本不在使用过程中强刷。
- 设备 timestamp 完全退出定位有效期与排序判断，统一使用收到回调的 performance.now()，15 秒无有效更新仍拦截打卡。
## 后续维护
1. 修改 apps/liyun-explorer，按语义更新 package.json/package-lock.json 版本号。
2. 运行应用测试、npm run build，以及 node --test qa/liyun-cache-worker-tests.mjs qa/liyun-release-tests.mjs。
3. 使用 tools/build-liyun-release.mjs 封装内容指纹资源、不可变 precache.json、根 version.json 与 sw.js；不要直接发布裸 Vite dist。
4. 校验当前发布指针、nginx 配置哈希与公开标定快照哈希，写入 .release-local/liyun-player-baseline.json。提交受审查的源码后，运行 tools/prepare-liyun-player.mjs 生成完整清单和归档。
5. 所有者当次授权后，在远端共享发布锁下执行 deploy/apply-liyun-player.mjs；它校验逐文件哈希，保留旧资源，原子切换前端和缓存端点配置，自检失败回滚。
6. 仅根入口/版本元数据/SW 检查更新；素材走版本路径。跨版本只复用同哈希图片、字体、音频，不能把旧 JS 响应地址带入新模块图。
CacheStorage 是浏览器管理的持久缓存，空间不足或用户清理站点数据后会重新加载；缓存写入失败不阻止本次在线使用。账号、工坊、定位和进度 API 不进入 Worker 缓存。
## 验收
见 [演出 QA](liyun-arrival-20261110/QA.md) 及 [结构化证据](../qa/liyun-player-20261110/verification.json)。本地 173+6 项测试通过，冷暖缓存、离线恢复、实际跨版本更新与滚轮缓动经过浏览器验证。
发布收据将在上线完成后补充。
