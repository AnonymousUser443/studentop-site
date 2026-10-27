/* 开场端到端验证：
   node genshin-flow-test.js --mode skip    → ?skip=1 是否直接跳到理韵寻踪
   node genshin-flow-test.js --mode flow    → 点开始 → 等门出现 → 点击开门 → 是否跳到理韵寻踪
   用法：node genshin-flow-test.js [--url URL] [--mode skip|flow] [--outdir DIR] */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const CDP = require('chrome-remote-interface');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
function arg(name, def) { const i = process.argv.indexOf('--' + name); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def; }
const BASE = arg('url', 'http://127.0.0.1:8901/');
const MODE = arg('mode', 'both');
const OUTDIR = arg('outdir', '.');
const PORT = 9419;
const TARGET = 'https://liyun.studentop.cn:14355/';

function getJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } }); }).on('error', reject);
  });
}
async function waitPort(port, timeout) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { const v = await getJSON('http://127.0.0.1:' + port + '/json/version'); if (v.webSocketDebuggerUrl) return v; } catch (e) {}
    await sleep(200);
  }
  throw new Error('devtools port not ready');
}

async function newSession() {
  const profile = path.join(os.tmpdir(), 'edge-genshin-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7));
  const child = spawn(EDGE, [
    '--headless=new', '--hide-scrollbars', '--no-first-run', '--disable-extensions', '--mute-audio',
    '--no-default-browser-check', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile, '--window-size=1440,810', 'about:blank'
  ], { stdio: 'ignore', windowsHide: true });
  await waitPort(PORT, 25000);
  const list = await getJSON('http://127.0.0.1:' + PORT + '/json/list');
  const page = list.find(t => t.type === 'page');
  const client = await CDP({ target: page.webSocketDebuggerUrl, local: true });
  const { Page, Runtime, Input, Emulation } = client;
  await Page.enable(); await Runtime.enable();
  await Emulation.setDeviceMetricsOverride({ width: 1440, height: 810, deviceScaleFactor: 1, mobile: false });
  const errors = [];
  Runtime.exceptionThrown(p => errors.push('EXCEPTION: ' + (p.exceptionDetails && p.exceptionDetails.text) + ' ' + ((p.exceptionDetails && p.exceptionDetails.exception) || {}).description));
  Runtime.consoleAPICalled(p => { if (p.type === 'error') errors.push('CONSOLE: ' + p.args.map(a => a.value || a.description || a.type).join(' ')); });
  const nav = [];
  Page.frameNavigated(p => { if (p.frame && !p.frame.parentId) nav.push(p.frame.url); });
  return { client, child, profile, Page, Runtime, Input, errors, nav };
}
async function closeSession(s) {
  try { await s.client.close(); } catch (e) {}
  try { s.child.kill(); } catch (e) {}
  await sleep(300);
  try { fs.rmSync(s.profile, { recursive: true, force: true }); } catch (e) {}
}
async function evalJSON(Runtime, expr) {
  const r = await Runtime.evaluate({ expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) return { __error: r.exceptionDetails.text };
  return r.result && r.result.value;
}
async function screenshot(Page, out) {
  const shot = await Page.captureScreenshot({ format: 'png' });
  fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
}

(async () => {
  const results = {};
  if (MODE === 'skip' || MODE === 'both') {
    const s = await newSession();
    try {
      await s.Page.navigate({ url: BASE + (BASE.includes('?') ? '&' : '?') + 'skip=1' });
      await sleep(2500);
      const here = await evalJSON(s.Runtime, 'location.href');
      results.skip = { landed: here, redirected: String(here).startsWith(TARGET), errors: s.errors.slice(0, 3) };
    } finally { await closeSession(s); }
  }
  if (MODE === 'flow' || MODE === 'both') {
    const s = await newSession();
    const started = Date.now();
    const flow = { steps: {} };
    try {
      await s.Page.navigate({ url: BASE });
      // 1) 等开始按钮出现（说明预加载完成、登录界面就绪）
      let btn = null;
      for (let i = 0; i < 120; i++) {
        const box = await evalJSON(s.Runtime, '(function(){var b=document.querySelector(".ClickMe");if(!b)return null;var r=b.getBoundingClientRect();return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2,op:getComputedStyle(b.parentElement).opacity});})()');
        if (box && typeof box === 'string') { btn = JSON.parse(box); break; }
        await sleep(500);
      }
      flow.steps.webgl = await evalJSON(s.Runtime, '!!(window.WebGLRenderingContext && document.createElement("canvas").getContext("webgl"))');
      flow.steps.start_button = !!btn;
      flow.steps.start_after_ms = Date.now() - started;
      if (!btn) throw new Error('开始按钮未出现（预加载未完成？）');
      await screenshot(s.Page, path.join(OUTDIR, 'genshin-1-login.png'));
      // 2) 点开始
      for (const clickCount of [1]) {
        await s.Input.dispatchMouseEvent({ type: 'mousePressed', x: btn.x, y: btn.y, button: 'left', clickCount });
        await s.Input.dispatchMouseEvent({ type: 'mouseReleased', x: btn.x, y: btn.y, button: 'left', clickCount });
      }
      // 3) 等门出现（.menu-doorCreate-content）
      let door = false;
      for (let i = 0; i < 100; i++) {
        door = await evalJSON(s.Runtime, '!!document.querySelector(".menu-doorCreate-content")');
        if (door) break;
        await sleep(500);
      }
      flow.steps.door_appears = door;
      flow.steps.door_after_ms = Date.now() - started;
      await screenshot(s.Page, path.join(OUTDIR, 'genshin-2-door.png'));
      if (!door) throw new Error('门没有出现');
      await sleep(1200);
      // 4) 点屏幕中央「开门」
      await s.Input.dispatchMouseEvent({ type: 'mousePressed', x: 720, y: 405, button: 'left', clickCount: 1 });
      await s.Input.dispatchMouseEvent({ type: 'mouseReleased', x: 720, y: 405, button: 'left', clickCount: 1 });
      // 5) 等跳转
      let landed = '';
      for (let i = 0; i < 30; i++) {
        await sleep(400);
        landed = String(await evalJSON(s.Runtime, 'location.href'));
        if (landed.startsWith('https://liyun')) break;
      }
      await screenshot(s.Page, path.join(OUTDIR, 'genshin-3-after.png'));
      flow.steps.landed = landed;
      flow.steps.redirect_after_ms = Date.now() - started;
      flow.redirected = landed.startsWith(TARGET);
      flow.events = s.nav.slice(-4);
      flow.errors = s.errors.slice(0, 5);
      results.flow = flow;
    } catch (e) {
      results.flow = { ...flow, fatal: String(e && e.message || e), errors: s.errors.slice(0, 5) };
    } finally { await closeSession(s); }
  }
  console.log(JSON.stringify(results));
  if (results.skip && !results.skip.redirected) process.exitCode = 1;
  if (results.flow && !results.flow.redirected) process.exitCode = 1;
})();
