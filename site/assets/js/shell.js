/* =====================================================================
   外壳：桌面图标 / 任务栏 / 开始菜单 / 搜索 / 日历通知 / 右键菜单 / 任务视图
   ===================================================================== */
window.Shell = (function () {
  'use strict';

  var state = {
    startOpen: false,
    searchOpen: false,
    calOpen: false,
    taskViewOpen: false,
    startFilter: '',
    calMonth: new Date()
  };
  var flyoutHost;

  /* ================= 通用 ================= */
  function appDef(id) { return (window.Win.apps || {})[id] || null; }

  function closeTarget(id) {
    var node = (flyoutHost || document).querySelector('[data-flyout="' + id + '"]');
    if (!node) return;
    node.classList.add('is-closing');
    setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 130);
  }

  function closeFlyouts(except) {
    ['start', 'search', 'calendar', 'context', 'taskview'].forEach(function (id) {
      if (id !== except) closeTarget(id);
    });
    state.startOpen = false;
    state.searchOpen = false;
    state.calOpen = false;
    state.taskViewOpen = false;
  }

  /* ================= 桌面图标 ================= */
  var selectedIcon = null;

  function renderDesktop() {
    var host = document.getElementById('desktopIcons');
    if (!host) return;
    host.innerHTML = '';
    (window.SITE.desktop || []).forEach(function (appId) {
      var app = appDef(appId);
      if (!app) return;
      var node = document.createElement('button');
      node.className = 'desktop-icon' + (app.external ? ' is-shortcut' : '');
      node.type = 'button';
      if (app.external) node.title = app.shortcutHint || app.external;
      node.dataset.app = appId;
      node.setAttribute('aria-label', app.title);
      node.innerHTML = '<span class="di-icon">' + ICONS.app(app.icon) + '</span>' +
        '<span class="di-label">' + Win.esc(app.desktopLabel || app.title) + '</span>';
      node.addEventListener('click', function () {
        selectIcon(node);
        if (Win.isMobile()) launchApp(appId);
      });
      node.addEventListener('dblclick', function (e) { e.preventDefault(); launchApp(appId); });
      node.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        selectIcon(node);
        openIconMenu(appId, e.clientX, e.clientY);
      });
      host.appendChild(node);
    });
  }

  function selectIcon(node) {
    if (selectedIcon) selectedIcon.classList.remove('is-selected');
    selectedIcon = node;
    if (node) node.classList.add('is-selected');
  }

  function launchApp(appId) {
    if (!appDef(appId)) {
      Win.notify({ icon: 'info', title: '这个应用还在建设中', body: '换个图标试试？' });
      return;
    }
    WM.launch(appId);
    closeFlyouts();
  }

  /* ================= 任务栏 ================= */
  function tbButton(appId) {
    var app = appDef(appId);
    if (!app) return null;
    var btn = document.createElement('button');
    btn.className = 'tb-btn';
    btn.type = 'button';
    btn.dataset.taskbarApp = appId;
    btn.setAttribute('aria-label', app.title);
    btn.title = app.title;
    btn.innerHTML = ICONS.app(app.icon) + '<span class="indicator"></span>';
    btn.addEventListener('click', function () {
      var running = WM.byApp(appId).filter(function (w) { return w.state !== 'closed'; });
      if (!running.length) { WM.launch(appId); return; }
      var top = running[running.length - 1];
      if (WM.isActiveApp(appId) && top.state !== 'min') {
        WM.minimize(top);
      } else if (top.state === 'min') {
        WM.restore(top);
        WM.focus(top);
      } else {
        WM.focus(top);
      }
    });
    return btn;
  }

  function renderTaskbarCenter() {
    var host = document.getElementById('tbCenter');
    if (!host) return;
    host.innerHTML = '';

    var startBtn = document.createElement('button');
    startBtn.className = 'tb-btn tb-start';
    startBtn.type = 'button';
    startBtn.id = 'startBtn';
    startBtn.setAttribute('aria-label', '开始');
    startBtn.title = '开始';
    startBtn.innerHTML = ICONS.app('start');
    startBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleStart(); });
    host.appendChild(startBtn);

    var searchBtn = document.createElement('button');
    searchBtn.className = 'tb-btn';
    searchBtn.type = 'button';
    searchBtn.id = 'searchBtn';
    searchBtn.setAttribute('aria-label', '搜索');
    searchBtn.title = '搜索';
    searchBtn.innerHTML = ICONS.glyph('search');
    searchBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleSearch(); });
    host.appendChild(searchBtn);

    var viewBtn = document.createElement('button');
    viewBtn.className = 'tb-btn';
    viewBtn.type = 'button';
    viewBtn.id = 'taskViewBtn';
    viewBtn.setAttribute('aria-label', '任务视图');
    viewBtn.title = '任务视图';
    viewBtn.innerHTML = ICONS.glyph('taskview');
    viewBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleTaskView(); });
    host.appendChild(viewBtn);

    var pinned = (window.SITE.taskbarPinned || []).slice();
    if (Window_PINNED_EXTRA.length) {
      Window_PINNED_EXTRA.forEach(function (id) { if (pinned.indexOf(id) === -1) pinned.push(id); });
    }
    pinned.forEach(function (appId) {
      var btn = tbButton(appId);
      if (btn) host.appendChild(btn);
    });
    syncTaskbar();
  }

  var Window_PINNED_EXTRA = [];

  function syncTaskbar() {
    var host = document.getElementById('tbCenter');
    if (!host) return;
    var btns = Array.prototype.slice.call(host.querySelectorAll('[data-taskbar-app]'));
    var need = [];

    // 正在运行但未固定的应用，追加到任务栏
    WM.list().forEach(function (w) {
      if (!btns.some(function (b) { return b.dataset.taskbarApp === w.appId; }) && need.indexOf(w.appId) === -1) need.push(w.appId);
    });
    need.forEach(function (appId) {
      var btn = tbButton(appId);
      if (btn) { host.appendChild(btn); btns.push(btn); }
    });

    btns.forEach(function (btn) {
      var appId = btn.dataset.taskbarApp;
      var running = WM.byApp(appId).filter(function (w) { return w.state !== 'closed'; });
      var isRunning = running.length > 0;
      var isActive = WM.isActiveApp(appId) && running.some(function (w) { return w.state !== 'min'; });
      btn.classList.toggle('is-running', isRunning);
      btn.classList.toggle('is-active', isActive);
      if (running[0]) running[0].taskbarBtn = btn;
    });
  }

  function renderTray() {
    var icons = document.getElementById('trayIcons');
    if (icons) {
      icons.innerHTML = '<span style="display:flex;align-items:center;gap:8px">' +
        ICONS.glyph('wifi') + ICONS.glyph('volume') + ICONS.glyph('battery') + '</span>';
      icons.style.display = 'flex';
    }
    var notifIcon = document.getElementById('notifIcon');
    if (notifIcon) notifIcon.innerHTML = ICONS.glyph('bell');
  }

  function initClock() {
    var t = document.getElementById('clockTime');
    var d = document.getElementById('clockDate');
    function update() {
      var now = new Date();
      if (t) t.textContent = Win.fmtTime(now);
      if (d) d.textContent = Win.fmtDateTaskbar(now);
    }
    update();
    setInterval(update, 1000);
    var clockBtn = document.getElementById('trayClock');
    if (clockBtn) clockBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleCalendar(); });
    var notifBtn = document.getElementById('notifBtn');
    if (notifBtn) notifBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleCalendar(); });
  }

  /* ================= 开始菜单 ================= */
  function buildStartMenu() {
    var menu = document.createElement('div');
    menu.className = 'start-menu';
    menu.dataset.flyout = 'start';
    menu.setAttribute('role', 'menu');
    menu.addEventListener('pointerdown', function (e) { e.stopPropagation(); });

    var search = document.createElement('div');
    search.className = 'start-search';
    search.innerHTML = ICONS.glyph('search') +
      '<input type="text" id="startSearchInput" placeholder="搜索应用、文件和网页" autocomplete="off" spellcheck="false" aria-label="搜索">';
    menu.appendChild(search);

    var body = document.createElement('div');
    body.className = 'start-menu-body';
    menu.appendChild(body);

    var footer = document.createElement('div');
    footer.className = 'start-footer';
    footer.innerHTML =
      '<button class="start-user" type="button">' +
        '<span class="avatar">' + Win.esc(window.SITE.profile.avatarText || 'A') + '</span>' +
        '<span class="su-name">' + Win.esc(window.SITE.profile.name) + '</span>' +
      '</button>' +
      '<button class="start-power" type="button" aria-label="电源" title="电源">' + ICONS.glyph('power') + '</button>';
    menu.appendChild(footer);

    footer.querySelector('.start-user').addEventListener('click', function () { launchApp('about'); });
    footer.querySelector('.start-power').addEventListener('click', function (e) {
      var r = e.currentTarget.getBoundingClientRect();
      openContextMenu([
        { icon: 'lock', label: '锁定', action: function () { Win.showLock(); } },
        { icon: 'moon', label: '睡眠', action: function () { Win.showLock(); } },
        { sep: true },
        { icon: 'refresh', label: '重新启动', action: function () { location.reload(); } },
        { icon: 'power', label: '关机', action: function () {
          Win.notify({ icon: 'power', title: '关不掉 :)', body: '这只是一张网页，刷新一下就在。' });
          setTimeout(function () { Win.showLock(); }, 900);
        } }
      ], r.left - 120, r.top - 180, { up: true });
    });

    var input = search.querySelector('input');
    input.addEventListener('input', function () {
      state.startFilter = input.value.trim();
      renderStartBody(body);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { input.blur(); closeFlyouts(); }
      if (e.key === 'Enter') {
        var first = body.querySelector('[data-app-target]');
        if (first) { e.preventDefault(); launchApp(first.dataset.appTarget); }
      }
    });

    renderStartBody(body);
    return menu;
  }

  function renderStartBody(body) {
    var q = state.startFilter.toLowerCase();
    var apps = window.Win.appList ? window.Win.appList() : [];
    body.innerHTML = '';

    if (q) {
      var hits = apps.filter(function (a) {
        return (a.title + ' ' + (a.keywords || '')).toLowerCase().indexOf(q) > -1;
      });
      var head = document.createElement('div');
      head.className = 'start-section-head';
      head.innerHTML = '<span>搜索结果</span>';
      body.appendChild(head);
      if (!hits.length) {
        var empty = document.createElement('div');
        empty.style.cssText = 'padding:24px 4px;color:var(--text-tertiary);font-size:12px';
        empty.textContent = '没有找到「' + state.startFilter + '」，换个词试试？';
        body.appendChild(empty);
        return;
      }
      hits.forEach(function (a) {
        var row = document.createElement('button');
        row.className = 'rec-item';
        row.type = 'button';
        row.dataset.appTarget = a.id;
        row.style.width = '100%';
        row.innerHTML = '<span class="rec-icon">' + ICONS.app(a.icon) + '</span>' +
          '<span class="rec-text"><span class="rec-title">' + Win.esc(a.title) + '</span>' +
          '<span class="rec-sub">应用</span></span>';
        row.addEventListener('click', function () { launchApp(a.id); });
        body.appendChild(row);
      });
      return;
    }

    var head1 = document.createElement('div');
    head1.className = 'start-section-head';
    head1.innerHTML = '<span>已固定</span>';
    body.appendChild(head1);

    var grid = document.createElement('div');
    grid.className = 'start-grid';
    (window.SITE.startPinned || []).forEach(function (appId) {
      var app = appDef(appId);
      if (!app) return;
      var tile = document.createElement('button');
      tile.className = 'start-tile';
      tile.type = 'button';
      tile.dataset.appTarget = appId;
      tile.title = app.title;
      tile.innerHTML = '<span class="st-icon">' + ICONS.app(app.icon) + '</span>' +
        '<span class="st-label">' + Win.esc(app.title) + '</span>';
      tile.addEventListener('click', function () { launchApp(appId); });
      grid.appendChild(tile);
    });
    body.appendChild(grid);

    var head2 = document.createElement('div');
    head2.className = 'start-section-head';
    head2.innerHTML = '<span>推荐的项目</span>' +
      '<button class="more" type="button">更多 ›</button>';
    body.appendChild(head2);

    var rec = document.createElement('div');
    rec.className = 'start-recommend';
    (window.SITE.recommended || []).forEach(function (item) {
      var row = document.createElement('button');
      row.className = 'rec-item';
      row.type = 'button';
      row.innerHTML = '<span class="rec-icon">' + ICONS.app(item.icon) + '</span>' +
        '<span class="rec-text"><span class="rec-title">' + Win.esc(item.title) + '</span>' +
        '<span class="rec-sub">' + Win.esc(item.sub) + '</span></span>';
      row.addEventListener('click', function () { launchApp(item.app); });
      rec.appendChild(row);
    });
    body.appendChild(rec);

    var moreBtn = head2.querySelector('.more');
    moreBtn.addEventListener('click', function () { launchApp('projects'); });
  }

  function toggleStart() {
    if (state.startOpen) { closeFlyouts(); return; }
    closeFlyouts();
    var menu = buildStartMenu();
    flyoutHost.appendChild(menu);
    state.startOpen = true;
    var input = menu.querySelector('#startSearchInput');
    setTimeout(function () { if (input) input.focus(); }, 60);
  }

  /* ================= 搜索面板 ================= */
  function buildSearchPanel() {
    var panel = document.createElement('div');
    panel.className = 'flyout search-panel';
    panel.dataset.flyout = 'search';
    panel.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    panel.innerHTML =
      '<div class="search-input-wrap">' + ICONS.glyph('search') +
        '<input type="text" id="globalSearchInput" placeholder="输入以搜索应用、项目、技能…" autocomplete="off" spellcheck="false">' +
      '</div>' +
      '<div class="search-results" id="searchResults"></div>';
    var input = panel.querySelector('input');
    var results = panel.querySelector('#searchResults');
    function render() {
      var q = input.value.trim().toLowerCase();
      var apps = window.Win.appList ? window.Win.appList() : [];
      results.innerHTML = '';

      var matchedApps = apps.filter(function (a) { return !q || (a.title + ' ' + (a.keywords || '')).toLowerCase().indexOf(q) > -1; });
      if (matchedApps.length) {
        var t1 = document.createElement('div');
        t1.className = 'search-group-title';
        t1.textContent = '应用';
        results.appendChild(t1);
        matchedApps.slice(0, 6).forEach(function (a) {
          var row = document.createElement('button');
          row.className = 'search-item';
          row.type = 'button';
          row.dataset.appTarget = a.id;
          row.innerHTML = '<span class="si-icon">' + ICONS.app(a.icon) + '</span>' +
            '<span><span class="si-title">' + Win.esc(a.title) + '</span></span>' +
            '<span class="si-kind">应用</span>';
          row.addEventListener('click', function () { launchApp(a.id); });
          results.appendChild(row);
        });
      }

      if (q) {
        var t2 = document.createElement('div');
        t2.className = 'search-group-title';
        t2.textContent = '内容';
        results.appendChild(t2);
        var found = 0;
        (window.SITE.projects || []).forEach(function (p) {
          if ((p.title + p.desc + p.tags.join(' ')).toLowerCase().indexOf(q) === -1) return;
          found++;
          var row = document.createElement('button');
          row.className = 'search-item';
          row.type = 'button';
          row.innerHTML = '<span class="si-icon">' + ICONS.app(p.icon) + '</span>' +
            '<span><span class="si-title">' + Win.esc(p.title) + '</span><br><span class="si-sub">' + Win.esc(p.subtitle) + '</span></span>' +
            '<span class="si-kind">项目</span>';
          row.addEventListener('click', function () { launchApp('projects'); });
          results.appendChild(row);
        });
        (window.SITE.skills || []).forEach(function (g) {
          g.items.forEach(function (s) {
            if (s.name.toLowerCase().indexOf(q) === -1) return;
            found++;
            var row = document.createElement('button');
            row.className = 'search-item';
            row.type = 'button';
            row.innerHTML = '<span class="si-icon">' + ICONS.app(g.icon) + '</span>' +
              '<span><span class="si-title">' + Win.esc(s.name) + '</span><br><span class="si-sub">' + Win.esc(g.group) + ' · ' + s.level + '%</span></span>' +
              '<span class="si-kind">技能</span>';
            row.addEventListener('click', function () { launchApp('skills'); });
            results.appendChild(row);
          });
        });
        if (!found) {
          var none = document.createElement('div');
          none.className = 'search-group-title';
          none.textContent = '没有匹配的内容';
          results.appendChild(none);
        }
        var web = document.createElement('a');
        web.className = 'search-web';
        web.href = 'https://www.bing.com/search?q=' + encodeURIComponent(input.value.trim());
        web.target = '_blank';
        web.rel = 'noopener noreferrer';
        web.innerHTML = ICONS.glyph('globe') + '<span>在 Bing 上搜索「' + Win.esc(input.value.trim()) + '」</span>' + ICONS.glyph('external');
        results.appendChild(web);
      }
    }
    input.addEventListener('input', render);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeFlyouts();
      if (e.key === 'Enter') {
        var first = results.querySelector('[data-app-target]');
        if (first) launchApp(first.dataset.appTarget);
      }
    });
    render();
    return panel;
  }

  function toggleSearch() {
    if (state.searchOpen) { closeFlyouts(); return; }
    closeFlyouts();
    var panel = buildSearchPanel();
    flyoutHost.appendChild(panel);
    state.searchOpen = true;
    setTimeout(function () { var i = panel.querySelector('input'); if (i) i.focus(); }, 60);
  }

  /* ================= 日历 + 通知 ================= */
  function buildCalendarPanel() {
    var panel = document.createElement('div');
    panel.className = 'flyout calendar-panel';
    panel.dataset.flyout = 'calendar';
    panel.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    panel.innerHTML =
      '<div class="calendar-clock"><span class="cc-time" data-clock="time">--:--</span><span class="cc-date" data-clock="date-cn"></span></div>' +
      '<div class="cal-head"><span class="cal-month"></span><span class="cal-nav">' +
        '<button type="button" data-cal="prev" aria-label="上个月">' + ICONS.glyph('chevron-left') + '</button>' +
        '<button type="button" data-cal="next" aria-label="下个月">' + ICONS.glyph('chevron-right') + '</button>' +
      '</span></div>' +
      '<div class="cal-grid" id="calGrid"></div>' +
      '<div class="cal-section-title"><span>通知</span><button class="clear-all" type="button" id="clearAllNotifs">全部清除</button></div>' +
      '<div class="notif-list" id="notifList"></div>';

    panel.querySelector('[data-cal="prev"]').addEventListener('click', function () {
      state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() - 1, 1);
      renderCalendar(panel);
    });
    panel.querySelector('[data-cal="next"]').addEventListener('click', function () {
      state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() + 1, 1);
      renderCalendar(panel);
    });
    panel.querySelector('#clearAllNotifs').addEventListener('click', function () {
      Win.notifications.length = 0;
      Win.markAllRead();
      renderNotifications(panel);
    });
    renderCalendar(panel);
    renderNotifications(panel);
    setTimeout(function () { Win.markAllRead(); }, 800);
    return panel;
  }

  function renderCalendar(panel) {
    var grid = panel.querySelector('#calGrid');
    var label = panel.querySelector('.cal-month');
    if (!grid) return;
    var d = state.calMonth;
    var year = d.getFullYear(), month = d.getMonth();
    label.textContent = year + '年' + (month + 1) + '月';
    var today = new Date();
    var first = new Date(year, month, 1);
    var startDow = first.getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var prevDays = new Date(year, month, 0).getDate();

    var html = ['日', '一', '二', '三', '四', '五', '六'].map(function (w) {
      return '<span class="cal-dow">' + w + '</span>';
    }).join('');

    var cells = [];
    for (var i = startDow - 1; i >= 0; i--) cells.push({ day: prevDays - i, muted: true });
    for (var day = 1; day <= daysInMonth; day++) cells.push({ day: day, muted: false });
    var trail = (7 - (cells.length % 7)) % 7;
    for (var t = 1; t <= trail; t++) cells.push({ day: t, muted: true });

    cells.forEach(function (c) {
      var isToday = !c.muted && c.day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
      html += '<button type="button" class="cal-day' + (c.muted ? ' is-muted' : '') + (isToday ? ' is-today' : '') +
        (isToday ? ' has-dot' : '') + '">' + c.day + '</button>';
    });
    grid.innerHTML = html;
  }

  function renderNotifications(panel) {
    var list = panel.querySelector('#notifList');
    if (!list) return;
    var items = Win.notifications;
    if (!items.length) {
      list.innerHTML = '<div class="notif-empty">' + ICONS.glyph('bell') + '<div>暂无通知</div></div>';
      return;
    }
    list.innerHTML = '';
    items.slice(0, 8).forEach(function (n) {
      var row = document.createElement('div');
      row.className = 'notif-item';
      row.innerHTML = '<span class="ni-icon">' + ICONS.app(n.icon) + '</span>' +
        '<div><div class="ni-title">' + Win.esc(n.title) + '</div>' +
        '<div class="ni-body">' + Win.esc(n.body) + '</div></div>';
      list.appendChild(row);
    });
  }

  function toggleCalendar() {
    if (state.calOpen) { closeFlyouts(); return; }
    closeFlyouts();
    var panel = buildCalendarPanel();
    flyoutHost.appendChild(panel);
    state.calOpen = true;
  }

  /* ================= 任务视图 ================= */
  function buildTaskView() {
    var overlay = document.createElement('div');
    overlay.dataset.flyout = 'taskview';
    overlay.style.cssText = 'position:absolute;inset:0;z-index:920;background:rgba(20,24,34,.55);' +
      'backdrop-filter:blur(28px);-webkit-backdrop-filter:blur(28px);padding:48px 40px;' +
      'display:flex;flex-direction:column;gap:20px;animation:fade-in 160ms ease both';
    overlay.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    var head = document.createElement('div');
    head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;color:#fff';
    head.innerHTML = '<div style="font-size:15px;font-weight:600">任务视图</div>' +
      '<div style="font-size:12px;opacity:.7">点击卡片切换窗口 · 按 Esc 关闭</div>';
    overlay.appendChild(head);

    var grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;overflow:auto;padding-bottom:24px';
    var list = WM.list().filter(function (w) { return w.state !== 'closed'; });
    if (!list.length) {
      var empty = document.createElement('div');
      empty.style.cssText = 'grid-column:1/-1;color:rgba(255,255,255,.6);font-size:13px;padding:48px 0;text-align:center';
      empty.textContent = '没有打开的窗口。双击桌面图标，或点开始菜单里的应用试试。';
      grid.appendChild(empty);
    }
    list.forEach(function (w) {
      var card = document.createElement('button');
      card.type = 'button';
      card.style.cssText = 'display:flex;align-items:center;gap:12px;padding:14px;border-radius:8px;' +
        'background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.14);color:#fff;text-align:left;transition:background .15s';
      card.innerHTML = '<span style="width:32px;height:32px;display:grid;place-items:center">' + ICONS.app(w.icon) + '</span>' +
        '<span style="min-width:0"><span style="display:block;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + Win.esc(w.title) + '</span>' +
        '<span style="display:block;font-size:11px;opacity:.6">' + (w.state === 'min' ? '已最小化' : '已打开') + '</span></span>';
      card.addEventListener('mouseenter', function () { card.style.background = 'rgba(255,255,255,.18)'; });
      card.addEventListener('mouseleave', function () { card.style.background = 'rgba(255,255,255,.1)'; });
      card.addEventListener('click', function () {
        if (w.state === 'min') WM.restore(w); else WM.focus(w);
        closeFlyouts();
      });
      grid.appendChild(card);
    });
    overlay.appendChild(grid);
    return overlay;
  }

  function toggleTaskView() {
    if (state.taskViewOpen) { closeFlyouts(); return; }
    closeFlyouts();
    flyoutHost.appendChild(buildTaskView());
    state.taskViewOpen = true;
  }

  /* ================= 右键菜单 ================= */
  function openContextMenu(items, x, y, opts) {
    closeFlyouts('context');
    var menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.dataset.flyout = 'context';
    menu.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    items.forEach(function (item) {
      if (item.sep) {
        var s = document.createElement('div');
        s.className = 'ctx-sep';
        menu.appendChild(s);
        return;
      }
      var row = document.createElement('button');
      row.className = 'ctx-item' + (item.disabled ? ' is-disabled' : '');
      row.type = 'button';
      row.innerHTML = '<span class="ctx-icon">' + (item.icon ? ICONS.glyph(item.icon) : '') + '</span>' +
        '<span class="ctx-label">' + Win.esc(item.label) + '</span>' +
        (item.shortcut ? '<span class="ctx-shortcut">' + Win.esc(item.shortcut) + '</span>' : '');
      if (!item.disabled && item.action) {
        row.addEventListener('click', function () {
          closeTarget('context');
          setTimeout(function () { item.action(); }, 10);
        });
      }
      menu.appendChild(row);
    });
    (flyoutHost || document.body).appendChild(menu);
    var rect = menu.getBoundingClientRect();
    var vw = window.innerWidth, vh = window.innerHeight;
    var left = Math.min(x, vw - rect.width - 8);
    var top = Math.min(y, vh - rect.height - 8);
    menu.style.left = Math.max(8, left) + 'px';
    menu.style.top = Math.max(8, top) + 'px';
  }

  function openIconMenu(appId, x, y) {
    var app = appDef(appId);
    if (!app) return;
    openContextMenu([
      { icon: 'folder', label: '打开', action: function () { launchApp(appId); } },
      { icon: 'external', label: '在新窗口打开', disabled: true },
      { sep: true },
      { icon: 'pin', label: '固定到任务栏', action: function () {
        if ((window.SITE.taskbarPinned || []).indexOf(appId) === -1) {
          Window_PINNED_EXTRA.push(appId);
          renderTaskbarCenter();
          Win.notify({ icon: app.icon, title: '已固定到任务栏', body: app.title });
        } else {
          Win.notify({ icon: app.icon, title: '已经在任务栏上啦', body: app.title });
        }
      } },
      { sep: true },
      { icon: 'info', label: '属性', disabled: true, shortcut: 'Alt+Enter' }
    ], x, y);
  }

  function openDesktopMenu(x, y) {
    openContextMenu([
      { icon: 'grid-view', label: '查看', shortcut: 'V', disabled: true },
      { icon: 'sort', label: '排序方式', shortcut: 'O', disabled: true },
      { icon: 'refresh', label: '刷新', action: function () {
        var wall = document.getElementById('wallpaper');
        wall.style.transition = 'opacity 160ms';
        wall.style.opacity = '0.35';
        setTimeout(function () { wall.style.opacity = ''; }, 170);
        Win.notify({ icon: 'refresh', title: '已刷新', body: '桌面看起来还是原来的样子，对吧。' });
      } },
      { sep: true },
      { icon: 'plus', label: '新建', disabled: true },
      { sep: true },
      { icon: 'display', label: '显示设置', action: function () { launchApp('settings'); } },
      { icon: 'palette', label: '个性化', action: function () { launchApp('settings'); } },
      { icon: 'terminal', label: '在终端中打开', action: function () { launchApp('terminal'); } }
    ], x, y);
  }

  /* ================= 全局事件 ================= */
  function bindGlobal() {
    document.addEventListener('pointerdown', function (e) {
      var inFlyout = e.target.closest('[data-flyout]');
      var inTaskbar = e.target.closest('.taskbar');
      var inWindow = e.target.closest('.window');
      if (!inFlyout && !inTaskbar && !inWindow) {
        closeFlyouts();
        selectIcon(null);
      }
      if (inTaskbar) { /* 任务栏按钮自己处理 */ }
    }, true);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (state.startOpen || state.searchOpen || state.calOpen || state.taskViewOpen) { closeFlyouts(); return; }
        var ctx = document.querySelector('[data-flyout="context"]');
        if (ctx) closeTarget('context');
      }
      if (e.key === 'Meta' || (e.ctrlKey && e.key === 'Escape')) {
        e.preventDefault();
        toggleStart();
      }
      if (e.ctrlKey && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        toggleSearch();
      }
    });

    document.addEventListener('contextmenu', function (e) {
      var onDesktop = e.target.id === 'desktop' || e.target.id === 'wallpaper' || e.target.closest('#desktopIcons');
      if (e.target.closest('.window') || e.target.closest('[data-flyout]') || e.target.closest('.taskbar')) return;
      if (onDesktop) {
        e.preventDefault();
        selectIcon(null);
        openDesktopMenu(e.clientX, e.clientY);
      }
    });

    Win.bus.on('wm:change', function () { syncTaskbar(); });
  }

  /* ================= 初始化 ================= */
  function init() {
    flyoutHost = document.getElementById('flyoutHost');
    renderDesktop();
    renderTaskbarCenter();
    renderTray();
    initClock();
    Win.renderNotificationBadge();
    bindGlobal();
    Win.bus.on('notifications', function () {
      var panel = document.querySelector('[data-flyout="calendar"]');
      if (panel) renderNotifications(panel);
    });
    Win.bus.on('lock:request-close-all', function () { closeFlyouts(); });
    Win.bus.on('prefs', function () { renderDesktop(); });
  }

  return {
    init: init,
    closeFlyouts: closeFlyouts,
    launchApp: launchApp,
    openDesktopMenu: openDesktopMenu,
    renderDesktop: renderDesktop,
    toggleStart: toggleStart,
    toggleSearch: toggleSearch,
    toggleCalendar: toggleCalendar,
    toggleTaskView: toggleTaskView
  };
})();