/* Startup: preferences -> WM/Shell -> unlock listeners -> server-backed gate.
   Deep links describe UI to open after authorization; they never grant access. */
(function () {
  'use strict';

  function applyDeepLinks() {
    var params = new URLSearchParams(location.search);
    if (params.get('theme')) Win.setPref('themeMode', params.get('theme'));
    if (params.get('wall')) Win.setPref('wall', params.get('wall'));
    if (params.get('align')) Win.setPref('align', params.get('align'));
    var menu = params.get('menu');
    var open = (params.get('open') || params.get('app') || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    function applyRequested() {
      open.forEach(function (id) {
        var app = Win.apps[id];
        if (app && !app.external) WM.launch(id);
      });
      if (menu === 'start') Shell.toggleStart();
      if (menu === 'search') Shell.toggleSearch();
      if (menu === 'calendar') Shell.toggleCalendar();
      if (menu === 'taskview') Shell.toggleTaskView();
      if (menu === 'quick') Shell.toggleQuickSettings();
    }
    if (Win.isLocked()) {
      var off = Win.bus.on('unlock', function () { off(); applyRequested(); });
    } else applyRequested();
  }

  async function boot() {
    Win.applyPrefs();
    (window.SITE.notifications || []).forEach(function (n, i) {
      Win.notifications.push({ id: 'seed-' + i, icon: n.icon || 'info', title: n.title || '', body: n.body || '', time: n.time || '刚刚', unread: true });
    });
    WM.init();
    Shell.init();

    var welcomed = false;
    Win.bus.on('unlock', function (e) {
      if (welcomed) return;
      welcomed = true;
      setTimeout(function () {
        if (Win.isLocked()) return;
        Win.notify({ icon: 'about', title: '欢迎来到 Aiden 的桌面', body: '双击图标打开应用，触屏轻点即可；网页快捷键与说明在右下角快速设置。', sticky: false });
      }, e && e.instant ? 200 : 420);
    });
    applyDeepLinks();
    document.documentElement.classList.add('is-loaded');
    try {
      await Win.initLock();
    } catch (_) {
      // Never fall back to the old click-to-unlock screen if initialization fails.
      var desktop = document.getElementById('desktop');
      if (desktop) { desktop.inert = true; desktop.setAttribute('aria-hidden', 'true'); }
      document.body.classList.add('is-locked');
      var screen = document.getElementById('lockScreen');
      if (screen) screen.hidden = false;
      var status = document.getElementById('gatePending');
      if (status) { status.hidden = false; status.textContent = '登录界面未能就绪，请刷新重试。桌面仍保持锁定。'; }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
