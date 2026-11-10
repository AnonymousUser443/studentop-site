# 理韵寻踪 1.1.x · 纸雾与资源生命周期
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
## 1.1.0 发布记录
2026-11-10 20:22:11（Asia/Shanghai）完成，源码提交 `066fb6294e6414db0f4d364c436b289dc2d47d3f`；资源版本 `693c6943d3e39517d9dbf7f1`。
Release 为 `liyun-player-20261110T122036Z-066fb6294e`，前一回滚点为 `liyun-studio-20261103T150729Z-96390a540a`。[服务器收据](../qa/liyun-player-20261110/deployment.json) 的 82 项检查通过，公网体检 8 PASS / 0 FAIL。标定发布版本仍为 978，账户和工坊服务未重启。

## 1.1.1 视觉修订
用户在实际地图上指出静态薄雾失去翻涌、区域边界仍有亮色切线。原验收只检查隐藏雾层后的底图边缘，覆盖不足；不能据此判断最终雾面也已衔接。
本次将薄雾延续到地图空白边距，按已解锁区域的原几何清雾。缓存掩膜预先羽化并保留画布外边距，地图与雾层共用压暗层。两张 512 像素的确定性云纹以不同相位反向平移、缓慢缩放和旋转，提供翻涌；薄雾没有 JavaScript 绘制循环。菜单、后台与固定时间验收暂停；低画质和减少动态保留静态底雾。
第一轮仅对原多边形对称羽化，缩小后透出了校园围墙直线，因此未采用；第二轮在正常雾层完整显示下验收桌面和 844×390 横屏，原亮色多边形切线消失。
最终资源版本 `5525a8381621275f0f90ba77`。173 项应用测试及生产构建通过；缓存与封装 6 项测试通过。3 秒中两层云纹均发生位移，薄雾 Canvas 的 drawImage/fill/fillRect/clearRect 调用均为 0；掩膜相邻像素透明度最大差为 3/255。66 项清单资源缓存完整，二次打开静态资源网络传输为 0 字节。开发隔离 QA 验证原几何解锁与镂空，未修改玩家进度。
证据：[结构化结果](../qa/liyun-player-20261110/fog-111-verification.json)、[几何与暂停检查](../qa/liyun-player-20261110/fog-111-geometry.json)、[桌面](../qa/liyun-player-20261110/fog-111-final-desktop.png)、[横屏](../qa/liyun-player-20261110/fog-111-final-mobile.png)、[六秒动效抽帧](../qa/liyun-player-20261110/fog-111-motion.gif)。动效预览采样浏览器实际合成，4fps，不作为设备帧率指标；尚无手机硬件/GPU 性能和纯血鸿蒙真机复测。

### 1.1.1 发布记录
2026-11-10 21:03:49（Asia/Shanghai）完成，源码提交 `5e93d422b43e71b5e3a2ff8479a687247b374ad0`，release 为 `liyun-player-20261110T130109Z-5e93d422b4`。前一回滚点为 `liyun-player-20261110T122036Z-066fb6294e`。
[服务器收据](../qa/liyun-player-20261110/deployment-111.json) 的 82 项检查全通过，公网体检 8 PASS / 0 FAIL。标定快照 SHA-256 仍为 `f78011896b6fe69be42db115f94709895ac4a6c433f84a275a417311caa81d40`（revision 978），账户、工坊、frpc 进程与其他站点指针均未变。
[公网浏览器验收](../qa/liyun-player-20261110/live-111-verification.json) 确认 1.1.1 资源图一致、10 个发布区域、Worker 已控制、暖缓存传输 0 字节；前台观察 3 秒双层云纹移动且薄雾 Canvas drawImage=0。正常雾层截图已在本机复核；包含账号信息的截图仅保留在忽略的本地临时目录，不入仓库。桌面原有三处未提交修改已与远端壁纸工作合并，无剩余 site 差异；main 合并记录一同同步。
