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
    render: function (body, ctx) {
      var folders = [
        { app: 'projects', name: '项目作品', sub: (window.SITE.projects || []).length + ' 个项目' },
        { app: 'skills', name: '技能', sub: (window.SITE.skills || []).length + ' 个分类' },
        { app: 'contact', name: '联系我', sub: '写封邮件' },
        { app: 'cv', name: '简历', sub: '一页纸版本' },
        { app: 'notepad', name: '记事本', sub: '浏览器内保存' },
        { app: 'photos', name: '照片', sub: '壁纸收藏' },
        { app: 'terminal', name: '模拟终端', sub: '仅本站命令' },
        { app: 'settings', name: '设置', sub: '网页外观' }
      ];
      var view = 'all', search = '', sortAscending = true, listView = false, history = ['all'], historyIndex = 0;
      body.innerHTML = '<div class="app explorer-app">' +
        '<div class="exp-toolbar"><button type="button" class="exp-btn exp-primary" id="expNew">' + ICONS.glyph('plus') + '新建便笺</button>' +
        '<button type="button" class="exp-btn" id="expImport">打开本机文本</button><input type="file" id="expFile" accept="text/*,.txt,.md,.json,.csv,.js,.css" hidden>' +
        '<span class="exp-spacer"></span><button type="button" class="exp-btn" id="expSort">名称 ↑</button><button type="button" class="exp-btn" id="expView">列表视图</button></div>' +
        '<div class="exp-pathbar"><button type="button" class="nav-btn" id="expBack" aria-label="后退">' + ICONS.glyph('arrow-left') + '</button>' +
        '<button type="button" class="nav-btn" id="expForward" aria-label="前进">' + ICONS.glyph('arrow-right') + '</button>' +
        '<div class="address-bar">' + ICONS.glyph('home') + '<span id="expPath">网页目录</span></div>' +
        '<div class="exp-search">' + ICONS.glyph('search') + '<input type="search" placeholder="搜索网页目录" aria-label="搜索网页目录"></div></div>' +
        '<div class="exp-main"><nav class="exp-nav" aria-label="网页目录"><div class="nav-group">本站内容</div>' +
        [['all', '全部'], ['apps', '应用'], ['files', '文本文件']].map(function (item) { return '<button type="button" class="nav-item" data-view="' + item[0] + '">' + ICONS.glyph('folder') + '<span>' + item[1] + '</span></button>'; }).join('') +
        '</nav><div class="exp-content"><p class="app-hint">这是网页内的内容目录，不会扫描磁盘或连接系统网络。只有你主动选择的文本文件才会在本浏览器读取（最多 1 MB）。</p><div class="folder-grid" id="expItems"></div></div></div>' +
        '<div class="exp-status"><span id="expCount"></span><span>本浏览器 · 不上传文件</span></div></div>';
      function openText(text, name) { var win = WM.launch('notepad'); if (win && win.openText) win.openText(text, name); }
      function navigate(next, fromHistory) {
        view = next;
        if (!fromHistory) { history = history.slice(0, historyIndex + 1); history.push(next); historyIndex++; }
        render();
      }
      function render() {
        var files = Object.keys(window.SITE.terminalFiles || {}).map(function (name) { return { name: name, text: String(window.SITE.terminalFiles[name]), sub: '本站只读文本', icon: 'notepad' }; });
        var saved = Win.store.get('notepad.document', null);
        if (saved && typeof saved.text === 'string') files.unshift({ name: typeof saved.name === 'string' ? saved.name : '便笺.txt', text: saved.text, sub: '浏览器保存的便笺', icon: 'notepad' });
        var entries = (view === 'files' ? [] : folders).concat(view === 'apps' ? [] : files).filter(function (entry) { return (entry.name + ' ' + entry.sub).toLowerCase().indexOf(search) !== -1; });
        entries.sort(function (a, b) { return a.name.localeCompare(b.name, 'zh-CN') * (sortAscending ? 1 : -1); });
        var grid = body.querySelector('#expItems'); grid.innerHTML = ''; grid.classList.toggle('is-list', listView);
        entries.forEach(function (entry) {
          var button = document.createElement('button'); button.type = 'button'; button.className = 'folder-item';
          button.innerHTML = '<span class="folder-icon">' + ICONS.app(entry.app ? (Win.apps[entry.app] || {}).icon : 'notepad') + '</span><span class="folder-name">' + esc(entry.name) + '</span><span class="folder-sub">' + esc(entry.sub) + '</span>';
          if (entry.app) button.dataset.openApp = entry.app;
          else button.dataset.fileName = entry.name;
          button.addEventListener('click', function () { if (entry.app) WM.launch(entry.app); else openText(entry.text, entry.name); }); grid.appendChild(button);
        });
        if (!entries.length) grid.innerHTML = '<p class="empty-state">没有匹配的内容。</p>';
        body.querySelector('#expCount').textContent = entries.length + ' 个项目';
        body.querySelector('#expPath').textContent = '网页目录 / ' + ({ all: '全部', apps: '应用', files: '文本文件' })[view];
        body.querySelector('#expBack').disabled = historyIndex === 0; body.querySelector('#expForward').disabled = historyIndex === history.length - 1;
        body.querySelectorAll('[data-view]').forEach(function (button) { button.classList.toggle('is-active', button.dataset.view === view); button.setAttribute('aria-current', button.dataset.view === view ? 'page' : 'false'); });
      }
      body.querySelectorAll('[data-view]').forEach(function (button) { button.addEventListener('click', function () { navigate(button.dataset.view); }); });
      body.querySelector('#expBack').addEventListener('click', function () { if (historyIndex > 0) navigate(history[--historyIndex], true); });
      body.querySelector('#expForward').addEventListener('click', function () { if (historyIndex < history.length - 1) navigate(history[++historyIndex], true); });
      body.querySelector('.exp-search input').addEventListener('input', function (e) { search = e.target.value.trim().toLowerCase(); render(); });
      body.querySelector('#expNew').addEventListener('click', function () { var win = WM.launch('notepad'); if (win && win.newDocument) win.newDocument(); });
      body.querySelector('#expSort').addEventListener('click', function (e) { sortAscending = !sortAscending; e.currentTarget.textContent = '名称 ' + (sortAscending ? '↑' : '↓'); render(); });
      body.querySelector('#expView').addEventListener('click', function (e) { listView = !listView; e.currentTarget.textContent = listView ? '图标视图' : '列表视图'; render(); });
      var fileInput = body.querySelector('#expFile');
      body.querySelector('#expImport').addEventListener('click', function () { fileInput.click(); });
      fileInput.addEventListener('change', function () {
        var file = fileInput.files[0]; if (!file) return;
        if (file.size > 1024 * 1024) { Win.notify({ icon: 'info', title: '文件过大', body: '请选择不超过 1 MB 的文本文件。' }); fileInput.value = ''; return; }
        var reader = new FileReader();
        reader.onload = function () { if (body.isConnected) openText(String(reader.result || ''), file.name); };
        reader.onerror = function () { Win.notify({ icon: 'info', title: '读取失败', body: '未能读取你选择的文本文件。' }); };
        reader.readAsText(file); fileInput.value = '';
      });
      ctx.win.dispose = Win.bus.on('notepad:saved', render);
      render();
    }
  });

  /* ======================= 设置 ======================= */
  var ACCENTS = ['#28776b', '#a88a4a', '#ad4e3f', '#0067c0', '#0078d4', '#4cc2ff', '#8764b8', '#c239b3', '#e3008c', '#ef6950', '#c23934', '#498205', '#00b294'];

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
            '<div class="set-user"><span class="avatar lg">' + Win.avatarMarkup() + '</span>' +
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
        var active = document.activeElement;
        var focusKey = active && bodyEl.contains(active) ? ['id', 'data-wall', 'data-accent', 'data-value'].map(function (key) { return [key, active.getAttribute(key)]; }).filter(function (pair) { return pair[1] !== null; })[0] : null;
        if (pane === 'personalize') {
          bodyEl.innerHTML =
            '<section class="set-section"><h2>背景</h2>' +
              '<div class="wall-grid">' +
                (window.SITE.wallpapers || []).map(function (w) {
                  return '<button type="button" class="wall-tile' + (Win.prefs.wall === w.id ? ' is-active' : '') + '" data-wall="' + esc(w.id) + '" aria-pressed="' + (Win.prefs.wall === w.id) + '">' +
                    '<span class="wall-thumb"></span>' +
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
              '<div class="set-row"><div class="set-row-label"><span>动画效果</span><span class="set-row-sub">关闭动画；开启时仍遵从系统的减少动态偏好</span></div>' +
                '<button type="button" class="switch' + (Win.prefs.motion ? ' is-on' : '') + '" id="motionSwitch" role="switch" aria-label="动画效果" aria-checked="' + (Win.prefs.motion ? 'true' : 'false') + '"><span></span></button>' +
              '</div>' +
            '</section>' +
            '<section class="set-section"><h2>重置</h2>' +
              '<div class="set-row"><div class="set-row-label"><span>恢复默认外观</span><span class="set-row-sub">壁纸、主题、主题色和任务栏对齐都会还原</span></div>' +
                '<button type="button" class="btn" id="resetPrefs">' + ICONS.glyph('refresh') + '重置</button>' +
              '</div>' +
            '</section>';

          bodyEl.querySelectorAll('.wall-tile').forEach(function (tile) {
            var wall = (window.SITE.wallpapers || []).filter(function (item) { return item.id === tile.dataset.wall; })[0];
            var url = wall && Win.safeUrl(wall.thumb || Win.wallpaperUrl(wall.id));
            if (url) tile.querySelector('.wall-thumb').style.backgroundImage = 'url(' + JSON.stringify(url) + ')';
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
          if (lockNow) lockNow.addEventListener('click', function () { Win.showLock(); });
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
                '<div class="tech-item"><span class="tech-key">体积</span><span class="tech-val">原生静态资源，本地字体与图片；项目外链按需打开</span></div>' +
              '</div>' +
              '<div class="about-links-inline">' +
                '<a class="btn" href="mailto:' + esc(window.SITE.profile.email) + '">' + ICONS.glyph('mail') + '写邮件</a>' +
                '<a class="btn" href="https://github.com/AnonymousUser443" target="_blank" rel="noopener noreferrer">' + ICONS.glyph('github') + 'GitHub</a>' +
              '</div>' +
            '</section>';
        }
        bodyEl.querySelectorAll('.seg').forEach(function (button) { button.setAttribute('aria-pressed', String(button.classList.contains('is-active'))); });
        bodyEl.querySelectorAll('.accent-dot').forEach(function (button) { button.setAttribute('aria-pressed', String(button.classList.contains('is-active'))); });
        if (focusKey) {
          var candidate = Array.prototype.slice.call(bodyEl.querySelectorAll('button')).filter(function (button) { return button.getAttribute(focusKey[0]) === focusKey[1]; })[0];
          if (candidate) candidate.focus({ preventScroll: true });
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
    title: '模拟终端',
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
          '<div class="term-tabs"><button type="button" class="term-tab is-active">' + ICONS.app('terminal') + '<span>模拟终端</span>' +
            '<span class="term-tab-close" aria-hidden="true">' + ICONS.glyph('close') + '</span></button><button type="button" class="term-newtab" disabled title="模拟终端仅提供一个会话">+</button></div>' +
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
      line('本站模拟终端 · 不执行系统命令，不连接远程设备', 'term-dim');
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
              'Uptime: 网页演示（不读取服务器运行时间）',
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
            line('PING ' + esc(args[1] || 'studentop.cn') + '：此模拟终端不会发送 ICMP 或网络探测请求。', 'term-dim');
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

        }
      });
      termBody.addEventListener('click', function (e) {
        if (e.target.closest('a')) return;
        if (window.getSelection().toString()) return;
        input.focus();
      });
      body.querySelector('.term-tab-close').addEventListener('click', function (e) {
        e.stopPropagation();
        ctx.close();
      });
      body.querySelector('.term-newtab').addEventListener('click', function () {
        line('已经有一个终端了，再开一个也是同一张网页 :)', 'term-dim');
      });
      setTimeout(function () { if (input.isConnected && WM.activeWin() === ctx.win && !Win.isLocked()) input.focus(); }, 80);
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

      var saved = Win.store.get('notepad.document', null);
      var filename = cleanName(saved && typeof saved.name === 'string' ? saved.name : '写给访客.txt');
      if (saved && typeof saved.text === 'string') text = saved.text;
      var baseline = text, dirty = false, imported = false;
      body.innerHTML = '<div class="notepad-app">' +
        '<div class="np-toolbar"><button type="button" class="np-btn" id="npNew">' + ICONS.glyph('file') + '<span>新建</span></button>' +
        '<button type="button" class="np-btn" id="npSave" title="保存到本浏览器；编辑区 Ctrl+S">' + ICONS.glyph('check') + '<span>保存</span></button>' +
        '<button type="button" class="np-btn" id="npDownload">' + ICONS.glyph('download') + '<span>下载 .txt</span></button>' +
        '<span class="np-spacer"></span><span class="np-count" id="npCount">0 字</span></div>' +
        '<div class="np-tabs"><span class="np-tab is-active">' + ICONS.glyph('file') + '<span class="np-filename"></span></span><span class="np-save-state" role="status" aria-live="polite"></span></div>' +
        '<textarea class="np-editor" id="npEditor" aria-label="记事本文本" spellcheck="false"></textarea>' +
        '<div class="np-status"><span>UTF-8 · 本浏览器</span><span>LF</span><span id="npPosition">第 1 行，第 1 列</span></div></div>';
      var editor = body.querySelector('#npEditor'), count = body.querySelector('#npCount'), status = body.querySelector('.np-save-state');
      editor.value = text;
      function onBeforeUnload(e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } }
      function update() {
        var wasDirty = dirty;
        dirty = imported || editor.value !== baseline;
        if (dirty && !wasDirty) window.addEventListener('beforeunload', onBeforeUnload);
        if (!dirty && wasDirty) window.removeEventListener('beforeunload', onBeforeUnload);
        count.textContent = editor.value.replace(/\s/g, '').length + ' 字';
        body.querySelector('.np-filename').textContent = filename + (dirty ? ' *' : '');
        status.textContent = dirty ? '有未保存更改' : '无未保存更改';
        ctx.setTitle((dirty ? '* ' : '') + filename + ' — 记事本');
        updatePosition();
      }
      function updatePosition() {
        var before = editor.value.slice(0, editor.selectionStart || 0).split('\n');
        body.querySelector('#npPosition').textContent = '第 ' + before.length + ' 行，第 ' + (before[before.length - 1].length + 1) + ' 列';
      }
      function canDiscard() { return !dirty || window.confirm('这个便笺有未保存的更改。确定放弃更改吗？取消后可先保存到浏览器或下载文本。'); }
      function cleanName(name) { return String(name || '未命名.txt').replace(/[\\/\u0000-\u001f]/g, '_').slice(0, 120) || '未命名.txt'; }
      function loadDocument(value, name, isImport) {
        if (!canDiscard()) return false;
        editor.value = String(value); filename = cleanName(name); baseline = isImport ? '' : editor.value; imported = !!isImport;
        update(); editor.focus(); return true;
      }
      function newDocument() { return loadDocument('', '未命名.txt', false); }
      function save() {
        var persistent = Win.store.set('notepad.document', { name: filename, text: editor.value });
        if (persistent) {
          baseline = editor.value; imported = false; update(); status.textContent = '已保存到本浏览器';
          Win.bus.emit('notepad:saved');
          Win.notify({ icon: 'notepad', title: '便笺已保存到本浏览器', body: '清除站点数据会移除它；重要内容请另行下载。' });
        } else {
          imported = true; update(); status.textContent = '浏览器存储不可用，请下载';
          Win.notify({ icon: 'info', title: '无法持久保存', body: '当前内容暂留在本次访问的内存中，刷新可能丢失。请下载文本备份。' });
        }
      }
      editor.addEventListener('input', update);
      editor.addEventListener('click', updatePosition); editor.addEventListener('keyup', updatePosition); editor.addEventListener('select', updatePosition);
      editor.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 's') { e.preventDefault(); e.stopPropagation(); save(); }
      });
      body.querySelector('#npNew').addEventListener('click', newDocument);
      body.querySelector('#npSave').addEventListener('click', save);
      body.querySelector('#npDownload').addEventListener('click', function () {
        var url, anchor;
        try {
          url = URL.createObjectURL(new Blob([editor.value], { type: 'text/plain;charset=utf-8' }));
          anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
          setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
          status.textContent = '已请求下载，请在浏览器中确认';
          Win.notify({ icon: 'download', title: '已请求浏览器下载', body: filename + '。网页无法确认文件是否已写入磁盘；本地保存状态不变。' });
        } catch (e) {
          if (anchor) anchor.remove(); if (url) URL.revokeObjectURL(url);
          Win.notify({ icon: 'info', title: '未能创建下载', body: '请复制文本备份后再关闭。' });
        }
      });
      ctx.win.isDirty = function () { return dirty; };
      ctx.win.beforeClose = canDiscard;
      ctx.win.dispose = function () { window.removeEventListener('beforeunload', onBeforeUnload); };
      ctx.win.openText = function (value, name) { return loadDocument(value, name, true); };
      ctx.win.newDocument = newDocument;
      update();
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
      var walls = window.SITE.wallpapers || [], lightbox = null;
      body.innerHTML = '<div class="app photos-app"><div class="app-toolbar"><div class="app-hero-text"><h2>壁纸收藏</h2><p>打开可查看完整图片；左右键切换，Esc 关闭。素材说明以站点资产清单为准。</p></div><div class="toolbar-meta">' + walls.length + ' 张</div></div>' +
        '<div class="photo-grid">' + walls.map(function (w, index) {
          return '<figure class="photo-card" data-wall="' + esc(w.id) + '"><button type="button" class="photo-open" data-photo="' + index + '" aria-label="查看 ' + esc(w.name) + '"><span class="photo-img"></span></button>' +
            '<figcaption><span>' + esc(w.name) + '</span><button type="button" class="btn btn-small" data-set-wall="' + esc(w.id) + '">设为壁纸</button></figcaption></figure>';
        }).join('') + '</div></div>';
      body.querySelectorAll('[data-photo]').forEach(function (button, index) {
        var url = Win.safeUrl(walls[index].thumb || Win.wallpaperUrl(walls[index].id));
        if (url) button.querySelector('.photo-img').style.backgroundImage = 'url(' + JSON.stringify(url) + ')';
        button.addEventListener('click', function () { openPhoto(index, button); });
      });
      body.querySelectorAll('[data-set-wall]').forEach(function (button) {
        button.addEventListener('click', function () { Win.setPref('wall', button.dataset.setWall); Win.notify({ icon: 'photos', title: '壁纸已更换', body: '桌面与锁屏背景已同步。' }); });
      });
      function openPhoto(index, trigger) {
        if (!walls.length) return;
        if (lightbox) lightbox.remove();
        var overlay = document.createElement('div'); lightbox = overlay; overlay.className = 'photo-lightbox'; overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-label', '壁纸预览');
        overlay.innerHTML = '<img class="pl-img" alt=""><button type="button" class="pl-close" aria-label="关闭预览">' + ICONS.glyph('close') + '</button>' +
          '<button type="button" class="pl-prev" aria-label="上一张">' + ICONS.glyph('chevron-left') + '</button><button type="button" class="pl-next" aria-label="下一张">' + ICONS.glyph('chevron-right') + '</button><span class="pl-caption" role="status"></span>';
        function render() {
          var w = walls[index], image = overlay.querySelector('img'); image.src = Win.wallpaperUrl(w.id); image.alt = w.name + ' 壁纸';
          overlay.querySelector('.pl-caption').textContent = w.name + ' · ' + (index + 1) + ' / ' + walls.length;
        }
        function close() { overlay.remove(); lightbox = null; if (trigger.isConnected) trigger.focus(); }
        function next(delta) { index = (index + delta + walls.length) % walls.length; render(); }
        overlay.querySelector('.pl-close').addEventListener('click', close);
        overlay.querySelector('.pl-prev').addEventListener('click', function () { next(-1); }); overlay.querySelector('.pl-next').addEventListener('click', function () { next(1); });
        overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
        overlay.addEventListener('keydown', function (e) {
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); next(e.key === 'ArrowLeft' ? -1 : 1); }
          if (e.key === 'Tab') { var buttons = Array.prototype.slice.call(overlay.querySelectorAll('button')); var pos = buttons.indexOf(document.activeElement); e.preventDefault(); buttons[(pos + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus(); }
        });
        body.appendChild(overlay); render(); overlay.querySelector('.pl-close').focus();
      }
      ctx.win.dispose = function () { if (lightbox) lightbox.remove(); };
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
