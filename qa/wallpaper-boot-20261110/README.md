# 动态壁纸与开场缓存验收

2026-11-10，Windows / Node.js v24.22.0 / Edge 157。验收的站点代码为 `88511af`，构建 ID 为 `cd337aac0abef253a57c9c2b`。

| 检查 | 结果 |
| --- | --- |
| 主页 JavaScript 逐文件 `node --check` | 通过 |
| `node --test qa/node-tests.cjs qa/desktop-node-tests.cjs qa/window-overflow-tests.cjs qa/voxel-shortcut-tests.cjs qa/update-check-tests.cjs` | 58 项通过 |
| 本地启动器 `--site-only --check`、`workspace-api-tests.mjs` 的站点单独启动用例 | 通过 |
| `qa/cache-tests.mjs` 的资源路径、内容版本、构建完整性与保留版本测试 | 8 项通过 |
| `node tools/build-site.mjs`、`node tools/build-site.mjs --check dist-site` | 通过 |
| `qa/boot-20261029/browser.cjs` 的开场、锁屏与合成登录回归 | 22 项通过 |

另用合成登录和受控视频响应测试慢网。视频请求发起时山水图已经显示，扣住后半段数据超过原开场时长后仍停留在 50%。点击加载环或按 Esc 都无法提前进入锁屏。放行数据后，首帧解码完成才出现时钟。刷新同样等候缓存，合成登录后直接播放 4K AV1，视频未重复请求。模拟三档视频均失败时进入静态锁屏。启用减少动态时未发出视频请求。

树莓派发布目录为 `/opt/win11-home/releases/20261109T165733Z`。公网入口检查 8 项通过。公网冷启动实测在山水画面出现后请求视频，时钟锁屏显示时 3840 × 2160 视频已解码首帧且处于暂停状态。

`cache-tests.mjs` 的 Nginx 模板一致性用例在基线 `1edf02b` 已存在失败。完整工作区集成测试涉及独立应用依赖，本轮覆盖主页单独启动用例。
