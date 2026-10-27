/* =====================================================================
   启动顺序：应用偏好 → 锁屏 → 窗口管理器 → 外壳 → 欢迎
   ===================================================================== */
(function () {
  'use strict';

  /* 支持通过 URL 参数直接进入某个状态，便于分享与截图：
     ?skipLock=1&theme=dark&wall=dusk&open=about,projects&menu=start */
  function applyDeepLinks() {
    var params = new URLSearchParams(location.search);
    if (params.get('theme')) Win.setPref('themeMode', params.get('theme'));
    if (params.get('wall')) Win.setPref('wall', params.get('wall'));
    if (params.get('align')) Win.setPref('align', params.get('align'));
    if (params.get('skipLock') === '1') Win.hideLock(true);
    var menu = params.get('menu');
    if (menu === 'start') setTimeout(function () { Shell.toggleStart(); }, 220);
    if (menu === 'search') setTimeout(function () { Shell.toggleSearch(); }, 220);
    if (menu === 'calendar') setTimeout(function () { Shell.toggleCalendar(); }, 220);
    if (menu === 'taskview') setTimeout(function () { Shell.toggleTaskView(); }, 220);
    var open = (params.get('open') || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    if (open.length || menu) window.__skipAutoAbout = true;
    open.forEach(function (id, i) {
      setTimeout(function () { WM.launch(id); }, 260 + i * 160);
    });
  }

  function boot() {
    Win.applyPrefs();
    // 把 content.js 里的通知种子装进通知中心
    (window.SITE.notifications || []).forEach(function (n, i) {
      Win.notifications.push({
        id: 'seed-' + i,
        icon: n.icon || 'info',
        title: n.title || '',
        body: n.body || '',
        time: n.time || '刚刚',
        unread: true
      });
    });
    Win.initLock();
    WM.init();
    Shell.init();

    // 壁纸换掉时，同步锁屏背景
    Win.bus.on('prefs', function () {
      var lockWall = document.getElementById('lockWall');
      if (lockWall) {
        var map = {
          bloom: 'assets/img/wall-bloom.jpg',
          dusk: 'assets/img/wall-dusk.jpg',
          aurora: 'assets/img/wall-aurora.jpg',
          sakura: 'assets/img/wall-sakura.jpg',
          solid: 'assets/img/wall-solid.jpg'
        };
        var url = map[Win.prefs.wall] || map.bloom;
        lockWall.style.backgroundImage = 'url("' + url + '")';
      }
    });

    // 解锁之后：欢迎通知 + 首次访问自动打开「关于我」
    var welcomed = false;
    Win.bus.on('unlock', function (e) {
      if (welcomed) return;
      welcomed = true;
      var first = false;
      try {
        first = !sessionStorage.getItem('win11home.welcomed');
        sessionStorage.setItem('win11home.welcomed', '1');
      } catch (err) {}
      setTimeout(function () {
        Win.notify({
          icon: 'about',
          title: '欢迎，' + window.SITE.profile.name + ' 的桌面',
          body: '双击图标打开应用，按 Win 键打开开始菜单。',
          sticky: false
        });
        if (first && !Win.isMobile() && !window.__skipAutoAbout) {
          setTimeout(function () { WM.launch('about'); }, 420);
        }
      }, e && e.instant ? 200 : 520);
    });

    // 首次访问时如果锁屏被 sessionStorage 跳过，也要触发一次欢迎
    if (document.getElementById('lockScreen').hidden) {
      Win.bus.emit('unlock', { instant: true });
    }

    applyDeepLinks();

    // 让页面在加载完成后有个轻微的入场
    document.documentElement.classList.add('is-loaded');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();