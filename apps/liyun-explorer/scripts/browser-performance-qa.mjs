// Real loopback HTTP and Service Worker. No production accounts or endpoints.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createReadStream, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const dist = resolve(process.argv[2] || fileURLToPath(new URL('../dist', import.meta.url)));
const version = JSON.parse(readFileSync(resolve(dist, 'version.json'), 'utf8')).id;
const mime = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.opus': 'audio/ogg', '.mp3': 'audio/mpeg' };
let httpRequests = 0, httpAssetBytes = 0;
const server = createServer((req, res) => {
  let url;
  try { url = new URL(req.url, 'http://localhost'); } catch { res.writeHead(400).end(); return; }
  if (url.pathname === '/api/content/published') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end('{"published":null}');
    return;
  }
  let file;
  try { file = resolve(dist, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)); }
  catch { res.writeHead(400).end(); return; }
  const stat = file.startsWith(dist + sep) ? statSync(file, { throwIfNoEntry: false }) : null;
  if (!stat?.isFile()) { res.writeHead(404).end(); return; }
  const immutable = url.pathname.startsWith('/assets/releases/');
  if (immutable) { httpRequests++; httpAssetBytes += stat.size; }
  res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Content-Length': stat.size,
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache' });
  createReadStream(file).pipe(res);
});
const cpuRate = Number(process.env.LIYUN_QA_CPU || '4');
const phone = process.env.LIYUN_QA_PHONE !== '0';
const viewport = phone ? { width: 667, height: 375 } : { width: 1440, height: 900 };
const sampleCount = Number(process.env.LIYUN_QA_RUNS || '1');
const round = n => +n.toFixed(2);
const report = { method: 'Chromium/Edge on loopback, software-simulated CPU; compare the same workload and environment', build: basename(dist), version, cpuRate, viewport, runs: [] };

let browser;
try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = 'http://127.0.0.1:' + server.address().port + '/?qa=1';
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  for (let run = 0; run < sampleCount; run++) {
    const context = await browser.newContext({ viewport, hasTouch: phone, isMobile: phone });
    try {
      await context.addInitScript(() => {
        const ids = ['wencui', 'beihu', 'library', 'teaching', 'wenbo', 'sports', 'tower'];
        if (!localStorage.getItem('liyun.exploration.v2')) localStorage.setItem('liyun.exploration.v2', JSON.stringify({
          version: 3, discoveredIds: ids, unlockedRegionIds: ids, settings: { music: false, uiSound: false, autoDegrade: false },
        }));
        HTMLMediaElement.prototype.play = async function () {};
        window.__lightDraws = 0;
        const clear = CanvasRenderingContext2D.prototype.clearRect;
        CanvasRenderingContext2D.prototype.clearRect = function (...args) {
          if (this.canvas.dataset.effectLayer === 'light') window.__lightDraws++;
          return clear.apply(this, args);
        };
        window.__packWrites = { count: 0, bytes: 0 };
        const put = Cache.prototype.put;
        Cache.prototype.put = function (request, response) {
          const url = typeof request === 'string' ? request : request.url;
          if (url.includes('/assets/releases/') && !url.endsWith('/precache.json')) {
            window.__packWrites.count++;
            window.__packWrites.bytes += Number(response.headers.get('Content-Length') || 0);
          }
          return put.call(this, request, response);
        };
      });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
      await cdp.send('Performance.enable');
      const entry = page.locator('.entry-card');
      const readStartup = async navigate => {
        httpRequests = 0; httpAssetBytes = 0;
        await navigate();
        await entry.waitFor({ state: 'visible', timeout: 60000 });
        const value = await page.evaluate(() => ({ entryMs: performance.now(), packWrites: window.__packWrites }));
        return { ...value, entryMs: round(value.entryMs), httpRequests, httpAssetBytes };
      };
      const cold = await readStartup(() => page.goto(url, { waitUntil: 'domcontentloaded' }));
      await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
      const warm = await readStartup(() => page.reload({ waitUntil: 'domcontentloaded' }));
      await page.locator('button.entry-alt').click();
      await page.locator('[data-effect-layer]').waitFor({ state: 'attached' });

      const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
      const sample = async (phase, duration) => {
        const before = await metrics();
        const result = await page.evaluate(({ phase, duration }) => new Promise(resolve => {
          const surface = document.querySelector('[data-testid=map-scene]');
          const start = performance.now(), deltas = [], initialDraws = window.__lightDraws;
          const x = innerWidth * .52, y = innerHeight * .54;
          let last, opened = false, released = false;
          const pointer = (type, cx, cy) => surface.dispatchEvent(new PointerEvent(type, {
            pointerId: 55, isPrimary: true, pointerType: 'mouse', clientX: cx, clientY: cy, button: 0,
            buttons: type === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true,
          }));
          if (phase === 'drag') pointer('pointerdown', x, y);
          function frame(now) {
            if (last !== undefined) deltas.push(now - last);
            last = now;
            const elapsed = now - start;
            if (phase === 'drag' && elapsed < duration) {
              for (let n = 0; n < 8; n++) pointer('pointermove', x + 95 * Math.sin((elapsed + n) / 110), y + 85 * Math.cos((elapsed + n) / 160));
            }
            if (!opened && phase === 'letter' && elapsed > 40) {
              document.querySelector('[data-testid=poi-beihu]').click(); opened = true;
            }
            if (!released && elapsed > 1300 && phase === 'letter') {
              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); released = true;
            }
            if (elapsed < duration) requestAnimationFrame(frame);
            else {
              if (phase === 'drag') pointer('pointerup', x, y);
              deltas.sort((a, b) => a - b);
              const count = deltas.length;
              resolve({ frames: count, p95Ms: deltas[Math.max(0, Math.ceil(count * .95) - 1)], maxMs: deltas[count - 1], over50Ms: deltas.filter(ms => ms > 50).length,
                lightDraws: window.__lightDraws - initialDraws });
            }
          }
          requestAnimationFrame(frame);
        }), { phase, duration });
        const current = await metrics();
        const ms = key => round((current[key] - before[key]) * 1000);
        assert.ok(result.frames > 5, 'Browser must actually deliver frames');
        return { ...result, p95Ms: round(result.p95Ms), maxMs: round(result.maxMs), mainTaskMs: ms('TaskDuration'),
          scriptMs: ms('ScriptDuration'), layoutMs: ms('LayoutDuration'), layouts: current.LayoutCount - before.LayoutCount };
      };
      const idle = await sample('idle', 1400);
      const letter = await sample('letter', 2120);
      await page.locator('.landmark-modal').waitFor({ state: 'detached' });
      const drag = await sample('drag', 1800);

      await context.setOffline(true);
      const offline = await readStartup(() => page.reload({ waitUntil: 'domcontentloaded' }));
      const offlineAudioRange = await page.evaluate(async version => {
        const response = await fetch('/assets/releases/' + version + '/audio/bgm1.opus', { headers: { Range: 'bytes=0-31' } });
        return { status: response.status, bytes: (await response.arrayBuffer()).byteLength };
      }, version);
      assert.deepEqual(offlineAudioRange, { status: 206, bytes: 32 });
      await page.locator('button.entry-alt').click();
      await page.getByRole('button', { name: '打开旅途菜单', exact: true }).first().click();
      await page.getByRole('button', { name: /设置/ }).first().click();
      await page.getByRole('tab', { name: '图像', exact: true }).click();
      assert.equal(await page.locator('.settings-rail-item[aria-selected=true]').getAttribute('id'), 'settings-tab-image');
      assert.deepEqual(errors, []);
      report.runs.push({ cold, warm, offline, idle, drag, letter, offlineSettings: true, offlineAudioRange });
    } finally { await context.close(); }
  }
  const output = JSON.stringify(report, null, 2) + '\n';
  if (process.argv[3]) writeFileSync(resolve(process.argv[3]), output);
  process.stdout.write(output);
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
