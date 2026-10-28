# 发布缓存与安全更新边界

本轮只修改本地源码、构建工具和 nginx **模板**，没有连接服务器、执行部署、运行 workflow 或 reload nginx。下面的服务器策略在所有者人工审核并安装前，不代表线上已经生效。

## 1. 已定位的根因

- 旧 [主页模板](../deploy/nginx/win11-home-app.conf) 给所有 CSS / JS / 图像等固定文件名设置 7 天缓存，却错误假设前端已有哈希构建。原生主页的资源文件名实际不变，服务器换了文件，浏览器仍可直接使用有效期内的旧副本。
- 旧 [项目模板](../deploy/nginx-projects.conf) 将 Vite 的 public 图像、地图、音频、字体一并缓存 30 天。放在 assets 下不等于有内容哈希。
- 仅修改 HTTP 响应头无法撤销客户端已经收到的长期缓存；必须让新 HTML 引用新 URL。
- 本地检索原生站点及两应用当前 TS/TSX 入口未见 Service Worker 注册。此结论不是对线上浏览器历史注册状态的证明，本轮未访问生产。

## 2. 原生主页的确定性构建

~~~powershell
# 全是本地操作；负责人统一执行正式构建，其他成员只构建测试fixture
node tools/build-site.mjs
node tools/build-site.mjs --check dist-site
node --test qa/cache-tests.mjs
~~~

[构建器](../tools/build-site.mjs) 默认读取 site，输出 dist-site，不改源码、不安装依赖、不执行 SSH 或打开浏览器。可显式指定 --source、--out；--check 仅校验现有工件，不触发构建。

[发布模块](../tools/site-release.mjs) 的冻结接口：

~~~js
import { siteRevision, buildSite, verifySiteBuild } from './tools/site-release.mjs';
const id = siteRevision(siteRoot); // 同步，24位小写hex；不包含时间/cwd/绝对路径
~~~

同一公开内容与构建规则得到同一 id。任一公开 HTML、JS、CSS、图片、字体或音频字节改变，都产生新 id。构建规则版本变化也要提升模块内 SCHEMA，不能以同一个 immutable URL 发布不同字节。

产物结构：

~~~text
dist-site/
  index.html                       meta[name=site-version] = id
  projects/index.html              同一id
  version.json                     仅 {"id":"24位hex"}
  site-build.json                  公开路径/版本保留索引；nginx禁止直接访问
  assets/releases/<id>/
    js/ css/ img/ fonts/ audio/     不变版本的完整资源
    manifest.json                  仅公开路径、长度与SHA256
  assets/js|css|img|fonts|audio/    当前版本的兼容别名，必须再验证，不能immutable
~~~

- 新 HTML 和 JS 中的本地资源/媒体引用指向版本命名空间。CSS 保留 css/img/fonts 目录相对关系，因此其相对 URL 也自然落在同一个版本。
- 与页面 canonical origin 相同的绝对 OG 图像 URL 也版本化；真正外链、data、mailto、API 和导航 URL 不改。
- 固定名兼容别名仅用于已打开的旧版页面、旧分享链接，避免第一次切换立即 404。新页面不依赖这些别名。
- 只读取两个公开 HTML 入口和明确允许的资产类型；仓库说明、私密配置、点文件、不支持的文件类型及符号链接不进入工件。输出不能位于源码之内、覆盖源码祖先，或经 junction 指回源码。
- 已有输出必须通过版本、文件白名单和 SHA256 校验才允许替换；不清空不认识的目录。新内容写入独立 staging、校验后替换输出；失败不删除可恢复的旧备份。

## 3. 缓存分层

| 类型 | 本地 nginx 模板策略 |
| --- | --- |
| 所有 HTML，包括项目页及 legacy HTML | no-cache，再验证；禁用时间/ETag短路，确保入口拿到最新内容 |
| 根 version.json | no-cache，禁用 ETag / If-Modified-Since 短路；开发 runner 另用 no-store |
| 原生 assets/releases/24hex/ | 一年 public immutable，仅对成功响应，不给 404 长缓存 |
| Vite 自动生成的根 assets 下带8字符hash的 JS / CSS / MJS | 一年 immutable |
| 其他固定名图片、地图、音乐、字体、JSON、脚本、兼容别名 | no-cache，不再给7天/30天 |
| /__desktop/auth | 精确同源代理，no-store/private，禁止代理缓存，不记录请求体 |

[主页片段](../deploy/nginx/win11-home-app.conf) 与 [初始安装脚本内对应模板](../deploy/pi-setup.sh) 同步；[项目配置](../deploy/nginx-projects.conf) 与 [理韵片段](../deploy/pi-liyun/nginx-liyun.conf.snippet) 同步缓存原则。没有修改北湖霜降的后端/代理端口或既有 SSH 服务。

nginx 的 location 一旦新增 add_header，会停止继承外层同类指令。因此 immutable / auth 位置明确重复或 include 当前安全响应头；以后加 CSP 等服务器级安全头时也须同步维护，不能只添加 Cache-Control。带量词花括号的 location regex 已加引号。

## 4. 私密门禁反代

主页模板新增精确 /__desktop/auth 到 127.0.0.1:8900：Host 使用 $http_host 保留公网端口；X-Real-IP 使用 $remote_addr 覆盖，不接受客户端伪造的链；Origin / CSRF 保留。1KiB 请求体限制、超时、no-store、禁代理缓存，且 access_log off。不会添加允许跨域读取的 CORS 头，也不吞上游 401/403/429/503。

这些配置不自动创建认证服务或秘密。所有者必须先按认证说明人工配置仓库外验证器、严格生产 origin 与可信回环代理，再启 companion；否则新前端应 fail closed。任何真实答案/私密配置都不能放进 CI、site、dist-site 或部署归档。

## 5. 旧标签页与原子发布

默认同一输出目录保留当前版本与前两个已校验版本，--retain 可显式设为0–10。版本资源的全部相对依赖一起保留，旧页面延迟请求旧 URL 仍能取到旧内容。相同源码重复构建不会产生新版本或额外历史。

**这不是无限兼容承诺：** 超出保留数量的旧标签页可能缺少延迟资源。新建/清空 dist-site 或全新 CI checkout 没有旧工件可继承；需要 CI恢复经过校验的上次工件，或由所有者在发布准备时保留需要的旧命名空间。本轮没有为此读取服务器或自动复制远程文件。服务器虽然保留旧 releases 目录，但 current 根切换并不自动把旧命名空间提供给新根。

原子替换保证新入口和新资源一起发布，不意味着已打开的 JavaScript 会热更新。桌面的更新提示由单独的 [更新检查模块](../site/assets/js/update-check.js) 负责：只探测同源版本、只提示用户，绝不自动刷新或清理 localStorage。用户主动更新时检查未保存便笺，允许取消。构建器不会注入强制 reload 或 Service Worker。

## 6. 已有7天/30天缓存的一次性迁移

1. 先保存或下载未保存的便笺，再由用户主动重新加载入口；新 HTML 使用不同版本 URL，绕过旧固定名资源的有效缓存。
2. 老页面如果还没有更新检查模块，服务器不能远程给它注入提示；不能声称“不刷新也自动变成新版”。必要时用户手动以新的版本查询参数访问入口，但不要携带答案或清理整站存储。
3. Vite bundle 已带内容哈希；其 public 固定名媒体只改响应头，**不能使浏览器立即忘掉先前收到的30天缓存**。这类旧媒体若本次内容也变更，需要所有者额外更换资源 URL 或等缓存到期。不能把模板修改宣传为已清空所有客户端缓存。
4. 本轮未注册/注销 SW，不清理其他站点缓存；若线上曾有历史 SW，应由所有者另行核实其 scope 与更新策略。

## 7. 发布前本地门槛与权限

[发布脚本](../deploy/deploy-site.sh) 默认源改为 dist-site，先检查版本产物并运行纯本地 checksum guard，且在打包、首个 SSH/SCP 之前完成。直接传原始 site 或损坏/混入未知文件的工件会本地失败，不发起远程动作。

部署仍仅允许所有者明确发起。本轮没有执行该脚本、workflow 或 git push；新配置也尚未安装到服务器。历史已安装的 git hook 不会因修改模板自动更新，由所有者人工核对；Lead另维护本地build/check hook及CI源路径，不能让一次普通push偷偷发布或把认证配置传上去。

## 8. 验证范围

[离线回归](../qa/cache-tests.mjs) 只构建临时合成站点，覆盖：相同内容两次工件完全一致；图片改动导致id和HTML/JS媒体URL变化；CSS相对依赖同版本；旧命名空间保留；输出完整性、源目录不变、越界junction/私密名拒绝；缓存片段与安装模板一致；本地guard先于SSH。

2026-10-28，Lead已使用同一真实Edge profile、启用HTTP缓存的两个本地构建版本完成[暖缓存验收](../qa/revision-20261028/cache-browser.json)：**19/19通过**，预热阶段实际25次缓存命中（最终记录26次）。确认资源变更产生新namespace、不自动刷新/不抢编辑焦点、取消更新保留未保存便笺、确认后实际执行新版代码、旧namespace仍可用，以及移动端提示和开始菜单页脚可操作。测试只使用合成认证，不是线上生产验收。

正式字体补集后的最终全站工件仍由Lead统一生成；文档维护者没有抢写dist-site。两个部署shell脚本仅执行bash -n语法检查，未执行其正文；nginx模板尚未在目标服务器执行 nginx -t。在所有者授权安装前仍须审核生产路径/认证companion，并执行真实语法与响应头检查。静态及本地浏览器测试通过不等于已经部署或清理了所有生产客户端缓存。
