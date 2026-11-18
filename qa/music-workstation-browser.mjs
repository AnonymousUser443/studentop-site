/** Real isolated Chromium browser QA against the exact versioned release artifact. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { once } from 'node:events';
import { parseArgs } from 'node:util';
import { newSession, sleep, until } from './lib.js';
import { verifySiteBuild } from '../tools/site-release.mjs';

const { values: opt } = parseArgs({ options: {
  build: { type: 'string' }, screens: { type: 'string' }, port: { type: 'string' },
  serve: { type: 'boolean' }, public: { type: 'boolean' }
} });
const route = '/projects/music-workstation/';
const root = path.resolve(opt.build || 'dist-site');
const expected = verifySiteBuild(root).id;
const types = { '.html': 'text/html; charset=UTF-8', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
let server;

async function fixtureServer() {
  server = createServer(async (req, res) => {
    if (req.url === '/favicon.ico') return res.writeHead(204).end();
    const name = new URL(req.url, 'http://127.0.0.1').pathname.slice(1);
    const file = name.endsWith('/') ? name + 'index.html' : name;
    if (!file || !file.split('/').every(x => /^[a-z0-9_.-]+$/i.test(x) && x !== '.' && x !== '..')) return res.writeHead(404).end();
    try {
      const data = await readFile(path.join(root, file));
      res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' }).end(data);
    } catch { res.writeHead(404).end(); }
  });
  server.listen(Number(opt.port || 0), '127.0.0.1');
  await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}${route}`;
}

const install = `(() => {
  globalThis.qa = {
    paints: 0,
    get time() { return MW.util.parseTime(document.querySelector('#timeCur').textContent); },
    get marks() { return MW.Data.toJSON().markers; },
    get view() { return document.querySelector('#viewInfo').textContent.split(' – ').map(MW.util.parseTime); },
    get inView() { return !document.querySelector('.wave-head').hidden; },
    wav(name = 'workstation-qa.wav', seconds = 8) {
      const rate = 8000, n = rate * seconds, data = new Uint8Array(44 + n * 2), d = new DataView(data.buffer);
      const tag = (at, value) => data.set(new TextEncoder().encode(value), at);
      tag(0, 'RIFF'); d.setUint32(4, data.length - 8, true); tag(8, 'WAVE'); tag(12, 'fmt ');
      d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, 1, true); d.setUint32(24, rate, true);
      d.setUint32(28, rate * 2, true); d.setUint16(32, 2, true); d.setUint16(34, 16, true);
      tag(36, 'data'); d.setUint32(40, n * 2, true);
      for (let i = 0; i < n; i++) {
        const t = i / rate, phase = (t * 4) % 1;
        const envelope = (0.24 + 0.55 * Math.abs(Math.sin(t * 1.7))) * (0.34 + 0.66 * (1 - phase) ** 5);
        d.setInt16(44 + i * 2, 28000 * Math.sin(2 * Math.PI * (t * 251 + Math.sin(t * 3))) * envelope, true);
      }
      return new File([data], name, { type: 'audio/wav', lastModified: 1550 });
    },
    file(file, selector = '#fileInput') {
      const t = new DataTransfer(); t.items.add(file);
      const input = document.querySelector(selector); input.files = t.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    },
    jump(t) {
      const field = document.querySelector('#jumpInput'); field.value = String(t);
      document.querySelector('#jumpForm').requestSubmit();
    },
    coords(selector, time, lane = 0, extra = 0) {
      const el = document.querySelector(selector), r = el.getBoundingClientRect();
      const gutter = el.clientWidth < 560 ? 66 : 92;
      const [left, right] = qa.view;
      const row = document.querySelector('#lanesCanvas').clientHeight / MW.DEFAULT_LANES.length;
      return { x: Math.round(r.x + gutter + (el.clientWidth - gutter) * (time - left) / (right - left) + extra),
        y: Math.round(r.y + (selector === '#waveCanvas' ? 72 : row * (lane + .5))) };
    }
  };
  const original = CanvasRenderingContext2D.prototype.fillRect;
  CanvasRenderingContext2D.prototype.fillRect = function (...args) {
    if (this.canvas.id === 'waveCanvas' || this.canvas.id === 'lanesCanvas') qa.paints++;
    return original.apply(this, args);
  };
})()`;

async function check(name, fn, records) {
  await fn();
  records.push(name);
}

async function run(url, touch, records) {
  const publicUrl = /^https:/.test(url);
  const s = await newSession({ size: touch ? '390x844' : '1440x900', allowPublic: publicUrl });
  const read = s.evaluate;
  const assertPage = (expression, note) => until(() => read(expression), 4500, note);
  const openWav = async () => {
    await read('qa.file(qa.wav())');
    await assertPage('!document.querySelector("#btnPlay").disabled && document.querySelector("#waveProgress").hidden && qa.view[1] > qa.view[0]', 'Audio and peaks');
  };
  const click = async selector => { await read(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'nearest'})`); await s.click(selector); };
  const key = async (value, modifiers = 0) => {
    await s.call('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: value, modifiers });
    await s.call('Input.dispatchKeyEvent', { type: 'keyUp', key: value, modifiers });
  };
  const mouse = (type, point, buttons = 0, modifiers = 0) => s.call('Input.dispatchMouseEvent', {
    type, ...point, button: type === 'mouseMoved' ? 'none' : 'left', buttons, clickCount: 1, modifiers
  });
  const drag = async (p, end) => {
    await mouse('mousePressed', p, 1);
    for (let i = 1; i <= 5; i++) await mouse('mouseMoved', { x: p.x + (end.x - p.x) * i / 5, y: p.y + (end.y - p.y) * i / 5 }, 1);
    await mouse('mouseReleased', end);
  };
  const touches = (type, items = []) => s.call('Input.dispatchTouchEvent', {
    type, touchPoints: items.map(({ x, y, id = 0 }) => ({ x, y, id, radiusX: 7, radiusY: 7 }))
  });
  const snap = async name => { if (typeof opt.screens === 'string') await s.screenshot(path.join(opt.screens, `${name}.png`)); };

  try {
    if (touch) {
      await s.call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
      await s.call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
    }
    await s.call('Page.addScriptToEvaluateOnNewDocument', { source: install });
    await s.navigate(url);
    assert.equal(await read('document.querySelector("meta[name=site-version]")?.content'), expected);
    assert.equal(await read('[...document.scripts].filter(s => s.src.includes("/js/music-workstation/")).length'), 4);
    assert.equal(await read('document.querySelector("h1").textContent'), '音乐踩点工作站');
    assert.equal(await read('document.documentElement.scrollWidth === document.documentElement.clientWidth'), true);
    assert.equal(await read('document.querySelector("#btnPlay").disabled && !document.querySelector("#emptyState").hidden'), true);
    records.push(`${touch ? 'mobile' : 'desktop'}: correct versioned route, no overflow, usable empty state`);
    if (!touch) await snap('desktop-empty');
    await openWav();

    if (!touch) {
      await check('desktop: actual drag-to-scrub commits at release', async () => {
        const p = await read('qa.coords("#waveCanvas", 2)'), end = await read('qa.coords("#waveCanvas", 3.5)');
        await drag(p, end);
        assert.ok(Math.abs(await read('qa.time') - 3.5) < .025);
      }, records);
      await check('desktop: key and pad create separate marks and remain editable', async () => {
        await key('1');
        await read('qa.jump(4.25)');
        await click('.pad[data-lane=L2]');
        assert.deepEqual(await read('qa.marks.map(m => m.lane)'), ['L1', 'L2']);
        await assertPage('document.querySelector("#markerCount").textContent === "2 个"', 'Two marks');
      }, records);
      await check('desktop: offset drag out of canvas commits once, then one undo restores it', async () => {
        const p = await read('qa.coords("#lanesCanvas", qa.marks[0].t / 1000, 0, 5)');
        await drag(p, { x: p.x + 98, y: p.y - 100 });
        assert.ok(await read('qa.marks.find(m => m.lane === "L1").t') > 4200);
        await key('z', 2);
        assert.ok(Math.abs(await read('qa.marks[0].t') - 3500) < 25);
      }, records);
      await check('desktop: nudge controls update the selected time at millisecond precision', async () => {
        const before = await read('qa.marks[0].t');
        await click('#btnLater');
        assert.equal(await read('qa.marks[0].t'), before + 10);
        await key('ArrowLeft', 1 | 8);
        assert.equal(await read('qa.marks[0].t'), before + 9);
      }, records);
      await check('desktop: zoom/pan clamps and range keyboard navigation works', async () => {
        await click('#btnZoomIn');
        await assertPage('qa.view[1] - qa.view[0] < 7', 'Zoomed');
        const start = await read('qa.view[0]');
        await click('#btnPanRight');
        await assertPage(`qa.view[0] > ${start}`, 'Panned');
        await read('document.querySelector("#seekRange").focus()');
        await key('Home');
        await assertPage('qa.time === 0 && qa.inView', 'Range reaches start');
        await click('#btnFit');
        await assertPage('qa.view[0] === 0 && qa.view[1] === 8', 'Fit full audio');
      }, records);
      await check('desktop: playback advances with zero static canvas redraws in a stable view', async () => {
        await click('#btnPlay');
        await assertPage('MW.Audio.isPlaying() && qa.time > .15', 'Playing');
        const mark = await read('({ t: qa.time, paints: qa.paints })');
        await sleep(330);
        const next = await read('({ t: qa.time, paints: qa.paints })');
        assert.ok(next.t > mark.t + .16);
        assert.equal(next.paints, mark.paints);
        await click('#btnStop');
        assert.equal(await read('qa.time'), 0);
      }, records);
      await check('desktop: canceling the count-in cancels the scheduled audio start', async () => {
        await read('document.querySelector("#countInChk").click()');
        await click('#btnPlay');
        await assertPage('document.querySelector("#playLabel").textContent === "取消倒数"', 'Count-in active');
        await click('#btnPlay');
        await sleep(2250);
        assert.equal(await read('MW.Audio.isPlaying()'), false);
        assert.equal(await read('qa.time'), 0);
        await read('document.querySelector("#countInChk").click()');
      }, records);
      await check('desktop: label changes survive list refresh and legacy import can be undone', async () => {
        await read(`(() => {
          const input = document.querySelector('.marker-row input'); input.focus(); input.value = 'accent';
          input.dispatchEvent(new Event('change', { bubbles: true }));
          qa.file(new File([JSON.stringify({version:'mwtap-1', markers:[{t:1550,lane:'L3',label:'legacy'}]})], 'marks.json'), '#importInput');
        })()`);
        await assertPage('document.querySelector("#modal").open', 'Confirm replacing markers');
        await click('#modalOk');
        await assertPage('qa.marks.length === 1 && qa.marks[0].t === 1550', 'Imported legacy marks');
        await click('#btnUndo');
        assert.equal(await read('qa.marks[0].label'), 'accent');
      }, records);
      await check('desktop: JSON/CSV downloads contain the current project and load restoration works', async () => {
        await read(`(() => {
          qa.downloads = [];
          const click = HTMLAnchorElement.prototype.click;
          HTMLAnchorElement.prototype.click = function() {
            if (!this.download) return click.call(this);
            const name = this.download;
            return fetch(this.href).then(r => r.text()).then(text => qa.downloads.push({name, text}));
          };
        })()`);
        await click('#btnJson'); await click('#btnCsv');
        await assertPage('qa.downloads.length === 2', 'Export bytes');
        assert.equal(await read('JSON.parse(qa.downloads.find(d => d.name.endsWith(".json")).text).markers.length'), 2);
        assert.match(await read('qa.downloads.find(d => d.name.endsWith(".csv")).text'), /time_sec,.*accent/s);
        await read('window.dispatchEvent(new Event("pagehide"))');
        await s.navigate(url);
        await openWav();
        assert.equal(await read('qa.marks[0].label'), 'accent');
      }, records);
      await check('desktop: failed decode leaves the current working audio and markers intact', async () => {
        await read('qa.file(new File(["not PCM"], "bad.wav", {type:"audio/wav"}))');
        await assertPage('document.querySelector("#statusMsg").dataset.kind === "error"', 'Invalid audio');
        assert.equal(await read('qa.marks.length'), 2);
        assert.equal(await read('document.querySelector("#fileMeta").textContent'), 'workstation-qa.wav');
      }, records);
      await check('desktop: newer file wins a decode race and file-only drop still works', async () => {
        await read(`(() => {
          const decode = MW.Audio.decode;
          MW.Audio.decode = async file => { if (file.name === 'slow.wav') await new Promise(r => setTimeout(r, 420)); return decode(file); };
          qa.file(qa.wav('slow.wav', 3));
          const t = new DataTransfer(); t.items.add(qa.wav('winner.wav', 8));
          window.dispatchEvent(new DragEvent('dragenter', { dataTransfer: t, cancelable: true }));
          window.dispatchEvent(new DragEvent('drop', { dataTransfer: t, cancelable: true }));
        })()`);
        await assertPage('document.querySelector("#fileMeta").textContent === "winner.wav"', 'Newest decoded source');
        await sleep(600);
        assert.equal(await read('document.querySelector("#fileMeta").textContent'), 'winner.wav');
        assert.equal(await read('document.querySelector("#dropHint").hidden'), true);
      }, records);
      await read(`qa.file(qa.wav()); window.scrollTo(0,0)`);
      await assertPage('qa.marks.length === 2 && document.querySelector("#waveProgress").hidden', 'Screenshot restored state');
      await read('qa.jump(4.25); window.scrollTo(0, 0)');
      await snap('desktop-loaded');
    } else {
      await check('mobile: tap pad records and the target is at least 44 CSS pixels tall', async () => {
        await read('qa.jump(3)');
        const selector = '.pad[data-lane=L1]';
        const p = await read(`(() => { const r = document.querySelector('${selector}').getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2,h:r.height}; })()`);
        assert.ok(p.h >= 44);
        await touches('touchStart', [p]); await touches('touchEnd');
        await assertPage('qa.marks[0]?.t === 3000', 'Touch mark');
      }, records);
      await check('mobile: tap waveform seeks, one-finger horizontal movement pans without seeking', async () => {
        let p = await read('qa.coords("#waveCanvas", 4)');
        await touches('touchStart', [p]); await touches('touchEnd');
        await assertPage('Math.abs(qa.time - 4) < .04', 'Touch seek');
        await click('#btnZoomIn');
        await assertPage('qa.view[1] - qa.view[0] < 7', 'Zoom for pan');
        const before = await read('({ start: qa.view[0], time: qa.time })');
        p = await read('qa.coords("#waveCanvas", 4)');
        await touches('touchStart', [p]);
        await touches('touchMove', [{ ...p, x: p.x - 35 }]);
        await touches('touchMove', [{ ...p, x: p.x - 60 }]);
        await touches('touchEnd');
        await assertPage(`qa.view[0] > ${before.start} + .2`, 'Swipe pan');
        assert.equal(await read('qa.time'), before.time);
      }, records);
      await check('mobile: two-finger pinch zooms, does not create or move a mark', async () => {
        await click('#btnFit');
        await assertPage('qa.view[1] === 8', 'Fit before pinch');
        const p = await read('qa.coords("#waveCanvas", 4)');
        await touches('touchStart', [{ x: p.x - 29, y: p.y, id: 1 }, { x: p.x + 29, y: p.y, id: 2 }]);
        await touches('touchMove', [{ x: p.x - 58, y: p.y, id: 1 }, { x: p.x + 58, y: p.y, id: 2 }]);
        await touches('touchMove', [{ x: p.x - 83, y: p.y, id: 1 }, { x: p.x + 83, y: p.y, id: 2 }]);
        await touches('touchEnd');
        await assertPage('qa.view[1] - qa.view[0] < 6', 'Pinch changed span');
        assert.equal(await read('qa.marks[0].t'), 3000);
      }, records);
      await check('mobile: wider marker hit area works and touchcancel discards the preview', async () => {
        await click('#btnFit');
        await assertPage('qa.view[0] === 0 && qa.view[1] === 8', 'Fit before drag');
        await read('document.querySelector("#lanesCanvas").scrollIntoView({block:"center"})');
        const p = await read('qa.coords("#lanesCanvas", 3, 0, 13)');
        await touches('touchStart', [p]);
        await touches('touchMove', [{ ...p, x: p.x + 46 }]);
        await assertPage('document.querySelector("#timelineWrap").dataset.gesture === "marker"', 'Wide touch hit');
        await touches('touchCancel');
        assert.equal(await read('qa.marks[0].t'), 3000);
        assert.equal(await read('document.querySelector("#gestureHint").hidden'), true);
        await touches('touchStart', [p]);
        await touches('touchMove', [{ ...p, x: p.x + 49 }]);
        await touches('touchEnd');
        assert.ok(await read('qa.marks[0].t') > 3800);
      }, records);
      await check('mobile: vertical swipe scrolls the page without seeking', async () => {
        await read('window.scrollTo(0, 100)');
        const p = await read('qa.coords("#waveCanvas", 4)');
        const before = await read('({ y: scrollY, time: qa.time })');
        await touches('touchStart', [p]);
        for (let i = 1; i <= 5; i++) await touches('touchMove', [{ ...p, y: p.y - i * 17 }]);
        await touches('touchEnd');
        await assertPage(`scrollY > ${before.y} + 20`, 'Native vertical scrolling');
        assert.equal(await read('qa.time'), before.time);
      }, records);
      await read('window.scrollTo(0,0)');
      await sleep(420);
      await read('window.scrollTo(0,0)');
      await sleep(80);
      await snap('mobile-loaded');
    }
    assert.deepEqual(s.errors, [], 'No browser errors, failed requests or unexpected outbound network');
  } finally { await s.close(); }
}

if (opt.serve) {
  console.log(await fixtureServer());
} else {
  const url = opt.public ? 'https://studentop.cn:14355' + route : await fixtureServer();
  const records = [];
  try {
    await run(url, false, records);
    await run(url, true, records);
    console.log(JSON.stringify({ ok: true, version: expected, url, passed: records.length, checks: records }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, version: expected, url, completed: records, error: error.stack }, null, 2));
    process.exitCode = 1;
  } finally { server?.close(); }
}
