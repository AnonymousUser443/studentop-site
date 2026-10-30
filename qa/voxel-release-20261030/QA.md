# 体素独立发布验收 · 2026-10-30

应用基线：`0ecbf3bbdb8faf8d1d3482684675aafea1f70ca6`，包含已合并PR #10的BGM取消修复。本目录保存新结果，不覆盖原音频或旧发布收据。

- Windows Node v24.22.0：音频语法检查、体素Vite生产构建通过；`node qa/voxel-audio-20261030/browser.cjs --out qa/voxel-release-20261030/browser-checks.json` 21/21。使用独有Edge空档案与回环Range夹具，不是公网结果。
- Linux arm64 Node v24.22.1：`node --test qa/voxel-release-tests.mjs` 最终11/11。只在树莓派独立私有临时目录运行，模拟HTTP与生产目录，包含实际Linux软链接原子替换、回滚、flock保锁及umask077下的公开文件权限。
- 首轮Windows沙箱不允许硬链接、软链接和rename，未据此修改生产逻辑；Windows事务使用测试指针适配器，Linux测试使用真实原子替换。早期Linux10/10结果保留于transaction-tests.txt；审查发现umask权限问题后修正，最终结果为transaction-tests-final.txt。
- 最终Linux测试部署脚本SHA256：`d5335357526556e7c84425a5ce03c90dc10979361077e84086968de9406ee6ba`；测试脚本SHA256：`6a1f8e9d2e72c90bf276fcd8d50d7eed0942451f922832597af444d804f965b2`。上传文件与本地逐项相符。
- OpenCLI诊断为daemon未运行、桥接未连接，按仓库约定使用隔离Edge/CDP；未修改用户浏览器环境。未做手机、物理声卡或公网性能承诺。

生产发布已完成，deployment.json记录40项通过。公网最终public-browser-final.json记录13项通过；初次public-browser.json保留测试选择器误匹配body导致的超时，之后仅修正脚本选择器，产品未改。post-state.json记录非目标版本指针、配置与服务进程不变。公网脚本固定体素路径，只操作播放/切光景/静音按钮，不访问认证或云端存档。
