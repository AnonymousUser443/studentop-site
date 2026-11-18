(() => {
  'use strict';
  const { Data: D, Audio: A, util: U, DEFAULT_LANES, Timeline } = window.MW;
  const $ = Object.fromEntries([...document.querySelectorAll('[id]')].map(el => [el.id, el]));
  const PAGE = 36;
  const state = {
    buffer: null, duration: 0, fileName: '', fileSize: 0, fileMtime: 0, playhead: 0, rate: 1,
    lanes: DEFAULT_LANES.map(lane => ({ ...lane })), markers: [], selectedId: null,
    calibMs: 0, countIn: false, countInBeats: 4, follow: true, grid: { on: false, bpm: 100 }
  };
  let phase = '', loading = false, loadToken = 0, soundToken = 0, importToken = 0;
  let sorted = [], laneSnapshot = null, storedLanes = null, page = 0, changedFrame = 0, saveTimer = 0;
  let playbackFrame = 0, lastTimeDraw = -Infinity, timelineDraft = null, rangeDraft = null, rangePointer = null;
  let confirmation = null, calibrationBeat = 0;
  const rows = new Map(), pads = new Map(), laneRows = new Map(), presses = new WeakMap(), pulseTimers = new WeakMap();

  function status(text, kind = '') {
    if ($.statusMsg.textContent !== text) $.statusMsg.textContent = text;
    $.statusMsg.dataset.kind = kind;
  }

  function flushAutosave() {
    if (!saveTimer) return;
    clearTimeout(saveTimer);
    saveTimer = 0;
    D.autosaveMarkers();
  }

  function changed() {
    if (state.lanes !== storedLanes) { storedLanes = state.lanes; D.saveSettings(); }
    if (!changedFrame) changedFrame = requestAnimationFrame(renderChanges);
    if (state.fileName) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(flushAutosave, 400);
    }
  }

  function selectionChanged() {
    refreshSelection();
    T.invalidate();
  }

  const settings = D.loadSettings();
  if (settings) {
    const { grid, ...rest } = settings;
    Object.assign(state, rest);
    if (grid) Object.assign(state.grid, grid);
  }
  storedLanes = state.lanes;
  D.init({ state, ui: { changed, selectionChanged }, util: U });
  A.init({ state });

  const T = Timeline.create({
    state, wave: $.waveCanvas, lanes: $.lanesCanvas, layer: $.lanesWrap, wrap: $.timelineWrap, hint: $.gestureHint,
    seek, select: id => D.select(id), move(id, t) {
      if (D.moveMarker(id, t)) status(`已移动标记至 ${U.formatTime(t)}`);
    },
    manualView() {
      if (!state.follow) return;
      state.follow = false;
      $.chkFollow.checked = false;
      D.saveSettings();
    },
    previewSeek(t) { timelineDraft = t; drawTime(true); },
    onView(start, end) { $.viewInfo.textContent = end > start ? `${U.formatTime(start)} – ${U.formatTime(end)}` : '全曲'; },
    onPeaks(working) { $.waveProgress.hidden = !working; }
  });

  function loaded() { return !!state.buffer; }
  function make(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function button(cls, label, aria) {
    const el = make('button', cls, label);
    el.type = 'button';
    if (aria) el.setAttribute('aria-label', aria);
    return el;
  }
  function updateValue(input, value) { if (document.activeElement !== input && input.value !== value) input.value = value; }

  function syncLaneUI() {
    if (laneSnapshot === state.lanes) return;
    laneSnapshot = state.lanes;
    const keep = new Set(state.lanes.map(lane => lane.id));
    for (const [id, record] of pads) if (!keep.has(id)) { record.node.remove(); pads.delete(id); }
    for (const [id, record] of laneRows) if (!keep.has(id)) { record.node.remove(); laneRows.delete(id); }
    state.lanes.forEach((lane, index) => {
      let pad = pads.get(lane.id);
      if (!pad) {
        const node = button('pad');
        node.dataset.lane = lane.id;
        const key = make('kbd'), name = make('span', 'pad-name');
        node.append(key, name);
        listenTap(node, stamp => {
          const live = D.laneById(lane.id);
          if (live) tapLane(live, stamp);
        });
        pad = { node, key, name };
        pads.set(lane.id, pad);
      }
      if ($.lanePads.children[index] !== pad.node) $.lanePads.insertBefore(pad.node, $.lanePads.children[index] || null);
      pad.key.textContent = lane.key.toUpperCase();
      pad.name.textContent = lane.name;
      pad.node.title = `${lane.name}（${lane.key.toUpperCase()}）`;
      pad.node.setAttribute('aria-label', `打点：${lane.name}，快捷键 ${lane.key.toUpperCase()}`);
      pad.node.style.setProperty('--lane-color', lane.color);

      let row = laneRows.get(lane.id);
      if (!row) {
        const node = make('div', 'lane-edit');
        const key = make('input'); key.type = 'text'; key.maxLength = 1; key.autocomplete = 'off'; key.spellcheck = false;
        const name = make('input'); name.type = 'text'; name.maxLength = 12;
        const color = make('input'); color.type = 'color';
        const remove = button('btn square danger-text', '×');
        for (const [field, el] of Object.entries({ key, name, color })) {
          el.addEventListener('change', () => {
            const before = D.laneById(lane.id);
            if (!before) return;
            const value = field === 'key' ? el.value.trim().toLowerCase() : el.value.trim();
            if (value === before[field]) { el.value = before[field]; return; }
            if (!D.updateLane(lane.id, { [field]: value })) {
              el.value = before[field];
              status(field === 'key' ? '快捷键需为不重复的数字或英文字母。' : '轨道名称不能为空。', 'warn');
            } else el.value = D.laneById(lane.id)[field];
          });
        }
        remove.addEventListener('click', () => {
          const live = D.laneById(lane.id);
          if (!live) return;
          const n = state.markers.filter(m => m.lane === lane.id).length;
          const act = () => { if (D.removeLane(lane.id)) status(`已移除轨道「${live.name}」，可撤销。`); };
          if (n) ask(`移除轨道「${live.name}」和其中的 ${n} 个标记？可以撤销。`, '移除', act);
          else act();
        });
        node.append(key, name, color, remove);
        row = { node, key, name, color, remove };
        laneRows.set(lane.id, row);
      }
      if ($.laneList.children[index] !== row.node) $.laneList.insertBefore(row.node, $.laneList.children[index] || null);
      updateValue(row.key, lane.key); row.key.setAttribute('aria-label', `${lane.name}的快捷键`);
      updateValue(row.name, lane.name); row.name.setAttribute('aria-label', `${lane.name}的轨道名称`);
      updateValue(row.color, lane.color); row.color.setAttribute('aria-label', `${lane.name}的轨道颜色`);
      row.remove.setAttribute('aria-label', `移除轨道 ${lane.name}`);
      row.remove.disabled = state.lanes.length <= 1;
    });
    $.btnAddLane.disabled = state.lanes.length >= 16;
    $.laneCount.textContent = `${state.lanes.length} 轨`;
  }

  function renderRows() {
    const pages = Math.max(1, Math.ceil(sorted.length / PAGE));
    page = U.clamp(page, 0, pages - 1);
    const visible = sorted.slice(page * PAGE, (page + 1) * PAGE);
    const keep = new Set(visible.map(m => m.id));
    const focus = document.activeElement;
    for (const [id, row] of rows) if (!keep.has(id)) { row.node.remove(); rows.delete(id); }
    if (!visible.length) {
      if (!$.markerList.querySelector('.marker-empty')) $.markerList.replaceChildren(make('p', 'marker-empty', '还没有标记，点按打点板上的轨道即可添加。'));
    } else {
      $.markerList.querySelector('.marker-empty')?.remove();
      visible.forEach((mark, i) => {
        const lane = D.laneById(mark.lane);
        let row = rows.get(mark.id);
        if (!row) {
          const node = make('div', 'marker-row');
          node.dataset.marker = mark.id;
          const target = button('btn marker-select');
          const dot = make('span', 'dot'); dot.setAttribute('aria-hidden', 'true');
          const time = make('span', 'mono'), name = make('span', 'lane-caption');
          target.append(dot, time, name);
          target.addEventListener('click', () => {
            D.select(mark.id);
            const current = D.selected();
            if (current) { T.reveal(current.t); seek(current.t); }
          });
          const label = make('input'); label.type = 'text'; label.placeholder = '标签'; label.maxLength = 160;
          label.addEventListener('change', () => D.setLabel(mark.id, label.value));
          node.append(target, label);
          row = { node, target, time, name, label };
          rows.set(mark.id, row);
        }
        if ($.markerList.children[i] !== row.node) $.markerList.insertBefore(row.node, $.markerList.children[i] || null);
        const tc = U.formatTime(mark.t);
        row.time.textContent = tc;
        row.name.textContent = lane?.name || '轨道';
        row.node.style.setProperty('--lane-color', lane?.color || '#8ca894');
        row.label.setAttribute('aria-label', `${tc} ${row.name.textContent}标记的标签`);
        updateValue(row.label, mark.label);
      });
    }
    if (focus?.isConnected && $.markerList.contains(focus) && focus !== document.activeElement) focus.focus({ preventScroll: true });
    $.pager.hidden = pages < 2;
    $.pageInfo.textContent = `${page + 1} / ${pages}`;
    $.btnPreviousPage.disabled = page === 0;
    $.btnNextPage.disabled = page === pages - 1;
  }

  function refreshSelection() {
    const sel = D.selected();
    for (const [id, row] of rows) row.node.setAttribute('aria-current', String(id === sel?.id));
    $.selectedTime.textContent = sel ? U.formatTime(sel.t) : '—';
    $.btnEarlier.disabled = !sel;
    $.btnLater.disabled = !sel;
    $.btnDelete.disabled = !sel;
    $.btnUndo.disabled = !D.canUndo();
  }

  function renderChanges() {
    changedFrame = 0;
    syncLaneUI();
    sorted = D.sortedMarkers();
    T.updateMarks(sorted);
    renderRows();
    refreshSelection();
    const { bpm, perLane } = D.stats(sorted);
    for (const { laneId, name, count } of perLane) {
      const pad = pads.get(laneId);
      if (pad) pad.node.title = `${name}（${pad.key.textContent}）· ${count} 个标记`;
    }
    $.markerCount.textContent = `${sorted.length} 个`;
    $.statBpm.textContent = bpm ? bpm.toFixed(1) : '—';
    refreshControls();
  }

  function refreshControls() {
    const hasAudio = loaded(), busy = phase === 'calibration' || phase === 'cal-start';
    const playing = A.isPlaying();
    $.btnPlay.disabled = !hasAudio || busy || loading;
    $.btnStop.disabled = !hasAudio || busy || loading;
    $.playLabel.textContent = phase === 'count-in' ? '取消倒数' : phase === 'start' ? '取消' : playing ? '暂停' : '播放';
    $.btnPlay.querySelector('.play-icon').textContent = playing || phase === 'start' ? 'Ⅱ' : '▶';
    for (const el of [$.seekRange, $.btnJump, $.btnZoomIn, $.btnZoomOut, $.btnPanLeft, $.btnPanRight, $.btnFit, $.btnImport]) el.disabled = !hasAudio || loading;
    $.btnJson.disabled = !hasAudio;
    $.btnCsv.disabled = !hasAudio;
    $.btnClear.disabled = !state.markers.length;
    $.btnCalib.disabled = busy || loading;
    $.btnCalibCancel.hidden = !busy;
    $.btnCalibTap.hidden = phase !== 'calibration';
    for (const { node } of pads.values()) node.disabled = (!hasAudio && phase !== 'calibration') || loading || phase === 'count-in';
    $.padHint.textContent = phase === 'calibration' ? `校正中 · ${calibrationBeat}/16 拍` : '按键或轻点轨道';
  }

  function drawTime(force = false, stamp = performance.now()) {
    if (A.isPlaying()) state.playhead = A.getTime();
    const draft = timelineDraft ?? rangeDraft;
    const t = draft ?? state.playhead;
    T.setPlayhead(t, draft == null && A.isPlaying() && !phase && state.follow);
    if (!force && stamp - lastTimeDraw < 33) return;
    lastTimeDraw = stamp;
    const tc = U.formatTime(t);
    if ($.timeCur.textContent !== tc) $.timeCur.textContent = tc;
    if (rangePointer == null) $.seekRange.value = String(t);
    if (force) $.seekRange.setAttribute('aria-valuetext', tc);
    else if ($.seekRange.hasAttribute('aria-valuetext')) $.seekRange.removeAttribute('aria-valuetext');
  }

  function runTransport() {
    if (playbackFrame) return;
    const step = now => {
      playbackFrame = 0;
      if (!A.isPlaying()) return;
      drawTime(false, now);
      playbackFrame = requestAnimationFrame(step);
    };
    playbackFrame = requestAnimationFrame(step);
  }

  function seek(t) {
    if (!loaded()) return;
    const target = U.clamp(t, 0, state.duration);
    try {
      A.seek(target);
      if (state.follow) T.reveal(target);
      drawTime(true);
      if (!A.isPlaying() && phase === 'count-in') cancelPendingSound();
      refreshControls();
    } catch { status('跳转失败，请重新播放。', 'error'); }
  }

  function cancelPendingSound() {
    ++soundToken;
    A.cancelClicks();
    if (phase === 'calibration' || phase === 'cal-start') {
      $.calibSub.textContent = '校正已取消，原设置不变。';
    }
    if (phase === 'count-in') A.pause();
    phase = '';
  }

  async function playToggle() {
    if (!loaded() || loading || phase.startsWith('cal')) return;
    if (phase) {
      cancelPendingSound();
      status('已取消播放。');
    } else if (A.isPlaying()) {
      A.pause();
    } else {
      const token = ++soundToken;
      phase = 'start'; refreshControls();
      try {
        await A.ensure();
        if (token !== soundToken) return;
        phase = '';
        updateLatency();
        if (state.countIn) {
          phase = 'count-in';
          const beats = state.countInBeats;
          const finish = A.startCountIn(beats, beat => {
            if (token === soundToken) status(`起拍倒数 ${beat} / ${beats}`);
          }, () => {
            if (token !== soundToken || phase !== 'count-in') return;
            A.cancelClicks(); phase = ''; refreshControls(); status('播放中。');
          });
          A.play(finish);
          status('准备起拍…');
        } else { A.play(); status('播放中。'); }
        runTransport();
      } catch (error) {
        if (token !== soundToken) return;
        cancelPendingSound();
        status(error.message || '无法播放音频。', 'error');
      }
    }
    refreshControls(); drawTime(true);
  }

  function stop() {
    cancelPendingSound();
    A.stop();
    if (state.follow) T.reveal(0);
    refreshControls(); drawTime(true);
    status('已停止，播放位置回到开头。');
  }

  function listenTap(el, fn) {
    el.addEventListener('pointerdown', e => { if (e.button === 0) presses.set(el, e.timeStamp); });
    el.addEventListener('pointercancel', () => presses.delete(el));
    el.addEventListener('click', e => {
      const stamp = e.detail ? (presses.get(el) ?? e.timeStamp) : e.timeStamp;
      presses.delete(el);
      fn(stamp);
    });
  }

  function pulse(laneId) {
    const el = pads.get(laneId)?.node;
    if (!el) return;
    clearTimeout(pulseTimers.get(el));
    el.classList.add('is-tapped');
    pulseTimers.set(el, setTimeout(() => el.classList.remove('is-tapped'), 140));
  }

  function tapLane(lane, stamp) {
    if (phase === 'calibration') { pulse(lane.id); tapCalib(stamp); return; }
    if (!loaded() || loading || phase || $.modal.open) return;
    pulse(lane.id);
    const live = A.isPlaying();
    const t = U.clamp(A.getTime(stamp) - (live ? state.calibMs * state.rate / 1000 : 0), 0, state.duration);
    const mark = D.addMarker(t, lane.id, '');
    if (!mark) return;
    if (!live) D.select(mark.id);
    A.playBlip(D.laneIndex(lane.id));
    status(`${lane.name} · ${U.formatTime(t)}`);
  }

  function updateLatency() {
    const latency = A.latencyInfo();
    $.latencyHint.textContent = `浏览器输出延迟：${latency == null ? '—' : `${Math.round(latency * 1000)} ms（仅供参考）`}`;
  }

  function updateCalibValue() {
    $.calibBadge.textContent = state.calibMs ? `${state.calibMs} ms 补偿` : '未设置';
    $.calibInput.value = String(state.calibMs);
  }

  async function startCalib() {
    cancelPendingSound();
    A.pause();
    const token = ++soundToken;
    phase = 'cal-start';
    calibrationBeat = 0;
    refreshControls(); drawTime(true);
    try {
      await A.ensure();
      if (token !== soundToken) return;
      phase = 'calibration';
      updateLatency();
      refreshControls();
      $.calibSub.textContent = '听到节拍声就点按「跟拍」，也可以按空格或轨道键。每拍只记一次。';
      $.btnCalibTap.focus({ preventScroll: true });
      A.startCalibration(16, beat => {
        if (token !== soundToken) return;
        calibrationBeat = beat;
        $.padHint.textContent = `校正中 · ${beat}/16 拍`;
        $.btnCalibTap.textContent = `跟拍 ${beat}/16`;
      }, () => {
        if (token !== soundToken) return;
        const result = A.endCalibration();
        phase = '';
        $.btnCalibTap.textContent = '跟拍（空格）';
        if (result.count >= 5) {
          state.calibMs = U.clamp(Math.round(result.ms), 0, 600);
          D.saveSettings(); updateCalibValue();
          $.calibSub.textContent = `校正完成 · ${result.count} 个有效节拍，播放中打点会补偿 ${state.calibMs} ms。`;
        } else $.calibSub.textContent = `只有 ${result.count} 个有效节拍（至少需要 5 个），已保留原设置。`;
        if (document.activeElement === $.btnCalibTap) $.btnCalib.focus({ preventScroll: true });
        refreshControls();
      });
    } catch (error) {
      if (token !== soundToken) return;
      cancelPendingSound(); refreshControls();
      $.calibSub.textContent = error.message || '无法启动校正。';
    }
  }

  function tapCalib(stamp) {
    if (phase !== 'calibration') return;
    const result = A.calibrationTap(stamp);
    if (result) $.calibSub.textContent = `有效 ${result.count} 拍 · 上一拍偏差 ${Math.round(result.ms)} ms`;
  }

  function setLoading(on) {
    loading = on;
    $.loadingMask.hidden = !on;
    $.timelineWrap.setAttribute('aria-busy', String(on));
    refreshControls();
  }

  async function loadFile(file) {
    if (!file) return;
    if (!/^audio\//i.test(file.type) && !/\.(mp3|wav|wave|ogg|oga|m4a|mp4|flac|aac|aif|aiff|opus|webm|wma)$/i.test(file.name)) {
      status(`无法打开「${file.name}」：请选取音频文件。`, 'error'); return;
    }
    const token = ++loadToken;
    ++importToken;
    T.cancelGesture();
    cancelPendingSound();
    A.pause();
    drawTime(true);
    setLoading(true);
    status(`正在打开「${file.name}」…`);
    try {
      const { buffer, nativeRate } = await A.decode(file);
      if (token !== loadToken) return;
      flushAutosave();
      A.stop();
      Object.assign(state, { buffer, duration: buffer.duration, fileName: file.name, fileSize: file.size, fileMtime: file.lastModified, selectedId: null });
      state.markers = D.restoreMarkers() || [];
      D.resetHistory();
      page = 0;
      $.markerList.scrollTop = 0;
      $.emptyState.hidden = true;
      $.seekRange.max = String(buffer.duration);
      $.timeTotal.textContent = ` / ${U.formatTime(buffer.duration)}`;
      $.fileMeta.textContent = file.name;
      $.fileMeta.title = `${file.name} · ${nativeRate ? `${nativeRate / 1000} kHz 源音频` : `${buffer.sampleRate / 1000} kHz 解码`} · ${buffer.numberOfChannels} 声道`;
      T.load(buffer);
      changed(); drawTime(true); updateLatency();
      status(`已载入 · ${U.formatTime(buffer.duration)}${state.markers.length ? `，恢复 ${state.markers.length} 个暂存标记` : ''}`);
    } catch {
      if (token === loadToken) status(`无法解码「${file.name}」。可另存为 MP3 或 WAV 后重试。`, 'error');
    } finally {
      if (token === loadToken) setLoading(false);
    }
  }

  function ask(text, label, fn) {
    if ($.modal.open) return;
    T.cancelGesture();
    $.modalText.textContent = text;
    $.modalOk.textContent = label;
    confirmation = fn;
    $.modal.returnValue = '';
    $.modal.showModal();
  }

  function saveFile(contents, type, extension) {
    const stem = state.fileName.replace(/\.[^./]+$/, '') || 'markers';
    const url = URL.createObjectURL(new Blob([contents], { type }));
    const a = make('a');
    a.href = url; a.download = `${stem}-踩点.${extension}`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    status(`已生成 ${extension.toUpperCase()} 文件。`);
  }

  async function importFile(file) {
    if (!file || !loaded()) return;
    if (file.size > 8 * 1024 * 1024) { status('导入文件超过 8 MB，请拆成较小的标记文件。', 'warn'); return; }
    const token = ++importToken;
    let text;
    try { text = await file.text(); }
    catch { status('无法读取标记文件。', 'error'); return; }
    if (token !== importToken) return;
    const apply = () => {
      if (token !== importToken) return;
      const res = D.importJSON(text);
      if (!res.ok) { status(`导入失败：${res.error}。`, 'error'); return; }
      page = 0; $.markerList.scrollTop = 0;
      status(`已导入 ${res.count} 个标记，可撤销。`);
    };
    if (state.markers.length) ask(`导入会替换当前的 ${state.markers.length} 个标记，可能更新轨道设置。可以撤销。`, '导入', apply);
    else apply();
  }

  function undo() { if (D.undo()) status('已撤销上一步。'); }
  function removeMarker() { if (D.deleteSelected()) status('已删除标记，可撤销。'); }
  function nudge(delta) { if (D.nudge(state.selectedId, delta)) status(`选中时间 · ${U.formatTime(D.selected().t)}`); }
  function changeView(action) {
    if (!loaded()) return;
    if (state.follow) { state.follow = false; $.chkFollow.checked = false; D.saveSettings(); }
    action();
  }

  for (const opener of [$.btnOpen, $.btnEmptyOpen]) opener.addEventListener('click', () => $.fileInput.click());
  $.fileInput.addEventListener('change', () => { const file = $.fileInput.files[0]; $.fileInput.value = ''; loadFile(file); });
  let dragDepth = 0;
  const hasFiles = e => Array.from(e.dataTransfer?.types || []).includes('Files');
  function finishDrop() { dragDepth = 0; $.dropHint.hidden = true; }
  window.addEventListener('dragenter', e => { if (hasFiles(e)) { e.preventDefault(); dragDepth++; $.dropHint.hidden = false; } });
  window.addEventListener('dragover', e => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
  window.addEventListener('dragleave', e => { if (hasFiles(e) && --dragDepth <= 0) finishDrop(); });
  window.addEventListener('drop', e => {
    if (!hasFiles(e)) return;
    e.preventDefault(); finishDrop();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 1) { status('请一次拖入一个音频文件。', 'warn'); return; }
    loadFile(files[0]);
  });
  window.addEventListener('blur', finishDrop);
  window.addEventListener('pagehide', flushAutosave);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushAutosave(); else drawTime(true); });

  $.btnPlay.addEventListener('click', playToggle);
  $.btnStop.addEventListener('click', stop);
  $.rateSel.value = String(state.rate);
  $.rateSel.addEventListener('change', () => { A.setRate(Number($.rateSel.value)); D.saveSettings(); drawTime(true); });
  $.jumpForm.addEventListener('submit', e => {
    e.preventDefault();
    if (!loaded()) return;
    const t = U.parseTime($.jumpInput.value);
    if (t == null || t > state.duration) { status('请输入音频范围内的秒数，或分:秒.毫秒。', 'warn'); return; }
    T.reveal(t); seek(t);
  });
  $.seekRange.addEventListener('pointerdown', e => { if (e.button === 0) rangePointer = e.pointerId; });
  $.seekRange.addEventListener('input', () => {
    const t = Number($.seekRange.value);
    if (rangePointer != null) { rangeDraft = t; T.reveal(t); drawTime(true); }
    else { T.reveal(t); seek(t); }
  });
  function endRange(e, apply) {
    if (e?.pointerId !== rangePointer && e) return;
    const draft = rangeDraft;
    rangeDraft = rangePointer = null;
    if (apply && draft != null) seek(draft); else if (draft != null) drawTime(true);
  }
  window.addEventListener('pointerup', e => endRange(e, true));
  window.addEventListener('pointercancel', e => endRange(e, false));
  window.addEventListener('blur', () => endRange(null, false));
  A.onEnded(() => {
    if (phase === 'count-in') cancelPendingSound();
    refreshControls(); drawTime(true); status('播放结束，可以继续编辑。');
  });

  $.btnZoomIn.addEventListener('click', () => changeView(() => T.zoom(.67)));
  $.btnZoomOut.addEventListener('click', () => changeView(() => T.zoom(1.5)));
  $.btnPanLeft.addEventListener('click', () => changeView(() => T.pan(-.5)));
  $.btnPanRight.addEventListener('click', () => changeView(() => T.pan(.5)));
  $.btnFit.addEventListener('click', T.fit);
  $.chkFollow.checked = state.follow;
  $.chkFollow.addEventListener('change', () => { state.follow = $.chkFollow.checked; if (state.follow) T.reveal(state.playhead); D.saveSettings(); });
  $.chkGrid.checked = state.grid.on;
  $.gridControl.hidden = !state.grid.on;
  $.gridBpm.value = String(state.grid.bpm);
  $.chkGrid.addEventListener('change', () => {
    state.grid.on = $.chkGrid.checked; $.gridControl.hidden = !state.grid.on; T.invalidate(); D.saveSettings();
  });
  $.gridBpm.addEventListener('change', () => {
    state.grid.bpm = U.clamp(Math.round($.gridBpm.valueAsNumber || state.grid.bpm), 30, 240);
    $.gridBpm.value = String(state.grid.bpm); T.invalidate(); D.saveSettings();
  });

  $.btnCalib.addEventListener('click', startCalib);
  $.btnCalibCancel.addEventListener('click', () => { cancelPendingSound(); refreshControls(); $.btnCalib.focus(); });
  listenTap($.btnCalibTap, tapCalib);
  $.calibForm.addEventListener('submit', e => {
    e.preventDefault();
    if (!Number.isFinite($.calibInput.valueAsNumber)) return;
    state.calibMs = U.clamp(Math.round($.calibInput.valueAsNumber), 0, 600);
    updateCalibValue(); D.saveSettings(); status(`已设置 ${state.calibMs} ms 延迟补偿。`);
  });
  $.countInChk.checked = state.countIn;
  $.countInChk.addEventListener('change', () => { state.countIn = $.countInChk.checked; D.saveSettings(); });

  $.btnUndo.addEventListener('click', undo);
  $.btnDelete.addEventListener('click', removeMarker);
  $.btnEarlier.addEventListener('click', () => nudge(-.010));
  $.btnLater.addEventListener('click', () => nudge(.010));
  $.btnPreviousPage.addEventListener('click', () => { page--; $.markerList.scrollTop = 0; renderRows(); refreshSelection(); });
  $.btnNextPage.addEventListener('click', () => { page++; $.markerList.scrollTop = 0; renderRows(); refreshSelection(); });
  $.btnAddLane.addEventListener('click', () => { const lane = D.addLane(); if (lane) status(`已添加「${lane.name}」。`); });
  $.modal.addEventListener('close', () => {
    const fn = confirmation; confirmation = null;
    if ($.modal.returnValue === 'confirm') fn?.();
  });
  $.btnClear.addEventListener('click', () => ask(`清空全部 ${state.markers.length} 个标记？可以撤销。`, '清空', () => { if (D.clearMarkers()) status('已清空标记，可撤销。'); }));
  $.btnImport.addEventListener('click', () => $.importInput.click());
  $.importInput.addEventListener('change', () => { const file = $.importInput.files[0]; $.importInput.value = ''; importFile(file); });
  $.btnJson.addEventListener('click', () => saveFile(JSON.stringify(D.toJSON(), null, 2), 'application/json', 'json'));
  $.btnCsv.addEventListener('click', () => saveFile('\ufeff' + D.toCSV(), 'text/csv;charset=utf-8', 'csv'));

  document.addEventListener('keydown', e => {
    if (e.defaultPrevented || e.isComposing || $.modal.open || e.target.closest?.('input, select, textarea, [contenteditable=true]')) return;
    const key = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && key === 'z') { e.preventDefault(); if (!e.repeat) undo(); return; }
    if (e.altKey && !e.ctrlKey && !e.metaKey && ['arrowleft', 'arrowright'].includes(key) && D.selected()) {
      e.preventDefault(); nudge((key === 'arrowleft' ? -1 : 1) * (e.shiftKey ? .001 : .010)); return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (key === ' ' && !e.target.closest?.('button, summary, a')) {
      e.preventDefault();
      if (!e.repeat) { if (phase === 'calibration') tapCalib(e.timeStamp); else playToggle(); }
    } else if (key === 'delete' || key === 'backspace') {
      if (D.selected()) { e.preventDefault(); if (!e.repeat) removeMarker(); }
    } else if (loaded() && ['arrowleft', 'arrowright', 'home', 'end'].includes(key) && !e.target.closest?.('button, summary, a, .lanes-window')) {
      const t = key === 'home' ? 0 : key === 'end' ? state.duration : A.getTime() + (e.shiftKey ? 1 : .1) * (key === 'arrowleft' ? -1 : 1);
      e.preventDefault(); seek(t);
    } else if (loaded() && ['+', '=', '-'].includes(key)) {
      e.preventDefault(); changeView(() => T.zoom(key === '-' ? 1.5 : .67));
    } else if (!e.repeat) {
      const lane = state.lanes.find(l => l.key === key);
      if (lane && (loaded() || phase === 'calibration')) { e.preventDefault(); tapLane(lane, e.timeStamp); }
    }
  });

  updateCalibValue();
  renderChanges();
  drawTime(true);
})();
