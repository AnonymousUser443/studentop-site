'use strict';
// Isolated desktop fixture, owned Edge and CDP touch input. No production secrets.
// Keyboard effects are modeled with real viewport resizes and a separate
// VisualViewport-only fixture; this is not a physical Android/iOS IME test.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { newSession, until, sleep } = require('../lib.js');
const { startFixture, login } = require('../revision-20261028/fixture.cjs');
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--out')) throw new Error('Use --out <new-report.json>.');
const out = path.resolve(args[1] || path.join(__dirname, 'browser-checks.json'));
if (fs.existsSync(out)) throw new Error('Existing evidence cannot be overwritten.');
const report = { ok: false, checkedAt: new Date().toISOString(), scope: 'Start/Search focus, touch, layout/visual viewport keyboard models',
  browser: 'owned isolated headless Edge; OpenCLI native input unavailable on hidden document', checks: [], screenshots: [], sourceHashes: {} };
for (const file of ['site/assets/js/shell.js', 'site/assets/css/shell.css', 'site/assets/css/paper.css']) {
  report.sourceHashes[file] = crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname, '../..', file))).digest('hex');
}
let browser, fixture;
async function check(name, expression) {
  const result = typeof expression === 'string' ? await browser.evaluate(expression) : expression;
  report.checks.push({ name, pass: !!result }); assert(result, name);
}
async function shot(name) {
  const file = path.basename(out, '.json') + '-' + name + '.png';
  const target = path.join(path.dirname(out), file);
  if (fs.existsSync(target)) throw new Error('Existing screenshot cannot be overwritten.');
  await browser.screenshot(target); report.screenshots.push(file);
}
async function metrics(width, height, mobile = true) {
  await browser.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  await browser.call('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: 1 });
  await until(() => browser.evaluate(`innerWidth===${width}&&innerHeight===${height}`), 4000, 'viewport dimensions');
  await sleep(180);
}
async function tap(selector) {
  const point = await browser.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  await browser.call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 1 }] });
  await browser.call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(130);
}
async function escape() {
  await browser.call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await browser.call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await sleep(200);
}
const bounds = selector => `(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1;})()`;

(async () => {
  try {
    fixture = await startFixture(); browser = await newSession({ size: '1440x900' });
    report.browserVersion = (await browser.call('Browser.getVersion')).product;
    await browser.call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await login(browser, fixture);
    for (const [width, height] of [[390, 844], [360, 800], [320, 568], [844, 390]]) {
      await metrics(width, height);
      await browser.evaluate('WM.closeAll();WM.launch("about");true'); await sleep(220);
      const prefix = `${width}x${height}`;
      for (const [kind, button, inputId] of [['start', '#startBtn', 'startSearchInput'], ['search', '#searchBtn', 'globalSearchInput']]) {
        await tap(button);
        const selector = `[data-flyout="${kind}"]`;
        await check(prefix + ':' + kind + ':touch-opens-without-IME-focus', `document.activeElement===document.querySelector(${JSON.stringify(selector)})`);
        await check(prefix + ':' + kind + ':fits-full-viewport', bounds(selector));
        await browser.evaluate(`window.__mobilePanel=document.querySelector(${JSON.stringify(selector)});true`);
        await tap('#' + inputId);
        await browser.call('Input.insertText', { text: '记事本' });
        await check(prefix + ':' + kind + ':explicit-input-and-Chinese-filter', `document.activeElement.id===${JSON.stringify(inputId)}&&document.activeElement.value==="记事本"&&document.querySelector(${JSON.stringify(selector)}).textContent.includes("记事本")`);
        if (kind === 'search') await check(prefix + ':search:web-result-icons-fit', 'Array.from(document.querySelectorAll(".search-web svg")).every(e=>{const r=e.getBoundingClientRect();return r.width===16&&r.height===16;})');
        const keyboardHeight = Math.max(240, Math.floor(height * 0.57));
        await metrics(width, keyboardHeight);
        await check(prefix + ':' + kind + ':keyboard-resize-preserves-panel-and-input', `document.querySelector(${JSON.stringify(selector)})===__mobilePanel&&document.activeElement.id===${JSON.stringify(inputId)}&&document.activeElement.value==="记事本"`);
        await check(prefix + ':' + kind + ':fits-keyboard-viewport', bounds(selector));
        await check(prefix + ':' + kind + ':underlying-app-stays-open', 'WM.isRunning("about")&&WM.byApp("about")[0].state==="max"');
        if (width === 390 && kind === 'search') await shot('layout-keyboard-search');
        await metrics(width, height);
        await check(prefix + ':' + kind + ':keyboard-dismiss-preserves-panel', `document.querySelector(${JSON.stringify(selector)})===__mobilePanel&&document.querySelector(${JSON.stringify('#' + inputId)}).value==="记事本"`);
        if (width === 390 && kind === 'start') {
          await escape(); await tap(button);
          await shot('mobile-start-no-keyboard');
        }
        await escape();
        await check(prefix + ':' + kind + ':Escape-returns-to-trigger', `document.activeElement.id===${JSON.stringify(button.slice(1))}`);
      }
    }

    await metrics(390, 844); await tap('#startBtn');
    await tap('[data-start-all]'); await tap('[data-start-back]');
    await check('mobile:all-apps-back-does-not-focus-input', 'document.activeElement===document.querySelector("[data-flyout=start]")');
    await escape(); await tap('#searchBtn'); await tap('#globalSearchInput');
    await browser.call('Input.insertText', { text: '记事本' });
    await browser.evaluate('window.__mobilePanel=document.querySelector("[data-flyout=search]");Object.defineProperties(visualViewport,{height:{configurable:true,value:480},offsetTop:{configurable:true,value:0}});visualViewport.dispatchEvent(new Event("resize"));true');
    await sleep(180);
    await check('visual-only:panel-and-focus-survive', 'document.querySelector("[data-flyout=search]")===__mobilePanel&&document.activeElement.id==="globalSearchInput"');
    await check('visual-only:search-above-keyboard', '(()=>{const r=__mobilePanel.getBoundingClientRect();return r.top>=-1&&r.bottom<=481;})()');
    await shot('visual-keyboard-search');
    await browser.evaluate('Object.defineProperty(visualViewport,"offsetTop",{configurable:true,value:60});visualViewport.dispatchEvent(new Event("scroll"));true');
    await check('visual-only:pan-keeps-panel-in-visible-area', '(()=>{const r=__mobilePanel.getBoundingClientRect();return r.top>=59&&r.bottom<=541&&globalSearchInput.value==="记事本";})()');
    await browser.evaluate('delete visualViewport.height;delete visualViewport.offsetTop;visualViewport.dispatchEvent(new Event("resize"));true');
    await check('visual-only:dismiss-restores-space', 'getComputedStyle(flyoutHost).getPropertyValue("--flyout-inset-bottom")==="0px"&&document.querySelector("[data-flyout=search]")===__mobilePanel');
    await metrics(844, 390);
    await check('mobile:rotation-closes-panel-and-returns-focus', '!document.querySelector("[data-flyout=search]")&&document.activeElement.id==="searchBtn"');

    for (const [width, height] of [[1440, 900], [1366, 768]]) {
      await metrics(width, height, false);
      for (const [kind, button, inputId] of [['start', '#startBtn', 'startSearchInput'], ['search', '#searchBtn', 'globalSearchInput']]) {
        await browser.click(button); await sleep(150);
        await check(`${width}:${kind}:desktop-autofocus`, `document.activeElement.id===${JSON.stringify(inputId)}`);
        await browser.call('Input.insertText', { text: '记事本' });
        await check(`${width}:${kind}:desktop-filter-still-works`, `document.querySelector(${JSON.stringify('#' + inputId)}).value==="记事本"`);
        await escape();
      }
    }
    await check('no-browser-errors', browser.errors.length === 0); report.errors = [...browser.errors]; report.ok = true;
  } catch (error) {
    report.error = String(error.stack || error); report.errors = browser ? [...browser.errors] : [];
    if (browser) await shot('failure').catch(() => {}); process.exitCode = 1;
  } finally {
    if (browser) await browser.close(); if (fixture) await fixture.close();
    fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ ok: report.ok, checks: report.checks.length, out, error: report.error }));
  }
})();
