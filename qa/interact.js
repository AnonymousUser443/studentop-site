(async () => {
  const checks = [];
  const ok = (name, cond, detail) => checks.push({ name, pass: !!cond, detail: detail === undefined ? null : detail });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const q = s => document.querySelector(s);
  const qa2 = s => Array.from(document.querySelectorAll(s));

  // 1 开始菜单
  q('#startBtn').click(); await sleep(340);
  ok('start_menu_opens', !!q('.start-menu'));
  ok('start_pinned_tiles', qa2('.start-tile').length >= 11, qa2('.start-tile').length);
  const si = q('#startSearchInput');
  si.value = '终端'; si.dispatchEvent(new Event('input', { bubbles: true })); await sleep(140);
  ok('start_search_filters', qa2('.start-menu-body .rec-item').length >= 1, qa2('.start-menu-body .rec-item').length);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await sleep(240);
  ok('start_menu_closes', !q('.start-menu'));

  // 2 搜索面板
  q('#searchBtn').click(); await sleep(340);
  ok('search_panel_opens', !!q('.search-panel'));
  const gs = q('#globalSearchInput');
  gs.value = 'python'; gs.dispatchEvent(new Event('input', { bubbles: true })); await sleep(140);
  ok('search_results', qa2('.search-results .search-item').length >= 1, qa2('.search-results .search-item').length);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await sleep(220);

  // 3 日历 + 通知
  q('#trayClock').click(); await sleep(340);
  ok('calendar_opens', !!q('.calendar-panel'));
  ok('calendar_today', !!q('.cal-day.is-today'));
  ok('calendar_notifications', qa2('#notifList .notif-item').length >= 1, qa2('#notifList .notif-item').length);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await sleep(220);

  // 4 桌面图标双击 → 打开项目窗口
  const icon = q('.desktop-icon[data-app="projects"]');
  icon.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); await sleep(420);
  const win = q('.window[data-app="projects"]');
  ok('desktop_icon_opens_app', !!win);
  ok('projects_cards', !!win && win.querySelectorAll('.project-card').length >= 4, win ? win.querySelectorAll('.project-card').length : 0);
  if (win) {
    const chip = Array.from(win.querySelectorAll('.chip')).find(c => c.dataset.filter === 'Python');
    if (chip) { chip.click(); await sleep(160); }
    ok('project_filter', win.querySelectorAll('.project-card').length >= 1 && win.querySelectorAll('.project-card').length < 4, win.querySelectorAll('.project-card').length);

    // 5 最大化 / 还原
    win.querySelector('.caption-max').click(); await sleep(280);
    ok('maximize', win.classList.contains('is-maximized'));
    win.querySelector('.caption-max').click(); await sleep(280);
    ok('restore_window', !win.classList.contains('is-maximized'));

    // 6 拖动
    const before = win.getBoundingClientRect();
    const tb = win.querySelector('.titlebar');
    const r = tb.getBoundingClientRect();
    tb.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: r.left + 120, clientY: r.top + 16, pointerId: 1, isPrimary: true }));
    document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: r.left + 240, clientY: r.top + 110, pointerId: 1, isPrimary: true }));
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: r.left + 240, clientY: r.top + 110, pointerId: 1, isPrimary: true }));
    await sleep(180);
    const after = win.getBoundingClientRect();
    ok('window_drag', Math.abs(after.left - before.left) > 40 || Math.abs(after.top - before.top) > 40, [before.left | 0, after.left | 0, before.top | 0, after.top | 0]);

    // 7 最小化 / 任务栏还原
    win.querySelector('.caption-min').click(); await sleep(420);
    ok('minimize', win.style.display === 'none', win.style.display);
    q('[data-taskbar-app="projects"]').click(); await sleep(420);
    ok('taskbar_restore', win.style.display !== 'none', win.style.display);
  }

  // 8 终端
  WM.launch('terminal'); await sleep(450);
  const term = q('.window[data-app="terminal"]');
  ok('terminal_opens', !!term);
  if (term) {
    const input = term.querySelector('#termInput');
    const send = cmd => { input.value = cmd; input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); };
    send('help'); await sleep(180);
    ok('terminal_help', term.querySelector('#termOut').textContent.includes('可用命令'));
    send('neofetch'); await sleep(180);
    ok('terminal_neofetch', term.querySelector('#termOut').textContent.includes('Raspberry Pi'));
    send('theme dark'); await sleep(180);
    ok('terminal_theme', document.documentElement.dataset.theme === 'dark');
    send('theme light'); await sleep(120);
  }

  // 9 设置：主题 / 壁纸 / 关于
  WM.launch('settings'); await sleep(450);
  const set = q('.window[data-app="settings"]');
  ok('settings_opens', !!set);
  if (set) {
    const darkBtn = Array.from(set.querySelectorAll('.seg')).find(b => b.dataset.value === 'dark');
    if (darkBtn) { darkBtn.click(); await sleep(260); }
    ok('settings_dark', document.documentElement.dataset.theme === 'dark');
    const wallTile = set.querySelector('.wall-tile[data-wall="dusk"]');
    if (wallTile) { wallTile.click(); await sleep(240); }
    ok('settings_wall', document.documentElement.dataset.wall === 'dusk');
    const navAbout = Array.from(set.querySelectorAll('.set-nav-item')).find(b => b.dataset.pane === 'about');
    if (navAbout) { navAbout.click(); await sleep(200); }
    ok('settings_about_pane', !!set.querySelector('.tech-grid'));
  }

  // 10 关闭所有窗口
  WM.closeAll(); await sleep(420);
  ok('close_all', document.querySelectorAll('.window').length === 0, document.querySelectorAll('.window').length);
  ok('taskbar_pinned', qa2('#tbCenter [data-taskbar-app]').length >= 5, qa2('#tbCenter [data-taskbar-app]').length);

  // 11 右键菜单
  document.getElementById('desktop').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 600, clientY: 300 }));
  await sleep(160);
  ok('desktop_context_menu', !!q('.context-menu'));
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await sleep(160);

  // 12 无横向溢出
  ok('no_horizontal_overflow', document.documentElement.scrollWidth <= window.innerWidth, [document.documentElement.scrollWidth, window.innerWidth]);

  return JSON.stringify({ checks, passed: checks.filter(c => c.pass).length, total: checks.length });
})()