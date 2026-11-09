(function () {
  'use strict';

  var ID = 'wallpaper-driver', LIVE = 'chenyu-live', TITLE = 'Aiden Wallpaper Driver';
  var sources = [
    { src: 'assets/media/chenyu-live-4k-av1.mp4', codec: 'av01.0.12M.10', width: 3840, height: 2160, bitrate: 3874619, label: '4K AV1' },
    { src: 'assets/media/chenyu-live-1080.mp4', codec: 'avc1.640028', width: 1920, height: 1080, bitrate: 2923458, label: '1080p H.264' },
    { src: 'assets/media/chenyu-live-720.mp4', codec: 'avc1.64001f', width: 1280, height: 720, bitrate: 1166776, label: '720p H.264' }
  ];
  var labels = {
    locked: '桌面已锁定', static: '静态壁纸', reduced: '已减少动态效果',
    hidden: '后台已暂停', paused: '已暂停', loading: '正在加载',
    playing: '正在播放', blocked: '等待手动播放', error: '播放失败'
  };
  var video, tray;
  var state = 'locked', failure = '', paused = Win.store.get('wallpaperDriverPaused', false) === true;
  var staticWall = Win.store.get('wallpaperDriverStatic', 'chenyu');
  var pending = false, attempt = 0;
  var media = null, preparing = null, nextSource = 0;

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

  function stop() {
    ++attempt;
    pending = false;
    if (!video.paused) video.pause();
  }

  function unload() {
    stop();
    if (!media) return;
    var url = media.url;
    media = null;
    video.removeAttribute('src');
    video.removeAttribute('poster');
    video.load();
    URL.revokeObjectURL(url);
  }

  async function canDecode(source) {
    var contentType = 'video/mp4; codecs="' + source.codec + '"';
    if (!video.canPlayType(contentType)) return false;
    if (!navigator.mediaCapabilities || !navigator.mediaCapabilities.decodingInfo) return true;
    try {
      var result = await navigator.mediaCapabilities.decodingInfo({
        type: 'file',
        video: { contentType: contentType, width: source.width, height: source.height, bitrate: source.bitrate, framerate: 24 }
      });
      return result.supported;
    } catch (_) {
      return true;
    }
  }

  async function prepare() {
    if (media || preparing || failure || paused || document.hidden) return;
    var controller = new AbortController();
    preparing = controller;
    var signal = controller.signal;
    while (nextSource < sources.length && !signal.aborted) {
      var source = sources[nextSource++];
      var supported = await canDecode(source);
      if (signal.aborted) return;
      if (!supported) continue;
      try {
        // Reading the whole response once keeps playback independent of network buffering.
        var response = await fetch(source.src, { signal: signal });
        if (!response.ok || response.status === 206) continue;
        var blob = await response.blob();
        if (signal.aborted) return;
        if (!blob.size) continue;
        media = { url: URL.createObjectURL(blob), label: source.label };
      } catch (_) {
        if (signal.aborted) return;
        continue;
      }
      preparing = null;
      video.poster = Win.wallpaperUrl(LIVE);
      video.src = media.url;
      video.load();
      sync();
      return;
    }
    if (signal.aborted) return;
    preparing = null;
    failure = 'error';
    sync();
  }

  function tryNextSource() {
    unload();
    sync();
  }

  function sync() {
    if (!video) return;
    var locked = Win.isLocked();
    if (!selected() || Win.reduceMotion()) {
      if (preparing) preparing.abort();
      preparing = null;
      nextSource = 0;
      failure = '';
      unload();
      publish(locked ? 'locked' : !selected() ? 'static' : 'reduced');
    } else if (locked || document.hidden || paused) {
      stop();
      publish(locked ? 'locked' : paused ? 'paused' : 'hidden');
      // Startup reaches this branch before the BIOS animation. The gate owns when playback can start.
      if (locked) void prepare();
    } else if (failure) {
      publish(failure);
    } else if (!media) {
      publish('loading');
      void prepare();
    } else if (!pending && video.paused) {
      var current = ++attempt;
      pending = true;
      publish('loading');
      video.play().then(function () {
        if (current === attempt) pending = false;
      }).catch(function (err) {
        if (current !== attempt) return;
        pending = false;
        if (err && err.name === 'NotAllowedError') {
          failure = 'blocked';
          publish(failure);
        } else tryNextSource();
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
      if (failure === 'error') nextSource = 0;
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
      if (media && !video.error && video.paused && (state === 'playing' || state === 'loading') && !pending) {
        failure = 'blocked';
        publish(failure);
      }
    });
    video.addEventListener('error', function () {
      if (media && video.error) tryNextSource();
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
      if (state === 'playing' && media) label += ' · ' + media.label;
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
