import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

const model = readFileSync(new URL('../site/assets/js/music-workstation/model.js', import.meta.url), 'utf8');

function setup() {
  const disk = new Map();
  const window = { localStorage: {
    getItem: key => disk.get(key) ?? null,
    setItem: (key, value) => disk.set(key, value)
  } };
  runInNewContext(model, { window });
  const { Data, util, DEFAULT_LANES } = window.MW;
  const state = { lanes: DEFAULT_LANES.map(lane => ({ ...lane })), markers: [], selectedId: null, duration: 10,
    fileName: 'test.wav', fileSize: 420, fileMtime: 314, calibMs: 42, rate: 1, grid: { bpm: 100, on: false } };
  const callbacks = { changed: 0, selection: 0 };
  Data.init({ state, ui: { changed() { callbacks.changed++; }, selectionChanged() { callbacks.selection++; } }, util });
  return { Data, util, state, callbacks, disk };
}

test('a tap, selection, committed drag and nudge undo independently', () => {
  const { Data, state, callbacks } = setup();
  const mark = Data.addMarker(2.234, 'L1', 'accent');
  assert.equal(Data.canUndo(), true);
  assert.equal(Data.select(mark.id), true);
  assert.equal(Data.moveMarker(mark.id, 12), true);
  assert.equal(mark.t, 10);
  assert.equal(Data.nudge(mark.id, -.001), true);
  assert.equal(mark.t, 9.999);
  assert.equal(Data.undo(), true);
  assert.equal(mark.t, 10);
  assert.equal(Data.undo(), true);
  assert.equal(mark.t, 2.234);
  assert.equal(Data.selected(), mark);
  assert.equal(callbacks.changed, 5);
  assert.equal(callbacks.selection, 1);
  assert.equal(Data.undo(), true);
  assert.equal(state.markers.length, 0);
  assert.equal(Data.canUndo(), false);
});

test('mwtap-1 legacy and revised exports round-trip; labels are safe in CSV', () => {
  const { Data, state } = setup();
  const mark = Data.addMarker(4.123, 'L3', '=1+1');
  assert.equal(Data.toJSON().markers[0].t, 4123);
  assert.equal(Data.toJSON().markers[0].label, '=1+1');
  assert.match(Data.toCSV(), /"'=1\+1"/);
  const legacy = { version: 'mwtap-1', fileName: 'test.wav', markers: [{ t: 5500, lane: 'L4', label: 'a,"b"' }] };
  assert.equal(Data.importJSON('\ufeff' + JSON.stringify(legacy)).ok, true);
  assert.equal(state.markers[0].t, 5.5);
  assert.match(Data.toCSV(), /"a,""b"""/);
  assert.equal(Data.undo(), true);
  assert.equal(state.markers[0], mark);
  const lane = Data.addLane();
  assert.equal(Data.updateLane(lane.id, { name: '鼓', key: 'a' }), true);
  Data.addMarker(5, lane.id, 'tag');
  const newer = JSON.stringify(Data.toJSON());
  const next = setup();
  assert.equal(next.Data.importJSON(newer).count, 2);
  assert.equal(next.Data.laneById(lane.id).name, '鼓');
  const bad = JSON.parse(newer);
  bad.lanes[0].key = 'a';
  assert.equal(next.Data.importJSON(JSON.stringify(bad)).ok, false);
  assert.equal(next.Data.sortedMarkers().length, 2);
});

test('restores local autosave, settings and lane removal without losing existing notes', () => {
  const { Data, state, disk, util } = setup();
  Data.addMarker(1, 'L1', 'one');
  Data.addMarker(1.5, 'L2');
  Data.addMarker(2, 'L1');
  Data.addMarker(2.5, 'L2');
  assert.equal(Data.stats().bpm, 120);
  assert.equal(Data.stats().perLane[0].count, 2);
  Data.autosaveMarkers();
  Data.saveSettings();
  let h = 5381;
  for (const c of 'test.wav|420|314') h = ((h << 5) + h + c.charCodeAt(0)) >>> 0;
  assert.ok(disk.has(`mw.tmp.${h.toString(16)}`));
  assert.equal(Data.loadSettings().calibMs, 42);
  assert.equal(Data.removeLane('L2'), true);
  assert.equal(state.markers.length, 2);
  assert.equal(Data.undo(), true);
  assert.equal(Data.restoreMarkers().length, 4);
  assert.equal(state.markers.length, 4);
  assert.equal(Data.clearMarkers(), true);
  assert.equal(Data.undo(), true);
  assert.equal(state.markers.length, 4);
  Data.resetHistory();
  assert.equal(Data.canUndo(), false);
  assert.equal(util.parseTime('01:02.100'), 62.1);
  assert.equal(util.formatTime(59.9996), '01:00.000');
});
