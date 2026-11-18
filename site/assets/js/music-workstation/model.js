(function (window) {
  'use strict';

  const MW = window.MW || (window.MW = {});
  const DEFAULT_LANES = MW.DEFAULT_LANES = Object.freeze([
    { id: 'L1', key: '1', name: '强拍', color: '#e8c77f' },
    { id: 'L2', key: '2', name: '弱拍', color: '#9ab0a7' },
    { id: 'L3', key: '3', name: '明快', color: '#aaca95' },
    { id: 'L4', key: '4', name: '沉郁', color: '#c89994' },
    { id: 'L5', key: '5', name: '爆发', color: '#e3a17b' },
    { id: 'L6', key: '6', name: '收束', color: '#8ec0c5' }
  ].map(Object.freeze));
  const KEY_ORDER = '1234567890abcdefghijklmnopqrstuvwxyz';
  const LANE_LIMIT = 16;
  const LABEL_LIMIT = 160;
  const HISTORY_LIMIT = 40;
  const MAX_SECONDS = Number.MAX_SAFE_INTEGER / 1000;
  const SETTINGS_KEY = 'mw.settings.v1';
  const VERSION = 'mwtap-1';

  function clamp(value, min, max) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
  }

  function formatTime(seconds) {
    const ms = Math.round(clamp(seconds, 0, MAX_SECONDS) * 1000);
    const min = Math.floor(ms / 60000);
    const sec = Math.floor((ms % 60000) / 1000);
    const pad = (value, width) => String(value).padStart(width, '0');
    return `${pad(min, 2)}:${pad(sec, 2)}.${pad(ms % 1000, 3)}`;
  }

  function parseTime(text) {
    if (typeof text !== 'string') return null;
    const parts = text.trim().split(':');
    if (parts.length > 3) return null;
    let seconds = 0;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      const pattern = i === parts.length - 1 ? /^(?:\d+(?:\.\d*)?|\.\d+)$/ : /^\d+$/;
      if (!pattern.test(part)) return null;
      seconds = seconds * 60 + Number(part);
    }
    return Number.isFinite(seconds) ? seconds : null;
  }

  const util = MW.util = { formatTime, clamp, parseTime };
  const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const owns = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  const safeId = id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(id) && !(id in Object.prototype);

  function limitText(text, limit) {
    // Keep the input bound in UTF-16 units without leaving half a surrogate pair.
    return text.slice(0, limit).replace(/[\uD800-\uDBFF]$/, '');
  }

  function labelText(value) {
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') return '';
    return limitText(String(value), LABEL_LIMIT);
  }

  function laneKey(value) {
    const key = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return /^[a-z0-9]$/.test(key) ? key : '';
  }

  function laneName(value) {
    return typeof value === 'string' ? limitText(value.trim(), 12) : '';
  }

  function laneColor(value) {
    return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : '';
  }

  function validatedLanes(rows) {
    if (!Array.isArray(rows) || !rows.length || rows.length > LANE_LIMIT) return null;
    const ids = new Set();
    const keys = new Set();
    const lanes = [];
    for (const row of rows) {
      if (!isRecord(row) || !safeId(row.id) || ids.has(row.id)) return null;
      const key = laneKey(row.key);
      const name = laneName(row.name);
      const color = laneColor(row.color);
      if (!key || keys.has(key) || !name || !color) return null;
      ids.add(row.id);
      keys.add(key);
      lanes.push({ id: row.id, key, name, color });
    }
    return lanes;
  }

  let state = null;
  let ui;
  let display = util;
  const history = [];
  const markerPrefix = `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}_`;
  let markerSeq = 0;
  const nextMarkerId = () => markerPrefix + (++markerSeq).toString(36);

  function init({ state: sharedState, ui: controller, util: helpers = util }) {
    state = sharedState;
    ui = controller;
    display = helpers;
    resetHistory();
  }

  function resetHistory() {
    history.length = 0;
  }

  // Keep inverse edits, not a copy of every marker for each tap or move.
  function remember(revert) {
    history.push({ revert, selectedId: state.selectedId });
    if (history.length > HISTORY_LIMIT) history.shift();
  }

  function changed() {
    ui?.changed?.();
    return true;
  }

  function undo() {
    const entry = history.pop();
    if (!entry) return false;
    entry.revert();
    state.selectedId = entry.selectedId;
    return changed();
  }

  function laneIndex(id) {
    return state ? state.lanes.findIndex(lane => lane.id === id) : -1;
  }

  function laneById(id) {
    const index = laneIndex(id);
    return index < 0 ? null : state.lanes[index];
  }

  function markerById(id) {
    return state ? state.markers.find(marker => marker.id === id) || null : null;
  }

  function selected() {
    return state?.selectedId == null ? null : markerById(state.selectedId);
  }

  function select(id) {
    if (!state) return false;
    const next = id != null && markerById(id) ? id : null;
    if (next === state.selectedId) return false;
    state.selectedId = next;
    ui?.selectionChanged?.();
    return true;
  }

  function clampTime(t) {
    const duration = state.duration;
    const max = Number.isFinite(duration) && duration > 0 ? Math.min(duration, MAX_SECONDS) : MAX_SECONDS;
    return clamp(t, 0, max);
  }

  function addMarker(t, laneId, label) {
    if (!Number.isFinite(t) || !laneById(laneId)) return null;
    let id;
    do { id = nextMarkerId(); } while (markerById(id));
    const marker = { id, t: clampTime(t), lane: laneId, label: labelText(label) };
    const markers = state.markers;
    const index = markers.length;
    remember(() => markers.splice(index, 1));
    markers.push(marker);
    changed();
    return marker;
  }

  function deleteSelected() {
    if (!state || state.selectedId == null) return false;
    const markers = state.markers;
    const index = markers.findIndex(marker => marker.id === state.selectedId);
    if (index < 0) return false;
    const marker = markers[index];
    remember(() => markers.splice(index, 0, marker));
    markers.splice(index, 1);
    state.selectedId = null;
    return changed();
  }

  function editMarker(marker, field, value) {
    if (marker[field] === value) return false;
    const before = marker[field];
    remember(() => { marker[field] = before; });
    marker[field] = value;
    return changed();
  }

  // The timeline supplies the final timestamp once on drag release.
  function moveMarker(id, t) {
    const marker = markerById(id);
    return marker && Number.isFinite(t) ? editMarker(marker, 't', clampTime(t)) : false;
  }

  function nudge(id, dt) {
    const marker = markerById(id);
    return marker && Number.isFinite(dt) ? editMarker(marker, 't', clampTime(marker.t + dt)) : false;
  }

  function setLabel(id, label) {
    const marker = markerById(id);
    return marker ? editMarker(marker, 'label', labelText(label)) : false;
  }

  function replaceMarkers(markers, lanes = state.lanes) {
    const oldMarkers = state.markers;
    const oldLanes = state.lanes;
    if (!oldMarkers.length && !markers.length && lanes === oldLanes) return false;
    remember(() => {
      state.markers = oldMarkers;
      if (lanes !== oldLanes) state.lanes = oldLanes;
    });
    state.markers = markers;
    state.lanes = lanes;
    state.selectedId = null;
    return changed();
  }

  function clearMarkers() {
    return state ? replaceMarkers([]) : false;
  }

  function sortedMarkers() {
    return state ? state.markers.slice().sort((a, b) => a.t - b.t) : [];
  }

  function stats(markers = sortedMarkers()) {
    const counts = new Map();
    const gaps = [];
    for (let i = 0; i < markers.length; i++) {
      const marker = markers[i];
      counts.set(marker.lane, (counts.get(marker.lane) || 0) + 1);
      // Allow for floating-point subtraction at the 50 ms boundary.
      if (i > 0 && marker.t - markers[i - 1].t >= 0.05 - 1e-9) gaps.push(marker.t - markers[i - 1].t);
    }
    const perLane = (state?.lanes || []).map(({ id, name, color }) => ({ laneId: id, name, color, count: counts.get(id) || 0 }));
    const bpmBasis = gaps.length;
    let bpm = null;
    if (bpmBasis >= 3) {
      gaps.sort((a, b) => a - b);
      const middle = Math.floor(bpmBasis / 2);
      const median = bpmBasis % 2 ? gaps[middle] : (gaps[middle - 1] + gaps[middle]) / 2;
      bpm = 60 / median;
    }
    return { total: markers.length, perLane, bpm, bpmBasis };
  }

  function toJSON() {
    return {
      version: VERSION,
      fileName: state?.fileName || '',
      duration: state?.duration || 0,
      calibrationMs: state?.calibMs || 0,
      exportedAt: new Date().toISOString(),
      lanes: (state?.lanes || DEFAULT_LANES).map(({ id, key, name, color }) => ({ id, key, name, color })),
      markers: sortedMarkers().map(({ t, lane, label }) => ({ t: Math.round(t * 1000), lane, label: labelText(label) }))
    };
  }

  const csvQuote = value => '"' + value.replace(/"/g, '""') + '"';

  // CSV may be opened as a spreadsheet; keep user-entered formulas inert. JSON remains lossless.
  const csvSafe = value => /^[\s\uFEFF]*[=+\-@]/.test(value) || /^[\t\r\n]/.test(value) ? "'" + value : value;

  function toCSV() {
    const lines = ['time_sec,"mm:ss.mmm",lane,label'];
    for (const marker of sortedMarkers()) {
      const name = csvSafe(laneById(marker.lane)?.name || marker.lane);
      const stamp = display?.formatTime ? display.formatTime(marker.t) : formatTime(marker.t);
      lines.push([
        marker.t.toFixed(3), csvQuote(stamp), /[",\r\n]/.test(name) ? csvQuote(name) : name,
        csvQuote(csvSafe(labelText(marker.label)))
      ].join(','));
    }
    return lines.join('\r\n');
  }

  function importJSON(text) {
    if (!state) return { ok: false, error: '状态未初始化' };
    let data;
    try { data = JSON.parse(text.replace(/^\uFEFF/, '')); }
    catch { return { ok: false, error: 'JSON 解析失败' }; }
    if (!isRecord(data) || data.version !== VERSION) return { ok: false, error: '版本不匹配或文件损坏' };
    if (!Array.isArray(data.markers)) return { ok: false, error: '缺少 markers 数组' };

    const lanes = owns(data, 'lanes') ? validatedLanes(data.lanes) : state.lanes;
    if (!lanes) return { ok: false, error: '轨道格式不正确，或轨道 ID / 按键重复' };
    const laneIds = new Set(lanes.map(lane => lane.id));
    const fallback = lanes[0]?.id;
    const markers = [];
    for (const raw of data.markers) {
      if (!isRecord(raw)) continue;
      const t = raw.t;
      const ms = typeof t === 'number' || (typeof t === 'string' && t.trim()) ? Number(t) : NaN;
      if (!Number.isFinite(ms)) continue;
      const lane = laneIds.has(raw.lane) ? raw.lane : fallback;
      if (lane) markers.push({ id: nextMarkerId(), t: clampTime(ms / 1000), lane, label: labelText(raw.label) });
    }
    if (data.markers.length && !markers.length) return { ok: false, error: '没有可导入的标记' };

    const sameLanes = lanes.length === state.lanes.length && lanes.every((lane, i) => {
      const current = state.lanes[i];
      return lane.id === current.id && lane.key === current.key && lane.name === current.name && lane.color === current.color;
    });
    replaceMarkers(markers, sameLanes ? state.lanes : lanes);
    return { ok: true, count: markers.length };
  }

  // Replace the lane table on edits so the controller can detect settings changes by reference.
  function replaceLanes(lanes) {
    const before = state.lanes;
    remember(() => { state.lanes = before; });
    state.lanes = lanes;
    return changed();
  }

  function addLane() {
    if (!state || state.lanes.length >= LANE_LIMIT) return null;
    const used = new Set(state.lanes.map(lane => laneKey(lane.key)));
    const key = [...KEY_ORDER].find(candidate => !used.has(candidate));
    let n = 1;
    while (laneById('L' + n)) n++;
    const index = state.lanes.length;
    const lane = { id: 'L' + n, key, name: '轨道' + (index + 1), color: DEFAULT_LANES[index % DEFAULT_LANES.length].color };
    replaceLanes([...state.lanes, lane]);
    return lane;
  }

  function updateLane(id, patch) {
    const index = laneIndex(id);
    if (index < 0 || !isRecord(patch)) return false;
    const lane = state.lanes[index];
    const key = owns(patch, 'key') ? laneKey(patch.key) : lane.key;
    const name = owns(patch, 'name') ? laneName(patch.name) : lane.name;
    const color = owns(patch, 'color') ? laneColor(patch.color) : lane.color;
    if (!key || !name || !color || state.lanes.some(other => other.id !== id && laneKey(other.key) === key)) return false;
    if (key === lane.key && name === lane.name && color === lane.color) return false;
    const lanes = state.lanes.slice();
    lanes[index] = { id, key, name, color };
    return replaceLanes(lanes);
  }

  function removeLane(id) {
    const index = laneIndex(id);
    if (index < 0 || state.lanes.length <= 1) return false;
    const lanes = state.lanes;
    const markers = state.markers;
    const kept = markers.filter(marker => marker.lane !== id);
    remember(() => { state.lanes = lanes; state.markers = markers; });
    state.lanes = lanes.filter(lane => lane.id !== id);
    if (kept.length !== markers.length) state.markers = kept;
    if (!selected()) state.selectedId = null;
    return changed();
  }

  function readStored(key) {
    try { return JSON.parse(window.localStorage.getItem(key)); }
    catch { return null; }
  }

  function writeStored(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); }
    catch { /* Storage may be unavailable (including file://) or full. */ }
  }

  function validatedSettings(data) {
    if (!isRecord(data)) return null;
    const settings = {};
    const lanes = validatedLanes(data.lanes);
    if (lanes) settings.lanes = lanes;
    if (Number.isFinite(data.calibMs)) settings.calibMs = clamp(Math.round(data.calibMs), 0, 600);
    if (typeof data.countIn === 'boolean') settings.countIn = data.countIn;
    if (Number.isFinite(data.countInBeats)) settings.countInBeats = clamp(Math.round(data.countInBeats), 1, 8);
    if ([0.5, 0.75, 1, 1.25].includes(data.rate)) settings.rate = data.rate;
    if (typeof data.follow === 'boolean') settings.follow = data.follow;
    if (isRecord(data.grid)) {
      if (typeof data.grid.on === 'boolean') settings.grid = { on: data.grid.on };
      if (Number.isFinite(data.grid.bpm)) {
        settings.grid = settings.grid || {};
        settings.grid.bpm = clamp(Math.round(data.grid.bpm), 30, 240);
      }
    }
    return settings;
  }

  function loadSettings() {
    return validatedSettings(readStored(SETTINGS_KEY));
  }

  function saveSettings() {
    if (state) writeStored(SETTINGS_KEY, validatedSettings(state));
  }

  function autosaveKey() {
    // Legacy UTF-16 DJB2 hash, including the original fileName|size|mtime order.
    const identity = [state.fileName || '', state.fileSize || 0, state.fileMtime || 0].join('|');
    let hash = 5381;
    for (let i = 0; i < identity.length; i++) hash = ((hash << 5) + hash + identity.charCodeAt(i)) >>> 0;
    return 'mw.tmp.' + hash.toString(16);
  }

  function autosaveMarkers() {
    if (state?.fileName) writeStored(autosaveKey(), state.markers);
  }

  function restoreMarkers() {
    if (!state?.fileName) return null;
    const raw = readStored(autosaveKey());
    if (!Array.isArray(raw)) return null;
    const lanes = new Set(state.lanes.map(lane => lane.id));
    const ids = new Set();
    const markers = [];
    for (const row of raw) {
      if (!isRecord(row) || !safeId(row.id) || ids.has(row.id) || !Number.isFinite(row.t) || !lanes.has(row.lane)) continue;
      ids.add(row.id);
      markers.push({ id: row.id, t: clampTime(row.t), lane: row.lane, label: labelText(row.label) });
    }
    return !raw.length || markers.length ? markers : null;
  }

  MW.Data = {
    init, laneById, laneIndex, selected, addMarker, select, deleteSelected, nudge, moveMarker,
    setLabel, clearMarkers, undo, sortedMarkers, stats, toJSON, toCSV, importJSON, addLane,
    removeLane, updateLane, loadSettings, saveSettings, autosaveMarkers, restoreMarkers, resetHistory,
    canUndo: () => history.length > 0
  };
})(window);
