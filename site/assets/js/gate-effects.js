/* Presentation only. Particles never read the answer, session, or authorization state. */
(function () {
  'use strict';
  function clamp(value) { return Math.max(0, Math.min(1, value)); }
  function random(seed) {
    var state = seed >>> 0;
    return function () { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  }
  function context(canvas) { try { return canvas && canvas.getContext('2d'); } catch (_) { return null; } }
  function create(root) {
    var bootCanvas = document.getElementById('gateBootParticles');
    var revealCanvas = document.getElementById('gateUnlockParticles');
    var wordmark = document.getElementById('gateWordmark');
    var bootContext = context(bootCanvas), revealContext = context(revealCanvas);
    var bootFrame = 0, revealFrame = 0, bootActive = false, bootStart = 0;
    var bootPoints = [], width = 0, height = 0, revealResolve = null;
    var artwork = null, artworkURL = '';
    function dimensions(canvas, ctx) {
      var w = Math.max(1, root.clientWidth || window.innerWidth);
      var h = Math.max(1, root.clientHeight || window.innerHeight);
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { width: w, height: h };
    }
    function prepareWord() {
      if (!bootContext || !wordmark) return false;
      var size = dimensions(bootCanvas, bootContext);
      width = size.width; height = size.height;
      var mask = document.createElement('canvas'); mask.width = width; mask.height = height;
      var ctx = context(mask);
      if (!ctx) return false;
      var base = root.getBoundingClientRect();
      wordmark.querySelectorAll('[data-boot-word]').forEach(function (span) {
        var box = span.getBoundingClientRect(), style = getComputedStyle(span);
        var fontSize = parseFloat(style.fontSize);
        ctx.font = style.fontWeight + ' ' + style.fontSize + ' ' + style.fontFamily;
        if ('letterSpacing' in ctx) ctx.letterSpacing = style.letterSpacing;
        ctx.fillStyle = style.color; ctx.textBaseline = 'alphabetic';
        var metrics = ctx.measureText(span.textContent);
        var ascent = metrics.fontBoundingBoxAscent || fontSize * .9;
        var descent = metrics.fontBoundingBoxDescent || fontSize * .2;
        ctx.fillText(span.textContent, box.left - base.left, box.top - base.top + (box.height - ascent - descent) / 2 + ascent);
      });
      var pixels = ctx.getImageData(0, 0, width, height).data;
      var step = width < 600 ? 3 : 4, targets = [];
      for (var y = 0; y < height; y += step) for (var x = 0; x < width; x += step) {
        var i = (y * width + x) * 4;
        if (pixels[i + 3] > 110) targets.push({ x: x, y: y, color: 'rgb(' + pixels[i] + ',' + pixels[i + 1] + ',' + pixels[i + 2] + ')' });
      }
      var rand = random(28439), stride = Math.max(1, Math.ceil(targets.length / 1700));
      bootPoints = targets.filter(function (_, index) { return index % stride === 0; }).map(function (p, index) {
        var edge = index % 4, along = rand();
        return { x: p.x, y: p.y, color: p.color,
          fromX: edge === 0 ? -30 - rand() * 130 : edge === 1 ? width + 30 + rand() * 130 : along * width,
          fromY: edge === 2 ? -30 - rand() * 130 : edge === 3 ? height + 30 + rand() * 130 : along * height,
          delay: rand() * 260, duration: 1180 + rand() * 330,
          bend: (rand() - .5) * 150, radius: .65 + rand() * .7 };
      });
      return bootPoints.length > 0;
    }
    function bootTick(now) {
      if (!bootActive || document.visibilityState === 'hidden') return;
      try {
        var time = now - bootStart;
        bootContext.clearRect(0, 0, width, height);
        var fade = 1 - clamp((time - 1770) / 370);
        bootPoints.forEach(function (point) {
          var t = clamp((time - point.delay) / point.duration);
          var inverse = Math.pow(1 - t, 3);
          var bend = Math.sin(t * Math.PI) * (1 - t) * point.bend;
          var x = point.x + (point.fromX - point.x) * inverse + bend;
          var y = point.y + (point.fromY - point.y) * inverse - bend * .5;
          bootContext.globalAlpha = clamp((time - point.delay) / 240) * fade;
          bootContext.fillStyle = point.color;
          bootContext.beginPath(); bootContext.arc(x, y, point.radius + (1 - t) * .55, 0, Math.PI * 2); bootContext.fill();
          if (t > .05 && t < .85) {
            bootContext.globalAlpha *= .23; bootContext.strokeStyle = point.color; bootContext.lineWidth = .6;
            bootContext.beginPath(); bootContext.moveTo(x, y);
            bootContext.lineTo(x - (point.fromX - point.x) * inverse * .025, y - (point.fromY - point.y) * inverse * .025); bootContext.stroke();
          }
        });
        bootContext.globalAlpha = 1;
        if (time >= 1700) root.classList.add('is-boot-formed');
        if (time < 2180) bootFrame = requestAnimationFrame(bootTick);
        else { bootFrame = 0; bootContext.clearRect(0, 0, width, height); }
      } catch (_) { root.classList.add('is-boot-formed'); stopBoot(); }
    }
    function stopBoot() {
      bootActive = false; cancelAnimationFrame(bootFrame); bootFrame = 0;
      if (bootContext) bootContext.clearRect(0, 0, width, height);
    }
    function playBoot(reduced) {
      stopBoot(); root.classList.remove('is-boot-formed');
      if (reduced || !bootContext || !wordmark) { root.classList.add('is-boot-formed'); return; }
      bootActive = true; bootStart = performance.now();
      try {
        if (!prepareWord()) { root.classList.add('is-boot-formed'); stopBoot(); return; }
        bootFrame = requestAnimationFrame(bootTick);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () {
          if (bootActive && performance.now() - bootStart < 900) prepareWord();
        }).catch(function () {});
      } catch (_) { root.classList.add('is-boot-formed'); stopBoot(); }
    }
    function setWallpaper(url) {
      if (!url || url === artworkURL) return;
      try {
        var target = new URL(url, location.href);
        if (target.origin !== location.origin) return;
        artworkURL = url;
        var image = new Image(); image.decoding = 'async';
        image.onload = function () { if (artworkURL === url) artwork = image; };
        image.src = target.href;
      } catch (_) { artwork = null; }
    }
    function cancelReveal() {
      cancelAnimationFrame(revealFrame); revealFrame = 0;
      root.classList.remove('is-dissolving'); root.style.removeProperty('--gate-erosion');
      if (revealCanvas) revealCanvas.hidden = true;
      if (revealResolve) { var resolve = revealResolve; revealResolve = null; resolve(false); }
    }
    function reveal(guard) {
      cancelReveal();
      if (!revealContext) return Promise.resolve(false);
      var size = dimensions(revealCanvas, revealContext), w = size.width, h = size.height;
      var sample = document.createElement('canvas'); sample.width = 64; sample.height = 64;
      var sampler = context(sample), colors = null;
      try {
        if (sampler && artwork) {
          var scale = Math.max(64 / artwork.width, 64 / artwork.height);
          sampler.drawImage(artwork, (64 - artwork.width * scale) / 2, (64 - artwork.height * scale) / 2, artwork.width * scale, artwork.height * scale);
          colors = sampler.getImageData(0, 0, 64, 64).data;
        }
      } catch (_) { colors = null; }
      var rand = random(89121), points = [], gap = Math.sqrt(w * h / (w < 600 ? 850 : 1650));
      for (var y = gap / 2; y < h; y += gap) for (var x = gap / 2; x < w; x += gap) {
        var nx = (x - w / 2) / (w / 2), ny = (y - h / 2) / (h / 2);
        var distance = Math.sqrt(nx * nx + ny * ny), angle = Math.atan2(ny, nx);
        var index = (Math.min(63, Math.floor(y / h * 64)) * 64 + Math.min(63, Math.floor(x / w * 64))) * 4;
        var color = rand() > .72 ? '#efdeb2' : '#9dc9ac';
        if (colors && rand() > .35) color = 'rgb(' + Math.round(colors[index] * .58 + 45) + ',' + Math.round(colors[index + 1] * .58 + 55) + ',' + Math.round(colors[index + 2] * .58 + 38) + ')';
        points.push({ x: x, y: y, angle: angle, delay: clamp((1 - distance / Math.SQRT2) * .64 + rand() * .035), speed: 90 + rand() * 200, size: 1 + rand() * 2.2, color: color, drift: (rand() - .5) * 55 });
      }
      var start = performance.now();
      root.classList.add('is-dissolving'); revealCanvas.hidden = false;
      return new Promise(function (resolve) {
        revealResolve = resolve;
        function frame(now) {
          if (!guard()) { cancelReveal(); return; }
          try {
            var progress = clamp((now - start) / 1200);
            var ease = progress * progress * (3 - 2 * progress);
            root.style.setProperty('--gate-erosion', String(110 - ease * 116) + '%');
            revealContext.clearRect(0, 0, w, h);
            points.forEach(function (point) {
              if (progress <= point.delay) return;
              var t = clamp((progress - point.delay) / (1 - point.delay));
              var travel = Math.pow(t, .8) * point.speed;
              var x = point.x + Math.cos(point.angle) * travel + Math.sin(t * Math.PI) * point.drift;
              var y = point.y + Math.sin(point.angle) * travel - Math.sin(t * Math.PI) * 20;
              revealContext.globalAlpha = (1 - t) * .85;
              revealContext.fillStyle = point.color;
              revealContext.beginPath(); revealContext.arc(x, y, point.size * (1 - t * .65), 0, Math.PI * 2); revealContext.fill();
            });
            revealContext.globalAlpha = 1;
            if (progress < 1) revealFrame = requestAnimationFrame(frame);
            else { revealFrame = 0; revealCanvas.hidden = true; revealResolve = null; resolve(true); }
          } catch (_) { cancelReveal(); }
        }
        revealFrame = requestAnimationFrame(frame);
      });
    }
    window.addEventListener('resize', function () {
      if (bootActive && performance.now() - bootStart < 2180) {
        try { prepareWord(); } catch (_) { stopBoot(); root.classList.add('is-boot-formed'); }
      }
      if (revealResolve) cancelReveal();
    });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') { cancelAnimationFrame(bootFrame); bootFrame = 0; }
      else if (bootActive && !bootFrame) bootFrame = requestAnimationFrame(bootTick);
    });
    window.addEventListener('pagehide', function () { stopBoot(); cancelReveal(); });
    return Object.freeze({ playBoot: playBoot, stopBoot: stopBoot, reveal: reveal, cancelReveal: cancelReveal, setWallpaper: setWallpaper });
  }
  window.AidenGateMotion = Object.freeze({ create: create });
})();
