// Local production regression; traffic is fulfilled from the compiled directory.
import assert from 'node:assert/strict';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const app = fileURLToPath(new URL('../', import.meta.url));
const dist = resolve(process.env.LIYUN_QA_DIST || resolve(app, 'dist'));
const out = resolve(process.env.LIYUN_QA_OUT || resolve(app, 'qa/arrival-motion'));
mkdirSync(out, { recursive: true });
const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' };
const origin = 'https://liyun-motion.test';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const failures = [];
const report = {};
const cpuRate = Number(process.env.LIYUN_QA_CPU || '1');
const reduced = process.env.LIYUN_QA_REDUCED === '1';
const phone = process.env.LIYUN_QA_PHONE === '1';
const suffix = phone ? '-phone' : reduced ? '-reduced' : '';
try {
  const context = await browser.newContext({ viewport: phone ? { width: 667, height: 375 } : { width: 1440, height: 900 },
    hasTouch: phone, isMobile: phone, reducedMotion: reduced ? 'reduce' : 'no-preference', serviceWorkers: 'block' });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname === '/api/content/published') return route.fulfill({ json: { published: null } });
    const path = resolve(dist, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!path.startsWith(dist + sep) || !existsSync(path)) return route.fulfill({ status: 404, body: 'Not found' });
    return route.fulfill({ path, contentType: mime[extname(path)] || 'application/octet-stream' });
  });
  const page = await context.newPage();
  page.on('pageerror', e => failures.push(e.message));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
  await page.addInitScript(() => {
    const ids = ['wencui', 'beihu', 'library', 'teaching', 'wenbo', 'sports', 'tower'];
    localStorage.setItem('liyun.exploration.v2', JSON.stringify({ version: 3, discoveredIds: ids, unlockedRegionIds: ids, settings: { music: false, uiSound: false } }));
    HTMLMediaElement.prototype.play = async function () {};
  });
  await page.goto(origin);
  await page.locator('.entry-card').waitFor({ state: 'visible' });
  if (process.env.LIYUN_QA_EXPECT_OLD !== '1') assert.equal(await page.locator('#arrival').count(), 0, 'Entry starts after the loader has left');
  else await page.locator('#arrival').waitFor({ state: 'detached' });
  // Observe actual rendered frames starting immediately before a normal guest click.
  await page.getByRole('button', { name: '游客模式 · 进度仅保存在本机', exact: true }).waitFor({ state: 'visible' });
  const frames = await page.evaluate(() => new Promise(resolve => {
    const series = [];
    let started = performance.now(), prev = started;
    const sample = now => {
      const canvases = [...document.querySelectorAll('[data-paper-reason=arrival]')];
      series.push({ t: now - started, dt: now - prev, jobs: canvases.length,
        mode: canvases.map(c => c.dataset.paperSource), hasAmbient: !!document.querySelector('[data-effect-layer]') });
      prev = now;
      if (now - started < 2900) requestAnimationFrame(sample);
      else resolve(series);
    };
    document.querySelector('button.entry-alt').click();
    requestAnimationFrame(sample);
  }));
  const active = frames.filter(row => row.jobs > 0);
  if (!reduced) {
    assert.ok(active.length > 8, 'Saved areas perform a visible reveal');
    if (process.env.LIYUN_QA_EXPECT_OLD !== '1') {
      assert.ok(active.every(row => row.mode.every(mode => mode === 'baked')), 'Returning regions use prepared frames');
      assert.ok(active.every(row => !row.hasAmbient), 'Atmosphere initializes only after the introductory reveal');
    }
  } else assert.equal(active.length, 0, 'Reduced motion bypasses the reveal');
  const times = active.map(row => row.dt).sort((a, b) => a - b);
  const pick = p => Number(times[Math.min(times.length - 1, Math.floor(times.length * p))]?.toFixed(1));
  report.map = { observedFrames: active.length, p50Ms: pick(.5), p95Ms: pick(.95), maxMs: pick(1), peakRegions: Math.max(...active.map(row => row.jobs), 0), cpuRate };
  console.log(JSON.stringify(report.map));
  if (process.env.LIYUN_QA_EXPECT_OLD === '1') { console.log(JSON.stringify(report)); process.exitCode = 0; }
  else {
    await page.screenshot({ path: resolve(out, 'map' + suffix + '.png') });
    const modal = page.locator('.landmark-modal');
    const dialogFrames = await page.evaluate(() => new Promise(resolve => {
      const opener = document.querySelector('[data-testid=poi-beihu]');
      opener.focus();
      const frames = [], start = performance.now();
      let exitAt = 0;
      const frame = now => {
        const modal = document.querySelector('.landmark-modal');
        if (modal) {
          const shell = getComputedStyle(modal);
          const opacity = el => el ? +getComputedStyle(el).opacity : 0;
          const glyphs = [...modal.querySelectorAll('h2 .scroll-glyph')];
          frames.push({ t: now - start, exit: !!exitAt, shell: shell.clipPath, heading: glyphs.map(opacity),
            icon: opacity(modal.querySelector('.modal-emblem-flight')), action: opacity(modal.querySelector('.parchment-button').parentElement) });
        }
        if (!exitAt && now - start > 1510) {
          exitAt = now;
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        }
        if (now - start < 2340) requestAnimationFrame(frame);
        else resolve(frames);
      };
      opener.click();
      requestAnimationFrame(frame);
    }));
    if (!reduced) {
      const flat = value => /^inset\(-12% -8% -10%\)$/.test(value);
      const first = dialogFrames.find(row => row.heading[0] > .08);
      const second = dialogFrames.find(row => row.heading[1] > .08);
      const icon = dialogFrames.find(row => row.icon > .08);
      assert.ok(first && second && icon && flat(icon.shell) && flat(first.shell), 'Paper is flat before icons and words start');
      assert.ok(second.t > first.t && first.t > icon.t, 'Title characters and icon enter at separate times');
      const settled = dialogFrames.filter(row => !row.exit && row.t > 1190);
      assert.ok(settled.length > 1 && settled.every(row => row.heading.every(alpha => alpha > .995) && row.action > .995 && flat(row.shell)), 'Settled text and window stay visible');
      const fold = dialogFrames.find(row => row.exit && !flat(row.shell));
      assert.ok(fold && fold.heading.every(alpha => alpha < .03) && fold.action < .03, 'Content leaves before paper folds');
      report.dialog = { iconMs: Math.round(icon.t), glyphsMs: [Math.round(first.t), Math.round(second.t)], phaseOrderPassed: true };
    }
    await modal.waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-testid')), 'poi-beihu');
    await page.getByTestId('poi-beihu').click({ force: true });
    await modal.waitFor({ state: 'visible' });
    await modal.locator('h2').waitFor({ state: 'visible' });
    await page.waitForFunction(() => {
      const modal = document.querySelector('.landmark-modal');
      return modal && +getComputedStyle(modal.querySelector('.parchment-button').parentElement).opacity > .998
        && [...modal.querySelectorAll('.landmark-verse .scroll-glyph')].every(el => +getComputedStyle(el).opacity > .998);
    });
    await page.screenshot({ path: resolve(out, 'letter' + suffix + '.png') });
    await page.keyboard.press('Escape');
    await modal.waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-testid')), 'poi-beihu');
    await page.getByRole('button', { name: '打开旅途菜单', exact: true }).first().click();
    await page.getByRole('button', { name: /设置/ }).first().click();
    await page.getByRole('tab', { name: '图像', exact: true }).click();
    const selected = page.locator('.settings-rail-item[aria-selected=true]');
    assert.equal(await selected.getAttribute('id'), 'settings-tab-image');
    if (!reduced) {
      const loop = await selected.evaluate(el => ({
        smoke: getComputedStyle(el.querySelector('.settings-rail-sweep'), '::before').animationIterationCount,
        emblem: getComputedStyle(el.querySelector('.settings-rail-emblem > span')).animationIterationCount,
      }));
      assert.deepEqual(loop, { smoke: 'infinite', emblem: 'infinite' });
      assert.equal(await page.locator('.settings-rail-sweep').count(), 1);
      await page.waitForTimeout(1050);
      await page.screenshot({ path: resolve(out, 'settings' + suffix + '.png') });
    }
    assert.deepEqual(failures, []);
    writeFileSync(resolve(out, 'report' + suffix + '.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
  }
} finally { await browser.close(); }
