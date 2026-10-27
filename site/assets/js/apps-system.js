/* =====================================================================
   系统类应用：此电脑 / 设置 / 终端 / 记事本 / 照片 / 回收站
   ===================================================================== */
(function () {
  'use strict';
  var defs = window.__APP_DEFS = window.__APP_DEFS || [];
  var esc = function (s) { return Win.esc(s); };

  /* ======================= 此电脑 / 文件资源管理器 ======================= */
  defs.push({
    id: 'thispc',
    title: '此电脑',
    desktopLabel: '此电脑',
    icon: 'thispc',
    keywords: 'explorer 文件 此电脑 磁盘 目录 folder',
    width: 1000,
    height: 660,
    minWidth: 640,
    minHeight: 420,
    render: function (body) {
      var folders = [
        { app: 'projects', name: '项目作品', sub: (window.SITE.projects || []).length + ' 个项目' },
        { app: 'skills', name: '技能', sub: (window.SITE.skills || []).length + ' 个分类' },
        { app: 'contact', name: '联系我', sub: '写封邮件' },
        { app: 'cv', name: '简历', sub: '一页纸版本' },
        { app: 'notepad', name: '记事本', sub: '写给访客' },
        { app: 'photos', name: '照片', sub: '壁纸收藏' },
        { app: 'terminal', name: '终端', sub: 'PowerShell' },
        { app: 'settings', name: '设置', sub: '换个样子' }
      ];

      body.innerHTML =
        '<div class="app explorer-app">' +
          '<div class="exp-toolbar">' +
            '<button type="button" class="exp-btn exp-primary" id="expNew">' + ICONS.glyph('plus') + '<span>新建</span></button>' +
            '<span class="exp-sep"></span>' +
            '<button type="button" class="exp-btn" disabled>剪切</button>' +
            '<button type="button" class="exp-btn" disabled>复制</button>' +
            '<button type="button" class="exp-btn" disabled>粘贴</button>' +
            '<button type="button" class="exp-btn" disabled>重命名</button>' +
            '<button type="button" class="exp-btn" disabled>删除</button>' +
            '<span class="exp-spacer"></span>' +
            '<button type="button" class="exp-btn">' + ICONS.glyph('sort') + '<span>排序</span></button>' +
            '<button type="button" class="exp-btn">' + ICONS.glyph('grid-view') + '<span>查看</span></button>' +
            '<button type="button" class="exp-btn exp-icon-only" aria-label="更多">' + ICONS.glyph('dots') + '</button>' +
          '</div>' +
          '<div class="exp-pathbar">' +
            '<button type="button" class="nav-btn" aria-label="后退">' + ICONS.glyph('arrow-left') + '</button>' +
            '<button type="button" class="nav-btn" aria-label="前进">' + ICONS.glyph('arrow-right') + '</button>' +
            '<button type="button" class="nav-btn" aria-label="上一级">' + ICONS.glyph('chevron-up') + '</button>' +
            '<div class="address-bar">' + ICONS.glyph('home') + '<span>此电脑</span><span class="addr-chev">' + ICONS.glyph('chevron-right') + '</span></div>' +
            '<div class="exp-search">' + ICONS.glyph('search') + '<input type="text" placeholder="搜索 此电脑" aria-label="搜索"></div>' +
          '</div>' +
          '<div class="exp-main">' +
            '<nav class="exp-nav">' +
              '<div class="nav-group">快速访问</div>' +
              '<button type="button" class="nav-item is-active">' + ICONS.glyph('home') + '<span>主页</span></button>' +
              '<button type="button" class="nav-item">' + ICONS.glyph('star') + '<span>收藏夹</span></button>' +
              '<div class="nav-group">此电脑</div>' +
              '<button type="button" class="nav-item">' + ICONS.glyph('monitor') + '<span>设备和驱动器</span></button>' +
              '<button type="button" class="nav-item">' + ICONS.glyph('globe') + '<span>网络</span></button>' +
              '<div class="nav-group">这台设备</div>' +
              '<button type="button" class="nav-item">' + ICONS.glyph('cpu') + '<span>树莓派 4B</span></button>' +
            '</nav>' +
            '<div class="exp-content">' +
              '<div class="exp-section"><div class="exp-section-title">设备和驱动器</div>' +
                '<div class="drive-grid">' +
                  '<div class="drive-card"><span class="drive-icon">' + ICONS.app('thispc') + '</span>' +
                    '<div class="drive-info"><div class="drive-name">本地磁盘 (C:)</div>' +
                    '<div class="drive-bar"><i style="width:15%"></i></div>' +
                    '<div class="drive-sub">23.7 GB 可用，共 29.3 GB</div></div></div>' +
                  '<div class="drive-card"><span class="drive-icon">' + ICONS.app('thispc') + '</span>' +
                    '<div class="drive-info"><div class="drive-name">网站备份 (D:)</div>' +
                    '<div class="drive-bar"><i style="width:42%"></i></div>' +
                    '<div class="drive-sub">17.1 GB 可用，共 29.5 GB</div></div></div>' +
                '</div>' +
              '</div>' +
              '<div class="exp-section"><div class="exp-section-title">文件夹</div>' +
                '<div class="folder-grid">' +
                  folders.map(function (f) {
                    return '<button type="button" class="folder-item" data-open-app="' + f.app + '">' +
                      '<span class="folder-icon">' + ICONS.app((window.Win.apps && window.Win.apps[f.app] ? window.Win.apps[f.app].icon : 'projects')) + '</span>' +
                      '<span class="folder-name">' + esc(f.name) + '</span>' +
                      '<span class="folder-sub">' + esc(f.sub) + '</span></button>';
                  }).join('') +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="exp-status"><span>' + (folders.length + 2) + ' 个项目</span><span>树莓派 4B · Debian 13</span></div>' +
        '</div>';

      body.querySelectorAll('[data-open-app]').forEach(function (btn) {
        btn.addEventListener('click', function () { WM.launch(btn.getAttribute('data-open-app')); });
      });
      var expNew = body.querySelector('#expNew');
      if (expNew) expNew.addEventListener('click', function () {
        Win.notify({ icon: 'info', title: '这里不能新建', body: '这是一个只读的个人主页，所有内容都在 content.js 里。' });
      });
    }
  });

  /* ======================= 设置 ======================= */
  var ACCENTS = ['#0067c0', '#0078d4', '#4cc2ff', '#8764b8', '#c239b3', '#e3008c', '#ef6950', '#c23934', '#498205', '#00b294'];

  defs.push({
    id: 'settings',
    title: '设置',
    desktopLabel: '设置',
    icon: 'settings',
    keywords: 'settings 设置 主题 壁纸 深色 个性化 关于',
    width: 980,
    height: 680,
    minWidth: 660,
    minHeight: 440,
    render: function (body, ctx) {
      var pane = 'personalize';
      body.innerHTML =
        '<div class="app settings-app">' +
          '<aside class="set-nav">' +
            '<div class="set-user"><span class="avatar lg">' + esc(window.SITE.profile.avatarText) + '</span>' +
              '<div><div class="set-user-name">' + esc(window.SITE.profile.name) + '</div>' +
              '<div class="set-user-mail">' + esc(window.SITE.profile.email) + '</div></div></div>' +
            '<div class="set-nav-group">' +
              '<button type="button" class="set-nav-item" data-pane="system">' + ICONS.glyph('monitor') + '<span>系统</span></button>' +
              '<button type="button" class="set-nav-item is-active" data-pane="personalize">' + ICONS.glyph('palette') + '<span>个性化</span></button>' +
              '<button type="button" class="set-nav-item" data-pane="about">' + ICONS.glyph('info') + '<span>关于</span></button>' +
            '</div>' +
          '</aside>' +
          '<div class="set-body" id="setBody"></div>' +
        '</div>';

      var bodyEl = body.querySelector('#setBody');

      function seg(options, current, onPick) {
        return '<div class="segmented">' + options.map(function (o) {
          return '<button type="button" class="seg' + (o.value === current ? ' is-active' : '') + '" data-value="' + esc(o.value) + '">' +
            (o.icon ? ICONS.glyph(o.icon) : '') + '<span>' + esc(o.label) + '</span></button>';
        }).join('') + '</div>';
      }

      function renderPane() {
        if (pane === 'personalize') {
          bodyEl.innerHTML =
            '<section class="set-section"><h2>背景</h2>' +
              '<div class="wall-grid">' +
                (window.SITE.wallpapers || []).map(function (w) {
                  return '<button type="button" class="wall-tile' + (Win.prefs.wall === w.id ? ' is-active' : '') + '" data-wall="' + w.id + '">' +
                    '<span class="wall-thumb" style="' + (w.thumb ? 'background-image:url(' + esc(w.thumb) + ')' : 'background:linear-gradient(160deg,#0f172a,#334155)') + '"></span>' +
                    '<span class="wall-name">' + esc(w.name) + '</span></button>';
                }).join('') +
              '</div>' +
            '</section>' +
            '<section class="set-section"><h2>颜色</h2>' +
              '<div class="set-row"><div class="set-row-label"><span>主题模式</span><span class="set-row-sub">切换整个桌面的明暗</span></div>' +
                seg([
                  { value: 'light', label: '浅色', icon: 'sun' },
                  { value: 'dark', label: '深色', icon: 'moon' },
                  { value: 'auto', label: '跟随系统', icon: 'monitor' }
                ], Win.prefs.themeMode, pickTheme) +
              '</div>' +
              '<div class="set-row"><div class="set-row-label"><span>主题色</span><span class="set-row-sub">按钮、选中状态和强调色</span></div>' +
                '<div class="accent-row">' + ACCENTS.map(function (c) {
                  return '<button type="button" class="accent-dot' + (Win.prefs.accent.toLowerCase() === c.toLowerCase() ? ' is-active' : '') + '" data-accent="' + c + '" style="background:' + c + '" aria-label="' + c + '"></button>';
                }).join('') + '</div>' +
              '</div>' +
            '</section>' +
            '<section class="set-section"><h2>任务栏</h2>' +
              '<div class="set-row"><div class="set-row-label"><span>对齐方式</span><span class="set-row-sub">图标靠中间还是靠左</span></div>' +
                seg([{ value: 'center', label: '居中' }, { value: 'left', label: '左对齐' }], Win.prefs.align, function (v) { Win.setPref('align', v); renderPane(); }) +
              '</div>' +
              '<div class="set-row"><div class="set-row-label"><span>动画效果</span><span class="set-row-sub">关闭后窗口和菜单不再播放动画</span></div>' +
                '<button type="button" class="switch' + (Win.prefs.motion ? ' is-on' : '') + '" id="motionSwitch" role="switch" aria-checked="' + (Win.prefs.motion ? 'true' : 'false') + '"><span></span></button>' +
              '</div>' +
            '</section>' +
            '<section class="set-section"><h2>重置</h2>' +
              '<div class="set-row"><div class="set-row-label"><span>恢复默认外观</span><span class="set-row-sub">壁纸、主题、主题色和任务栏对齐都会还原</span></div>' +
                '<button type="button" class="btn" id="resetPrefs">' + ICONS.glyph('refresh') + '重置</button>' +
              '</div>' +
            '</section>';

          bodyEl.querySelectorAll('.wall-tile').forEach(function (tile) {
            tile.addEventListener('click', function () {
              Win.setPref('wall', tile.getAttribute('data-wall'));
              renderPane();
            });
          });
          bodyEl.querySelectorAll('.accent-dot').forEach(function (dot) {
            dot.addEventListener('click', function () {
              Win.setPref('accent', dot.getAttribute('data-accent'));
              renderPane();
            });
          });
          bodyEl.querySelectorAll('.seg').forEach(function (b) {
            b.addEventListener('click', function () {
              var group = b.parentElement;
              var idx = Array.prototype.indexOf.call(group.children, b);
              if (group.previousElementSibling && group.previousElementSibling.textContent.indexOf('主题模式') > -1) {
                pickTheme(b.getAttribute('data-value'));
              } else if (b.getAttribute('data-value') === 'center' || b.getAttribute('data-value') === 'left') {
                Win.setPref('align', b.getAttribute('data-value'));
                renderPane();
              }
            });
          });
          var motion = bodyEl.querySelector('#motionSwitch');
          if (motion) motion.addEventListener('click', function () {
            Win.setPref('motion', !Win.prefs.motion);
            renderPane();
          });
          var reset = bodyEl.querySelector('#resetPrefs');
          if (reset) reset.addEventListener('click', function () {
            Win.setPref('themeMode', Win.defaults.themeMode);
            Win.setPref('wall', Win.defaults.wall);
            Win.setPref('accent', Win.defaults.accent);
            Win.setPref('align', Win.defaults.align);
            Win.setPref('motion', Win.defaults.motion);
            renderPane();
            Win.notify({ icon: 'check', title: '已恢复默认外观', body: '壁纸和主题都回到最初的样子。' });
          });
        } else if (pane === 'system') {
          var info = [
            { label: '设备名称', value: 'win11-home' },
            { label: '网站跑在', value: 'Raspberry Pi 4 Model B' },
            { label: '操作系统', value: 'Debian 13 (trixie) · aarch64' },
            { label: 'Web 服务器', value: 'nginx + HTTPS' },
            { label: '公网入口', value: 'SakuraFrp 内网穿透' },
            { label: '域名', value: window.SITE.profile.domain },
            { label: '你的浏览器', value: browserName() },
            { label: '窗口尺寸', value: window.innerWidth + ' × ' + window.innerHeight }
          ];
          bodyEl.innerHTML =
            '<section class="set-section"><h2>关于本站</h2>' +
              '<div class="info-card">' + ICONS.app('thispc') +
                '<div><h3>' + esc(window.SITE.profile.name) + ' 的个人主页</h3>' +
                '<p>一个伪装成 Windows 11 桌面的静态网页，跑在宿舍里的树莓派上。</p></div>' +
              '</div>' +
              '<div class="info-grid">' + info.map(function (i) {
                return '<div class="info-row"><span class="info-label">' + esc(i.label) + '</span><span class="info-value">' + esc(i.value) + '</span></div>';
              }).join('') + '</div>' +
            '</section>' +
            '<section class="set-section"><h2>操作</h2>' +
              '<div class="set-row"><div class="set-row-label"><span>关闭所有窗口</span><span class="set-row-sub">回到干净的桌面</span></div>' +
                '<button type="button" class="btn" id="closeAll">' + ICONS.glyph('close') + '关闭</button></div>' +
              '<div class="set-row"><div class="set-row-label"><span>锁定屏幕</span><span class="set-row-sub">回到锁屏界面</span></div>' +
                '<button type="button" class="btn" id="lockNow">' + ICONS.glyph('lock') + '锁定</button></div>' +
            '</section>';
          var closeAll = bodyEl.querySelector('#closeAll');
          if (closeAll) closeAll.addEventListener('click', function () { WM.closeAll(); });
          var lockNow = bodyEl.querySelector('#lockNow');
          if (lockNow) lockNow.addEventListener('click', function () { Win.showLock(); closeAll; WM.closeAll(); });
        } else {
          bodyEl.innerHTML =
            '<section class="set-section"><h2>关于这个主页</h2>' +
              '<div class="about-card">' +
                '<span class="about-logo">' + ICONS.app('start') + '</span>' +
                '<div><h3>' + esc(window.SITE.profile.name) + ' 的个人主页</h3>' +
                '<p>版本 1.0 · 手写 HTML / CSS / JavaScript，没有框架、没有 CDN、没有追踪脚本。</p></div>' +
              '</div>' +
              '<div class="tech-grid">' +
                '<div class="tech-item"><span class="tech-key">前端</span><span class="tech-val">原生 HTML / CSS / ES5 语法 JavaScript</span></div>' +
                '<div class="tech-item"><span class="tech-key">窗口系统</span><span class="tech-val">自写窗口管理器：拖动、缩放、贴边分屏、最小化动画</span></div>' +
                '<div class="tech-item"><span class="tech-key">服务端</span><span class="tech-val">树莓派 4B + Debian 13 + nginx</span></div>' +
                '<div class="tech-item"><span class="tech-key">公网</span><span class="tech-val">SakuraFrp 内网穿透 + 自有域名 ' + esc(window.SITE.profile.domain) + '</span></div>' +
                '<div class="tech-item"><span class="tech-key">体积</span><span class="tech-val">整站静态资源 < 1 MB，无外部请求</span></div>' +
              '</div>' +
              '<div class="about-links-inline">' +
                '<a class="btn" href="mailto:' + esc(window.SITE.profile.email) + '">' + ICONS.glyph('mail') + '写邮件</a>' +
                '<a class="btn" href="https://github.com/AnonymousUser443" target="_blank" rel="noopener noreferrer">' + ICONS.glyph('github') + 'GitHub</a>' +
              '</div>' +
            '</section>';
        }
      }

      function pickTheme(v) {
        Win.setPref('themeMode', v);
        renderPane();
      }

      body.querySelectorAll('.set-nav-item').forEach(function (btn) {
        btn.addEventListener('click', function () {
          body.querySelectorAll('.set-nav-item').forEach(function (b) { b.classList.remove('is-active'); });
          btn.classList.add('is-active');
          pane = btn.getAttribute('data-pane');
          renderPane();
        });
      });

      renderPane();
    }
  });

  function browserName() {
    var ua = navigator.userAgent;
    if (/Edg\//.test(ua)) return 'Microsoft Edge';
    if (/Chrome\//.test(ua)) return 'Google Chrome';
    if (/Firefox\//.test(ua)) return 'Mozilla Firefox';
    if (/Safari\//.test(ua)) return 'Safari';
    return '浏览器';
  }

  /* ======================= 终端 ======================= */
  defs.push({
    id: 'terminal',
    title: '终端',
    desktopLabel: '终端',
    icon: 'terminal',
    keywords: 'terminal 终端 命令行 shell powershell cmd',
    width: 880,
    height: 560,
    minWidth: 520,
    minHeight: 320,
    render: function (body, ctx) {
      var PROMPT = 'PS C:\\Users\\Aiden&gt;';
      var history = [];
      var hIndex = -1;
      body.innerHTML =
        '<div class="terminal-app">' +
          '<div class="term-tabs"><button type="button" class="term-tab is-active">' + ICONS.app('terminal') + '<span>Windows PowerShell</span>' +
            '<span class="term-tab-close">' + ICONS.glyph('close') + '</span></button><button type="button" class="term-newtab">+</button></div>' +
          '<div class="term-body" id="termBody">' +
            '<div class="term-out" id="termOut"></div>' +
            '<div class="term-input-row"><span class="term-prompt">' + PROMPT + '</span>' +
            '<input type="text" id="termInput" autocomplete="off" spellcheck="false" aria-label="终端输入"></div>' +
          '</div>' +
        '</div>';

      var out = body.querySelector('#termOut');
      var input = body.querySelector('#termInput');
      var termBody = body.querySelector('#termBody');

      function line(html, cls) {
        var div = document.createElement('div');
        div.className = 'term-line' + (cls ? ' ' + cls : '');
        div.innerHTML = html;
        out.appendChild(div);
        termBody.scrollTop = termBody.scrollHeight;
      }
      line('Windows PowerShell', 'term-dim');
      line('Copyright (C) Aiden. 这只是一张网页，请随意折腾。', 'term-dim');
      line('输入 <b>help</b> 查看可用命令。', 'term-dim');
      line('');

      function run(cmd) {
        var raw = cmd;
        var args = cmd.trim().split(/\s+/);
        var c = (args[0] || '').toLowerCase();
        line('<span class="term-prompt">' + PROMPT + '</span> ' + esc(raw));
        if (!c) return;
        switch (c) {
          case 'help':
            line('可用命令：', '');
            line('  <b>help</b>            显示这个帮助');
            line('  <b>about</b> / <b>whoami</b>  关于我');
            line('  <b>projects</b>        项目列表');
            line('  <b>skills</b>          技能列表');
            line('  <b>contact</b>         联系方式');
            line('  <b>open</b> &lt;应用&gt;     打开应用，如 open projects');
            line('  <b>ls</b> / <b>dir</b>        查看文件');
            line('  <b>cat</b> &lt;文件&gt;      查看文件内容');
            line('  <b>neofetch</b>        看看这台机器');
            line('  <b>theme</b> dark|light  切换主题');
            line('  <b>date</b> / <b>echo</b> / <b>clear</b> / <b>exit</b>');
            break;
          case 'about':
          case 'whoami':
            line(esc(window.SITE.profile.name) + ' — ' + esc(window.SITE.profile.role));
            line(esc(window.SITE.profile.tagline), 'term-dim');
            line(esc(window.SITE.profile.school) + ' · ' + esc(window.SITE.profile.location), 'term-dim');
            break;
          case 'projects':
            (window.SITE.projects || []).forEach(function (p) {
              line('  ' + esc(p.title) + '  <span class="term-dim">' + esc(p.year) + ' · ' + esc((p.tags || []).join(' / ')) + '</span>');
            });
            break;
          case 'skills':
            (window.SITE.skills || []).forEach(function (g) {
              line('  ' + esc(g.group) + '：' + g.items.map(function (s) { return esc(s.name); }).join('、'));
            });
            break;
          case 'contact':
            line('  email : ' + esc(window.SITE.profile.email));
            line('  github: ' + esc(window.SITE.profile.links.filter(function (l) { return l.icon === 'github'; }).map(function (l) { return l.url; })[0] || ''));
            break;
          case 'open':
            if (args[1] && window.Win.apps[args[1]]) { WM.launch(args[1]); line('已打开 ' + esc(args[1]), 'term-dim'); }
            else line('找不到这个应用：' + esc(args[1] || '（空）'), 'term-error');
            break;
          case 'ls':
          case 'dir':
            line('    目录: C:\\Users\\Aiden', 'term-dim');
            line('');
            line('Mode                 LastWriteTime         Length Name');
            line('----                 -------------         ------ ----');
            line('d-----             2026/10/27 13:00               projects');
            line('d-----             2026/10/27 13:00               skills');
            Object.keys(window.SITE.terminalFiles || {}).forEach(function (f) {
              line('-a----             2026/10/27 13:00              ' + (window.SITE.terminalFiles[f].length + 42) + ' ' + esc(f));
            });
            break;
          case 'cat':
          case 'type':
            if (!args[1]) { line('用法: cat &lt;文件&gt;', 'term-error'); break; }
            if (window.SITE.terminalFiles[args[1]]) line(esc(window.SITE.terminalFiles[args[1]]).replace(/\n/g, '<br>'));
            else line('找不到文件：' + esc(args[1]), 'term-error');
            break;
          case 'neofetch': {
            var logo = [
              '▓▓  ▓▓',
              '▓▓  ▓▓',
              '      ',
              '▓▓  ▓▓',
              '▓▓  ▓▓',
              '      ',
              '      '
            ];
            var info = [
              'aiden@win11-home',
              '---------------------',
              'OS: Debian 13 (trixie) aarch64',
              'Host: Raspberry Pi 4 Model B',
              'Kernel: 6.18.50+rpt-rpi-v8',
              'Shell: nginx + 自写窗口管理器',
              'Domain: ' + esc(window.SITE.profile.domain),
              'Uptime: 一直在线',
              'Theme: ' + Win.prefs.themeMode
            ];
            for (var ni = 0; ni < info.length; ni++) {
              line('<span class="term-accent">' + (logo[ni] || '      ') + '</span>  ' + info[ni]);
            }
            break;
          }
          case 'theme':
            if (['dark', 'light', 'auto'].indexOf(args[1]) > -1) { Win.setPref('themeMode', args[1]); line('已切换主题：' + args[1], 'term-dim'); }
            else line('用法: theme dark|light|auto', 'term-error');
            break;
          case 'window':
            line('浏览器窗口：' + window.innerWidth + ' × ' + window.innerHeight + '，像素比 ' + (window.devicePixelRatio || 1), 'term-dim');
            break;
          case 'date':
            line(new Date().toString());
            break;
          case 'echo':
            line(esc(args.slice(1).join(' ')));
            break;
          case 'clear':
          case 'cls':
            out.innerHTML = '';
            break;
          case 'sudo':
            line('sudo: 这里没有 root，只有一张网页。', 'term-error');
            break;
          case 'ping':
            line('PING ' + esc(args[1] || 'studentop.cn') + '：浏览器里没有 ICMP，但到本站的 TCP 连接一直开着 :)', 'term-dim');
            break;
          case 'exit':
            ctx.close();
            break;
          default:
            line('无法将「' + esc(args[0]) + '」识别为 cmdlet、函数、脚本文件或可运行程序的名称。', 'term-error');
            line('输入 <b>help</b> 看看能做什么。', 'term-dim');
        }
      }

      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          var v = input.value;
          if (v.trim()) { history.push(v); hIndex = history.length; }
          run(v);
          input.value = '';
          e.preventDefault();
        } else if (e.key === 'ArrowUp') {
          if (!history.length) return;
          hIndex = Math.max(0, hIndex - 1);
          input.value = history[hIndex] || '';
          e.preventDefault();
        } else if (e.key === 'ArrowDown') {
          if (!history.length) return;
          hIndex = Math.min(history.length, hIndex + 1);
          input.value = history[hIndex] || '';
          e.preventDefault();
        } else if (e.key === 'l' && e.ctrlKey) {
          out.innerHTML = '';
          e.preventDefault();
        }
      });
      termBody.addEventListener('click', function (e) {
        if (e.target.closest('a')) return;
        if (window.getSelection().toString()) return;
        input.focus();
      });
      body.querySelector('.term-tab-close').addEventListener('click', function (e) {
        e.stopPropagation();
        var last = out.querySelector('.term-line');
        line('^C', 'term-dim');
      });
      body.querySelector('.term-newtab').addEventListener('click', function () {
        line('已经有一个终端了，再开一个也是同一张网页 :)', 'term-dim');
      });
      setTimeout(function () { input.focus(); }, 80);
    }
  });

  /* ======================= 记事本 ======================= */
  defs.push({
    id: 'notepad',
    title: '记事本',
    desktopLabel: '记事本',
    icon: 'notepad',
    keywords: 'notepad 记事本 文本 说明 欢迎',
    width: 760,
    height: 560,
    minWidth: 480,
    minHeight: 320,
    render: function (body, ctx) {
      var text = [
        '写给第一次来到这个主页的你',
        '',
        '这个页面不是真的 Windows。',
        '它是一张用 HTML、CSS 和一点点 JavaScript 手写的网页：',
        '窗口可以拖动、可以贴边分屏，任务栏和开始菜单也都是真的能点的。',
        '',
        '建议你试试：',
        '  1. 双击桌面上任意图标；',
        '  2. 把某个窗口拖到屏幕边缘，看它会不会自动分屏；',
        '  3. 点右下角的时间，看看日历和通知；',
        '  4. 打开「终端」，敲一句 help。',
        '',
        '如果你发现了什么有趣的 bug，欢迎写信告诉我。',
        '',
        '—— Aiden',
        new Date().getFullYear() + ' 年'
      ].join('\n');

      body.innerHTML =
        '<div class="notepad-app">' +
          '<div class="np-toolbar">' +
            '<button type="button" class="np-btn" id="npNew">' + ICONS.glyph('file') + '<span>新建</span></button>' +
            '<button type="button" class="np-btn" id="npSave">' + ICONS.glyph('download') + '<span>保存</span></button>' +
            '<span class="np-spacer"></span>' +
            '<span class="np-count" id="npCount">0 字</span>' +
          '</div>' +
          '<div class="np-tabs"><span class="np-tab is-active">' + ICONS.glyph('file') + '<span>写给访客.txt</span></span></div>' +
          '<div class="np-editor" id="npEditor" contenteditable="true" spellcheck="false"></div>' +
          '<div class="np-status"><span>UTF-8</span><span>Windows (CRLF)</span><span>第 1 行，第 1 列</span></div>' +
        '</div>';

      var editor = body.querySelector('#npEditor');
      var count = body.querySelector('#npCount');
      editor.textContent = text;
      function updateCount() {
        var t = editor.innerText || '';
        count.textContent = t.replace(/\s/g, '').length + ' 字';
      }
      editor.addEventListener('input', updateCount);
      updateCount();

      body.querySelector('#npNew').addEventListener('click', function () {
        editor.textContent = '';
        updateCount();
        Win.notify({ icon: 'notepad', title: '新建了一个空白文档', body: '随便写点什么吧。' });
      });
      body.querySelector('#npSave').addEventListener('click', function () {
        var blob = new Blob([editor.innerText || ''], { type: 'text/plain;charset=utf-8' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = '写给访客.txt';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); document.body.removeChild(a); }, 100);
        Win.notify({ icon: 'download', title: '已保存到下载文件夹', body: '写给访客.txt' });
      });
    }
  });

  /* ======================= 照片 ======================= */
  defs.push({
    id: 'photos',
    title: '照片',
    desktopLabel: '照片',
    icon: 'photos',
    keywords: 'photos 照片 壁纸 相册 图片 画廊',
    width: 940,
    height: 640,
    minWidth: 620,
    minHeight: 420,
    render: function (body, ctx) {
      var walls = window.SITE.wallpapers || [];
      body.innerHTML =
        '<div class="app photos-app">' +
          '<div class="app-toolbar"><div class="app-hero-text" style="margin:0"><h2 style="margin:0 0 4px">壁纸收藏</h2>' +
            '<p style="margin:0">这些壁纸都是为这个主页画的，点开可以设为桌面背景。</p></div>' +
            '<div class="toolbar-meta">' + walls.length + ' 张</div></div>' +
          '<div class="photo-grid">' +
            walls.map(function (w) {
              return '<figure class="photo-card" data-wall="' + w.id + '">' +
                '<div class="photo-img" style="' + (w.thumb ? 'background-image:url(' + esc(w.thumb) + ')' : 'background:linear-gradient(160deg,#0f172a,#334155)') + '"></div>' +
                '<figcaption><span>' + esc(w.name) + '</span><button type="button" class="btn btn-small" data-set-wall="' + w.id + '">设为壁纸</button></figcaption>' +
              '</figure>';
            }).join('') +
          '</div>' +
        '</div>';
      body.querySelectorAll('[data-set-wall]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          Win.setPref('wall', btn.getAttribute('data-set-wall'));
          Win.notify({ icon: 'photos', title: '壁纸已更换', body: '看看桌面，是不是换了心情。' });
        });
      });
      body.querySelectorAll('.photo-card').forEach(function (card) {
        card.addEventListener('click', function (e) {
          if (e.target.closest('[data-set-wall]')) return;
          var overlay = document.createElement('div');
          overlay.className = 'photo-lightbox';
          overlay.innerHTML = '<div class="pl-img" style="background-image:url(' + esc(card.querySelector('.photo-img').style.backgroundImage.replace(/^url\(["']?|["']?\)$/g, '')) + ')"></div>' +
            '<button type="button" class="pl-close" aria-label="关闭">' + ICONS.glyph('close') + '</button>';
          overlay.addEventListener('click', function () { overlay.remove(); });
          body.appendChild(overlay);
        });
      });
    }
  });

  /* ======================= 回收站 ======================= */
  defs.push({
    id: 'recycle',
    title: '回收站',
    desktopLabel: '回收站',
    icon: 'recycle',
    keywords: 'recycle 回收站 垃圾 删除',
    width: 720,
    height: 500,
    minWidth: 480,
    minHeight: 320,
    render: function (body) {
      body.innerHTML =
        '<div class="recycle-app">' +
          '<div class="recycle-toolbar"><button type="button" class="exp-btn exp-primary" disabled>' + ICONS.glyph('refresh') + '<span>清空回收站</span></button>' +
            '<span class="exp-sep"></span><button type="button" class="exp-btn" disabled>还原所有项目</button>' +
            '<span class="exp-spacer"></span><span class="exp-muted">0 个项目</span></div>' +
          '<div class="recycle-empty">' + ICONS.app('recycle') +
            '<h2>回收站是空的</h2><p>这里没有东西可以清理，就像我的待办列表一样。</p>' +
            '<button type="button" class="btn" id="recycleJoke">' + ICONS.glyph('sparkle') + '骗你的，看看待办</button>' +
          '</div>' +
        '</div>';
      body.querySelector('#recycleJoke').addEventListener('click', function () {
        Win.notify({ icon: 'notepad', title: '其实是有待办的', body: '打开「记事本」或者终端输入 cat todo.txt 看看。' });
      });
    }
  });

})();
