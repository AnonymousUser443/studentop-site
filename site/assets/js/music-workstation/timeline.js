/* Static canvas layers + composited playhead. Pointer moves are folded into at most one update per frame. */
window.MW.Timeline = (() => {
  'use strict';
  const C = {
    ink: '#112f2a', jade: '#193c37', shade: '#153630', row: '#1c4038', gutter: '#20483e',
    rule: '#406258', subtle: '#a9c3b2', paper: '#f4ebcb', wave: '#b5ccab', gold: '#f7d486'
  };
  const RULER = 25, DENSITY = 10, MAX_BINS = 32768, MAX_RAW_SAMPLES = 160000;
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

  function lowerBound(list, time) {
    let lo = 0, hi = list.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (list[mid].t < time) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  function create({ state, wave, lanes, layer, wrap, hint, seek, select, move, manualView, previewSeek, onView, onPeaks }) {
    const heads = [...wrap.querySelectorAll('.playhead')];
    const dragMark = document.createElement('span');
    dragMark.className = 'drag-mark';
    dragMark.hidden = true;
    layer.append(dragMark);
    const fw = wave.getContext('2d', { alpha: false });
    const fl = lanes.getContext('2d', { alpha: false });
    const view = { start: 0, end: 0 };
    let width = 0, waveH = 0, lanesH = 0, gutter = 90, rowH = 36, dpr = 0;
    let peaks = null, version = 0, peakTimer = 0, channels = [];
    let sorted = [], laneIndex = new Map(), byLane = new Map(), byId = new Map();
    let frame = 0, playhead = 0, gesture = null, gestureDirty = false, paintNeeded = true, sizeNeeded = true;
    let lastView = '', lastPos = null;
    const pointers = new Map();
    const plot = () => Math.max(1, width - gutter);
    const span = () => view.end - view.start || 1;
    const fracAt = x => clamp((x - gutter) / plot(), 0, 1);
    const xForTime = t => gutter + (t - view.start) * plot() / span();
    const timeForX = x => view.start + fracAt(x) * span();
    const px = n => Math.round(n * dpr) / dpr;

    function setView(start, len) {
      const dur = state.duration;
      if (!(dur > 0)) return;
      const s = clamp(len, Math.min(.15, dur), dur);
      const left = clamp(start, 0, dur - s);
      if (Math.abs(left - view.start) < 1e-8 && Math.abs(left + s - view.end) < 1e-8) return;
      view.start = left;
      view.end = left + s;
      invalidate();
    }

    function zoom(factor, anchorX = gutter + plot() / 2) {
      if (!state.buffer || !Number.isFinite(factor) || factor <= 0) return;
      const f = fracAt(anchorX);
      const size = clamp(span() * factor, Math.min(.15, state.duration), state.duration);
      setView(timeForX(anchorX) - f * size, size);
    }

    function fit() { setView(0, state.duration); }
    function pan(fraction) { setView(view.start + span() * fraction, span()); }

    function syncSize() {
      sizeNeeded = false;
      const w = wave.clientWidth, wh = wave.clientHeight, lh = lanes.clientHeight;
      if (!w || !wh || !lh) return;
      const scale = clamp(devicePixelRatio || 1, 1, 2);
      if (w === width && wh === waveH && lh === lanesH && dpr === scale) return;
      width = w; waveH = wh; lanesH = lh; dpr = scale;
      gutter = width < 560 ? 66 : 92;
      for (const [canvas, ctx, height] of [[wave, fw, wh], [lanes, fl, lh]]) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      paintNeeded = true;
      lastPos = null;
    }

    function updateMarks(markers) {
      sorted = markers;
      laneIndex = new Map(state.lanes.map((lane, i) => [lane.id, i]));
      byLane = new Map(state.lanes.map(lane => [lane.id, []]));
      byId = new Map();
      sorted.forEach(m => { byLane.get(m.lane)?.push(m); byId.set(m.id, m); });
      rowH = matchMedia('(any-pointer: coarse)').matches ? 42 : 36;
      layer.style.height = `${state.lanes.length * rowH}px`;
      sizeNeeded = true;
      invalidate();
    }

    function computePeaks(buffer) {
      const token = ++version;
      clearTimeout(peakTimer);
      peaks = null;
      channels = Array.from({ length: Math.min(2, buffer.numberOfChannels) }, (_, i) => buffer.getChannelData(i));
      const length = buffer.length;
      const n = Math.min(MAX_BINS, length);
      const min = new Float32Array(n), max = new Float32Array(n);
      let bin = 0;
      const ch0 = channels[0], ch1 = channels[1];
      onPeaks(true);

      function step() {
        if (token !== version) return;
        const deadline = performance.now() + 5;
        while (bin < n) {
          const end = Math.floor((bin + 1) * length / n);
          let lo = 0, hi = 0;
          for (let i = Math.floor(bin * length / n); i < end; i++) {
            const v = ch0[i];
            if (v < lo) lo = v;
            if (v > hi) hi = v;
            if (ch1) {
              const right = ch1[i];
              if (right < lo) lo = right;
              if (right > hi) hi = right;
            }
          }
          min[bin] = lo; max[bin] = hi;
          if ((++bin & 63) === 0 && performance.now() >= deadline) break;
        }
        if (bin < n) peakTimer = setTimeout(step, 0);
        else {
          peaks = { min, max, n };
          onPeaks(false);
          invalidate();
        }
      }
      peakTimer = setTimeout(step, 0);
    }

    function load(buffer) {
      cancelGesture();
      fit();
      computePeaks(buffer);
      invalidate();
    }

    function tickStep(raw) {
      const base = 10 ** Math.floor(Math.log10(Math.max(.001, raw)));
      return ([1, 2, 5, 10].find(a => a * base >= raw) || 10) * base;
    }

    function paintRuler() {
      fw.fillStyle = C.jade;
      fw.fillRect(0, 0, width, RULER);
      fw.fillStyle = C.paper;
      fw.font = '11px ui-monospace, Consolas, monospace';
      fw.textBaseline = 'middle';
      fw.fillText('波形', 10, RULER / 2 + .5);
      if (!state.buffer) return;
      const step = tickStep(span() * 82 / plot());
      for (let t = Math.ceil(view.start / step) * step; t <= view.end + 1e-8; t += step) {
        const x = px(xForTime(t));
        fw.fillStyle = '#294e44';
        fw.fillRect(x, RULER - 5, 1, waveH - RULER + 5);
        if (x < width - 31) {
          const label = MW.util.formatTime(t);
          fw.fillStyle = C.subtle;
          fw.fillText(step >= 1 ? label.split('.')[0] : label, x + 4, RULER / 2 + .5);
        }
      }
    }

    function paintWave() {
      fw.fillStyle = C.ink;
      fw.fillRect(0, 0, width, waveH);
      paintRuler();
      fw.fillStyle = C.rule;
      fw.fillRect(gutter - 1, 0, 1, waveH);
      const mid = (RULER + waveH - DENSITY) / 2;
      const amplitude = Math.max(0, mid - RULER - 5);
      fw.fillStyle = '#365c50';
      fw.fillRect(gutter, px(mid), plot(), 1);
      if (peaks && amplitude > 0) {
        const from = view.start / state.duration, len = span() / state.duration;
        const samples = state.buffer.length;
        const raw = len * peaks.n < plot() && len * samples <= MAX_RAW_SAMPLES;
        const items = raw ? samples : peaks.n;
        const ch0 = channels[0], ch1 = channels[1];
        fw.strokeStyle = C.wave;
        fw.lineWidth = 1;
        fw.beginPath();
        // Envelope work is bounded by the cache size (or a small visible raw span), not total PCM length.
        for (let i = 0; i < plot(); i++) {
          const a = Math.floor((from + len * i / plot()) * items);
          const b = Math.min(items, Math.max(a + 1, Math.ceil((from + len * (i + 1) / plot()) * items)));
          let lo = 0, hi = 0;
          for (let j = a; j < b; j++) {
            if (raw) {
              const l = ch0[j], r = ch1 ? ch1[j] : l;
              if (l < lo) lo = l;
              if (r < lo) lo = r;
              if (l > hi) hi = l;
              if (r > hi) hi = r;
            } else {
              if (peaks.min[j] < lo) lo = peaks.min[j];
              if (peaks.max[j] > hi) hi = peaks.max[j];
            }
          }
          const x = gutter + i + .5;
          fw.moveTo(x, mid - clamp(hi, 0, 1) * amplitude);
          fw.lineTo(x, mid - clamp(lo, -1, 0) * amplitude + .5);
        }
        fw.stroke();
      }
      fw.fillStyle = '#173a33';
      fw.fillRect(gutter, waveH - DENSITY, plot(), DENSITY);
      if (!sorted.length) return;
      const bins = Math.min(150, Math.ceil(plot() / 5));
      const bucket = Math.max(1, plot() / bins);
      let from = lowerBound(sorted, view.start);
      fw.fillStyle = '#a68f57';
      for (let i = 0; i < bins; i++) {
        const to = lowerBound(sorted, view.start + (i + 1) * span() / bins + (i === bins - 1 ? 1e-8 : 0));
        const count = to - from;
        if (count) {
          const h = Math.min(DENSITY - 1, Math.log2(count + 1) * 2.3 + 1);
          fw.fillRect(gutter + i * bucket, waveH - h, Math.max(1, bucket - 1), h);
        }
        from = to;
      }
    }

    function paintLanes() {
      fl.fillStyle = C.shade;
      fl.fillRect(0, 0, width, lanesH);
      state.lanes.forEach((lane, i) => {
        const y = i * rowH;
        if (i % 2 === 0) {
          fl.fillStyle = C.row;
          fl.fillRect(gutter, y, plot(), rowH);
        }
        fl.fillStyle = C.gutter;
        fl.fillRect(0, y, gutter, rowH);
        fl.fillStyle = lane.color;
        fl.fillRect(9, y + rowH / 2 - 3, 6, 6);
        fl.fillStyle = C.paper;
        fl.font = '12px "HarmonyOS Sans SC", "Microsoft YaHei", sans-serif';
        fl.textBaseline = 'middle';
        fl.fillText(lane.name, 21, y + rowH / 2, gutter - 26);
        fl.fillStyle = C.rule;
        fl.fillRect(0, y + rowH - 1, width, 1);
      });
      fl.fillStyle = C.rule;
      fl.fillRect(gutter - 1, 0, 1, lanesH);
      if (!state.buffer) return;
      fl.save();
      fl.beginPath(); fl.rect(gutter, 0, plot(), lanesH); fl.clip();
      if (state.grid.on) {
        const beat = 60 / state.grid.bpm;
        const stride = Math.max(1, Math.ceil(8 * span() / (plot() * beat)));
        const step = beat * stride;
        for (let t = Math.ceil(view.start / step) * step; t <= view.end + 1e-8; t += step) {
          fl.fillStyle = Math.round(t / beat) % 4 === 0 ? '#a592625e' : '#7d9d7e4d';
          fl.fillRect(px(xForTime(t)), 0, 1, lanesH);
        }
      }
      const selected = byId.get(state.selectedId);
      state.lanes.forEach((lane, row) => {
        const list = byLane.get(lane.id) || [];
        const start = lowerBound(list, view.start), end = lowerBound(list, view.end + 1e-8);
        const y = row * rowH + 5;
        fl.fillStyle = lane.color;
        if (end - start > plot() * 2) {
          let prev = start;
          for (let x = 0; x < plot(); x += 2) {
            const next = lowerBound(list, timeForX(gutter + x + 2) + (x + 2 >= plot() ? 1e-8 : 0));
            if (next > prev) fl.fillRect(gutter + x, y, 2, rowH - 10);
            prev = next;
          }
        } else {
          for (let i = start; i < end; i++) fl.fillRect(px(xForTime(list[i].t)) - 2, y, 4, rowH - 10);
        }
        if (selected?.lane === lane.id && selected.t >= view.start && selected.t <= view.end) {
          const x = px(xForTime(selected.t));
          fl.fillStyle = C.gold;
          fl.fillRect(x - 4, y - 2, 8, rowH - 6);
          fl.fillStyle = C.ink;
          fl.fillRect(x - 1, y + 2, 2, rowH - 14);
        }
      });
      fl.restore();
    }

    function drawPlayhead() {
      const x = px(xForTime(playhead));
      const visible = !!state.buffer && playhead >= view.start && playhead <= view.end && x >= gutter;
      const limit = Math.min(width - 1, x);
      if (lastPos === (visible ? limit : -1)) return;
      lastPos = visible ? limit : -1;
      heads.forEach(node => {
        node.hidden = !visible;
        if (visible) node.style.transform = `translateX(${limit}px)`;
      });
    }

    function setPlayhead(t, follow) {
      playhead = t;
      if (follow && !gesture && state.duration > span()) {
        if (t < view.start || t > view.start + span() * .88) setView(t - span() * .23, span());
      }
      // No canvas paint when only the playback cursor moves.
      if (!frame) drawPlayhead();
    }

    function paint() {
      if (!paintNeeded || !width) return;
      paintNeeded = false;
      paintWave();
      paintLanes();
      const key = `${view.start},${view.end}`;
      if (key !== lastView) { lastView = key; onView(view.start, view.end); }
    }

    function requestFrame() {
      if (!frame) frame = requestAnimationFrame(() => {
        if (sizeNeeded) syncSize();
        if (gestureDirty) flushGesture();
        paint();
        drawPlayhead();
        frame = 0;
      });
    }
    function invalidate() { paintNeeded = true; requestFrame(); }

    function local(el, pointer) {
      const rect = el.getBoundingClientRect();
      return { x: pointer.x - rect.left, y: pointer.y - rect.top };
    }

    function hit(x, y, type) {
      if (x < gutter) return null;
      const lane = state.lanes[Math.floor(y / rowH)];
      const list = lane && byLane.get(lane.id);
      if (!list?.length) return null;
      const i = lowerBound(list, timeForX(x));
      const tolerance = type === 'touch' ? 17 : (type === 'pen' ? 11 : 7);
      const chosen = byId.get(state.selectedId);
      const near = [list[i], list[i - 1], chosen?.lane === lane.id ? chosen : null].filter(m => m && m.t >= view.start && m.t <= view.end);
      let best = null, distance = tolerance + .001;
      for (const m of near) {
        const gap = Math.abs(xForTime(m.t) - x);
        if (gap < distance || (gap === distance && m === chosen)) { best = m; distance = gap; }
      }
      return best;
    }

    function showHint(text) {
      hint.hidden = !text;
      if (text && hint.textContent !== text) hint.textContent = text;
    }

    function setGesture(kind) {
      gesture.kind = kind;
      wrap.dataset.gesture = kind;
    }

    function discardPreview() {
      dragMark.hidden = true;
      previewSeek(null);
      showHint('');
    }

    function pinchMetrics() {
      const [a, b] = [...pointers.values()];
      if (!b) return null;
      return { width: Math.max(12, Math.hypot(b.x - a.x, b.y - a.y)), center: local(wave, { x: (a.x + b.x) / 2, y: 0 }).x };
    }

    function onDown(e) {
      if (!state.buffer || e.button < 0 || e.button > 1 || pointers.size > 1) return;
      if (pointers.size && (e.pointerType !== 'touch' || [...pointers.values()][0].type !== 'touch')) return;
      if (sizeNeeded) syncSize();
      const el = e.currentTarget;
      const p = { id: e.pointerId, el, type: e.pointerType, x: e.clientX, y: e.clientY };
      const pos = local(el, p);
      if (!pointers.size && pos.x < gutter) return;
      pointers.set(p.id, p);
      try { el.setPointerCapture(p.id); } catch { pointers.delete(p.id); return; }
      if (pointers.size === 2) {
        discardPreview();
        const metrics = pinchMetrics();
        gesture = { ...metrics, span: span(), anchor: timeForX(metrics.center) };
        setGesture('pinch');
        manualView();
        return;
      }
      const panning = e.shiftKey || e.button === 1;
      const marker = !panning && el === lanes ? hit(pos.x, pos.y, p.type) : null;
      gesture = {
        firstX: p.x, firstY: p.y, start: view.start, span: span(),
        marker,
        intended: panning || (!marker && p.type === 'touch') ? 'pan' : marker ? 'marker' : 'scrub',
        tapOnly: panning
      };
      setGesture('pending');
      if (e.pointerType === 'mouse') e.preventDefault();
    }

    function flushGesture() {
      gestureDirty = false;
      if (!gesture) return;
      if (gesture.kind === 'pinch') {
        const m = pinchMetrics();
        if (!m) return;
        const size = clamp(gesture.span * gesture.width / m.width, Math.min(.15, state.duration), state.duration);
        setView(gesture.anchor - fracAt(m.center) * size, size);
        return;
      }
      const p = pointers.values().next().value;
      if (!p || gesture.kind === 'blocked') return;
      const dx = p.x - gesture.firstX, dy = p.y - gesture.firstY;
      if (gesture.kind === 'pending') {
        const threshold = p.type === 'touch' ? 8 : 3;
        if (p.type === 'touch' && Math.abs(dy) > threshold && Math.abs(dy) > Math.abs(dx)) { setGesture('blocked'); return; }
        if (Math.abs(dx) < threshold) return;
        setGesture(gesture.intended);
        if (gesture.kind === 'pan') manualView();
        if (gesture.kind === 'marker') select(gesture.marker.id);
      }
      if (gesture.kind === 'pan') {
        setView(gesture.start - dx * gesture.span / plot(), gesture.span);
      } else if (gesture.kind === 'marker') {
        // Preserve where the finger grabbed the mark; a generous hit box shouldn't snap its time.
        gesture.time = clamp(gesture.marker.t + dx * span() / plot(), 0, state.duration);
        const x = clamp(xForTime(gesture.time), gutter, width - 2);
        const y = (laneIndex.get(gesture.marker.lane) || 0) * rowH + 3;
        dragMark.style.transform = `translate(${px(x) - 3}px, ${y}px)`;
        dragMark.style.height = `${rowH - 6}px`;
        dragMark.hidden = false;
        showHint(MW.util.formatTime(gesture.time));
      } else if (gesture.kind === 'scrub') {
        gesture.time = timeForX(local(p.el, p).x);
        previewSeek(gesture.time);
        showHint(MW.util.formatTime(gesture.time));
      }
    }

    function onMove(e) {
      const p = pointers.get(e.pointerId);
      if (p) {
        p.x = e.clientX; p.y = e.clientY;
        gestureDirty = true;
        requestFrame();
      } else if (!gesture && e.pointerType === 'mouse' && e.currentTarget === lanes) {
        const pos = local(lanes, { x: e.clientX, y: e.clientY });
        const value = hit(pos.x, pos.y, e.pointerType) ? 'marker' : '';
        if (wrap.dataset.hover !== value) wrap.dataset.hover = value;
      }
    }

    function release(p) {
      pointers.delete(p.id);
      if (p.el.hasPointerCapture(p.id)) p.el.releasePointerCapture(p.id);
    }

    function cancelGesture() {
      const hadGesture = !!gesture;
      gesture = null;
      gestureDirty = false;
      for (const p of pointers.values()) release(p);
      delete wrap.dataset.gesture;
      if (hadGesture) discardPreview();
    }

    function onUp(e) {
      const p = pointers.get(e.pointerId);
      if (!p || !gesture) return;
      p.x = e.clientX; p.y = e.clientY;
      flushGesture();
      const { kind, marker, time, tapOnly } = gesture;
      if (kind === 'pinch' || pointers.size > 1) { release(p); setGesture('blocked'); return; }
      cancelGesture();
      if (kind === 'marker') move(marker.id, time);
      else if (kind === 'scrub') { select(null); seek(time); }
      else if (kind === 'pending' && !tapOnly) {
        if (marker) select(marker.id);
        else { select(null); seek(timeForX(local(p.el, p).x)); }
      }
    }

    function onWheel(e) {
      if (!state.buffer) return;
      const delta = e.deltaMode === 1 ? 18 : (e.deltaMode === 2 ? width : 1);
      if ((e.ctrlKey || e.metaKey) && e.deltaY) {
        e.preventDefault();
        manualView();
        zoom(Math.exp(clamp(e.deltaY * delta * .004, -1, 1)), local(wave, { x: e.clientX, y: e.clientY }).x);
      } else if ((Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) && state.duration > span()) {
        e.preventDefault();
        manualView();
        pan((e.deltaX || e.deltaY) * delta / plot());
      }
    }

    for (const el of [wave, lanes]) {
      el.addEventListener('pointerdown', onDown);
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', e => { if (pointers.has(e.pointerId)) cancelGesture(); });
      el.addEventListener('lostpointercapture', e => { if (pointers.has(e.pointerId)) cancelGesture(); });
      el.addEventListener('pointerleave', () => { delete wrap.dataset.hover; });
      el.addEventListener('wheel', onWheel, { passive: false });
    }
    const resize = () => { sizeNeeded = true; requestFrame(); };
    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(resize);
      observer.observe(wave);
      observer.observe(lanes);
    }
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('blur', cancelGesture);
    updateMarks([]);
    return { load, fit, zoom, pan, updateMarks, invalidate, setPlayhead, cancelGesture, reveal(t) {
      if (t < view.start || t > view.end) setView(t - span() * .4, span());
    } };
  }

  return { create };
})();
