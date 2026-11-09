(function () {
  'use strict';

  var ID = 'wallpaper-driver', LIVE = 'chenyu-live', TITLE = 'Aiden Wallpaper Driver';
  var sources = {
    hd: 'assets/media/chenyu-live-1080.mp4',
    light: 'assets/media/chenyu-live-720.mp4'
  };
  var labels = {
    locked: '桌面已锁定', static: '静态壁纸', reduced: '已减少动态效果',
    hidden: '后台已暂停', paused: '已暂停', loading: '正在加载',
    playing: '正在播放', blocked: '等待手动播放', error: '播放失败'
  };
  var video, tray;
  var state = 'locked', failure = '', paused = Win.store.get('wallpaperDriverPaused', false) === true;
  var staticWall = Win.store.get('wallpaperDriverStatic', 'chenyu');
  var pending = false, attempt = 0;

  function selected() { return Win.prefs.wall === LIVE; }
  function publish(next) {
    if (tray && tray.dataset.playback !== next) {
      tray.dataset.playback = next;
      tray.title = TITLE + ' · ' + labels[next];
      tray.setAttribute('aria-label', tray.title);
    }
    if (state === next) return;
    state = next;
    Win.bus.emit('wallpaper:playback', state);
  }

  function stop(unload) {
    ++attempt;
    pending = false;
    if (!video.paused) video.pause();
    if (unload && video.hasAttribute('src')) {
      video.removeAttribute('src');
      video.removeAttribute('poster');
      video.load();
    }
  }

  function source() {
    var connection = navigator.connection;
    return Win.isMobile() || (connection && (connection.saveData || /^(slow-2g|2g|3g)$/.test(connection.effectiveType)))
      ? sources.light : sources.hd;
  }

  function sync() {
    if (!video) return;
    if (Win.isLocked() || !selected() || Win.reduceMotion()) {
      failure = '';
      stop(true);
      publish(Win.isLocked() ? 'locked' : !selected() ? 'static' : 'reduced');
    } else if (document.hidden || paused) {
      stop(false);
      publish(paused ? 'paused' : 'hidden');
    } else if (failure) {
      publish(failure);
    } else if (!pending && video.paused) {
      if (!video.hasAttribute('src')) {
        video.poster = Win.wallpaperUrl(LIVE);
        video.src = source();
      }
      var current = ++attempt;
      pending = true;
      publish('loading');
      video.play().then(function () {
        if (current === attempt) pending = false;
      }).catch(function (err) {
        if (current !== attempt) return;
        pending = false;
        failure = err && err.name === 'NotAllowedError' ? 'blocked' : 'error';
        if (failure === 'error') stop(true);
        publish(failure);
      });
    }
  }

  function setPaused(value) {
    if (paused !== value) {
      paused = value;
      Win.store.set('wallpaperDriverPaused', value);
    }
  }

  function toggle() {
    if (Win.isLocked()) return;
    if (!selected() || paused || failure) {
      failure = '';
      setPaused(false);
      Win.setPref('wall', LIVE);
      sync();
    } else {
      setPaused(true);
      sync();
    }
  }

  function useStatic() {
    if (Win.isLocked() || !selected()) return;
    Win.setPref('wall', Win.validPref('wall', staticWall) && staticWall !== LIVE ? staticWall : 'chenyu');
  }

  function init() {
    video = document.getElementById('liveWallpaper');
    tray = document.getElementById('wallpaperTray');
    video.muted = true;
    tray.innerHTML = ICONS.glyph(ID);
    tray.addEventListener('click', function () {
      if (Win.isLocked()) return;
      Shell.closeFlyouts();
      WM.launch(ID);
    });
    video.addEventListener('playing', function () {
      if (!selected() || paused || Win.reduceMotion() || Win.isLocked() || document.hidden || video.paused) return;
      publish('playing');
    });
    video.addEventListener('waiting', function () {
      if (state === 'playing' && !video.paused) publish('loading');
    });
    video.addEventListener('pause', function () {
      if (video.paused && (state === 'playing' || state === 'loading') && !pending) {
        failure = 'blocked';
        publish(failure);
      }
    });
    video.addEventListener('error', function () {
      if (!video.hasAttribute('src')) return;
      failure = 'error';
      stop(true);
      publish(failure);
    });
    Win.bus.on('unlock', sync);
    Win.bus.on('lock:request-close-all', sync);
    Win.bus.on('prefs', function () {
      if (!selected() && staticWall !== Win.prefs.wall) {
        staticWall = Win.prefs.wall;
        Win.store.set('wallpaperDriverStatic', staticWall);
      }
      if (!selected()) setPaused(false);
      sync();
    });
    document.addEventListener('visibilitychange', sync);
    var motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motion.addEventListener) motion.addEventListener('change', sync);
    else if (motion.addListener) motion.addListener(sync);
    if (!selected()) staticWall = Win.prefs.wall;
    sync();
  }

  function render(body, ctx) {
    body.innerHTML =
      '<section class="app wallpaper-driver">' +
        '<div class="wallpaper-feature">' +
          '<img src="assets/img/wall-chenyu-live.webp" alt="" width="1920" height="1080" draggable="false">' +
          '<span class="wallpaper-edition">01 / 内置壁纸</span>' +
          '<h2>沉玉谷 <span>·</span> 岁时祭祀</h2>' +
        '</div>' +
        '<div class="wallpaper-controls">' +
          '<div class="wallpaper-control-head"><span class="wallpaper-status" data-wallpaper-status role="status"></span><span>10 秒 · 静音循环</span></div>' +
          '<div class="wallpaper-actions">' +
            '<button type="button" class="btn btn-primary" data-wallpaper-toggle></button>' +
            '<button type="button" class="btn" data-wallpaper-static>' + ICONS.glyph('image') + '切回静态壁纸</button>' +
          '</div>' +
          '<p class="wallpaper-note" data-wallpaper-note></p>' +
        '</div>' +
      '</section>';
    var status = body.querySelector('[data-wallpaper-status]');
    var note = body.querySelector('[data-wallpaper-note]');
    var play = body.querySelector('[data-wallpaper-toggle]');
    var still = body.querySelector('[data-wallpaper-static]');
    play.addEventListener('click', toggle);
    still.addEventListener('click', useStatic);
    function update() {
      var showPause = selected() && !paused && !failure && !Win.reduceMotion();
      var text = showPause ? '暂停壁纸' : state === 'error' ? '重试播放' : '播放动态壁纸';
      if (play.dataset.label !== text) {
        play.dataset.label = text;
        play.innerHTML = ICONS.glyph(showPause ? 'pause' : 'play') + text;
      }
      play.disabled = Win.reduceMotion() && selected();
      still.disabled = !selected();
      var label = labels[state];
      if (state === 'playing' && video.videoHeight) label += ' · ' + video.videoHeight + 'p';
      if (status.textContent !== label) status.textContent = label;
      status.dataset.playback = state;
      note.textContent = state === 'reduced' ? '桌面或系统开启了减少动态效果，当前显示静态画面。'
        : state === 'error' ? '无法加载视频，已显示静态画面。可以重试或切回原壁纸。'
        : state === 'blocked' ? '浏览器暂停了自动播放，点击上方按钮继续。'
        : '切到其他标签页时自动暂停，返回桌面后继续播放。';
    }
    var offPlayback = Win.bus.on('wallpaper:playback', update);
    var offPrefs = Win.bus.on('prefs', update);
    ctx.win.dispose = function () { offPlayback(); offPrefs(); };
    update();
  }

  (window.__APP_DEFS = window.__APP_DEFS || []).push({
    id: ID, title: TITLE, icon: ID, width: 548, height: 460, minWidth: 310, minHeight: 275,
    keywords: '动态壁纸 视频 桌面背景 沉玉谷 wallpaper engine', render: render
  });
  window.WallpaperDriver = { init: init };
})();
