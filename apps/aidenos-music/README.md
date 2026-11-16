# 听潮 · AidenOS Music

听潮直接挂载在 AidenOS 的原生窗口内容区。桌面负责拖动、缩放、贴靠和单实例；音频运行时独立于窗口，关闭、最小化和锁屏都保留此前的播放状态。

界面提供首页、四类搜索、歌单／专辑／歌手详情、个人音乐库、播放队列、逐字歌词、悬浮迷你播放器和锁屏媒体卡。日光、夜航均有原创分层插画，也可跟随桌面外观。真实账号通过网易云 App 扫码连接，各浏览器独立。支持喜欢歌曲、普通／私密歌单创建和本人歌单曲目增删。

沉浸歌词可切换“随行／演出”。“潮汐演出”移植 Folia Sonnet 的文字 PV 渲染，按需加载 PixiJS，并直接使用听潮的昼夜配色和既有字库。小窗口、减少动态效果、WebGL 初始化失败或上下文丢失时回到随行歌词；隐藏时释放画布，暂停时停止连续 GPU 绘制。首版不包含上游模型节拍分析、主题库和账号播放器。来源、适配边界与许可见 [THIRD_PARTY.md](THIRD_PARTY.md) 和[迁移记录](../../docs/tingchao-folia/QA.md)。

## 本地开发

使用 Node.js 24，从仓库根目录运行：

```powershell
npm --prefix apps/aidenos-music ci
node tools/dev-workspace.mjs --site-only --music
```

在 `http://127.0.0.1:8899/` 的桌面内打开听潮。`--music` 管理 8901 音乐后端和 Vite 模块构建监听，编译模块暂存到主站专用资源目录；无需单独打开音乐网页。首次桌面私密门禁沿用仓库既有配置流程，音乐密钥与会话存储由启动器放在独立私有目录。

```powershell
node tools/build-music.mjs
node tools/build-site.mjs
node tools/build-site.mjs --check dist-site
```

音乐依赖、锁文件和源码只属于本工程；主站公开目录保存有意提交的编译模块、CSS、字体与插画。`dist-site` 是由既有主站编译器产生的版本化发布目录。开发源码和诊断脚本不会进入公开目录。

## 边界

- `src/domain.ts` 固定领域类型、Service、Runtime 和桌面宿主接口。
- `src/services` 只访问同源 `/__desktop/music/v1/`，处理账号缓存、并发去重、取消与播放租约；UI 只读取领域数据。
- `src/runtime` 拥有唯一音频元素、队列、媒体键、音量及持久化状态。重复歌曲有不同队列标识。刷新恢复队列和进度，等待用户播放，不保存临时音源 URL。
- `src/lyrics` 解析 YRC／LRC 并回退到纯音乐；UI 只更新当前行和当前词。窗口隐藏时冻结视图订阅并取消视觉 RAF，音频时钟继续。
- `src/ui` 由 Motion 处理页面／面板，GSAP 处理封面展开及分层场景。上下文在卸载或不可见时清理；尊重桌面减少动态效果设置。
- `src/index.tsx` 暴露 `mountMusicApp`、`mountMusicSurface` 和 `ensureMusicRuntime`，销毁视图不销毁运行时。
- `server` 使用固定 SDK 4.41.1，白名单封装上游能力、加密 Cookie 和独立 SQLite 存储，详见[后端说明](server/README.md)。

浏览和歌单编辑要求桌面解锁，写入校验来源与 CSRF。首次播放获取 12 小时租约，锁屏后只允许持有该租约的播放解析。退出音乐账号会清除播放、租约及媒体信息。播放遵循接口实际返回的权限、试听范围和音质。

## 验证与发布

```powershell
npm --prefix apps/aidenos-music test
node --test apps/aidenos-music/server/app.test.mjs
node --test qa/music-proxy-tests.mjs qa/music-workspace-tests.mjs qa/music-release-tests.mjs
```

[浏览器验收](../../qa/tingchao/run-browser.mjs) 通过 OpenCLI 在真实桌面中操作。合成 fixture 使用临时账号、数据库及低音量 WAV；`--live` 只验证官方游客数据和真实音源，不登录或编辑真实账号。结果与截图保存在 `qa/tingchao`，交付范围和发布收据见[实施记录](../../docs/tingchao/PROGRESS.md)。

发布须遵守仓库部署授权与 `rpi-site-publish` 流程。专用 prepare/apply 脚本打包主页、认证网关与音乐服务，检查已审查提交、双层哈希和线上基线，持有共享发布锁后原子切换。树莓派在本机生成私有密钥；失败恢复原指针、配置及服务。音乐 SDK 只监听回环，无新增域名。

字体清单与 Noto 许可、原创素材清单分别位于 `docs/tingchao/font-manifest.json`、`site/assets/fonts/OFL-Noto*.txt` 和 `docs/tingchao/asset-manifest.json`。动态中文通过 unicode-range 分片加载。

下一版包含云盘歌曲读取、歌曲评论与点赞回复、本人私密歌单、官方心动歌单、可选桌面歌词，以及 Folia Sonnet / Tilt 歌词呈现。列表入场共用 `ListEntrance`，按滚动可见范围触发，虚拟列表保持稳定行高；夜间基色为 `#153A30`。云盘暂不提供上传或删除。桌面歌词位于 AidenOS 浏览器桌面内。实施和实际验收记录见 `docs/tingchao-vnext/`。
