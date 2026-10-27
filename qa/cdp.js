/* CDP 截图 / 交互验收工具：node cdp.js --url <url> --out <png> [--wait ms] [--eval "js"] [--size 1680x959] */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const CDP = require('chrome-remote-interface');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function getJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
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

(async () => {
  const url = arg('url');
  const out = arg('out');
  const wait = parseInt(arg('wait', '1200'), 10);
  const expr = arg('eval', '') || (arg('eval-file', '') ? require('fs').readFileSync(arg('eval-file', ''), 'utf8') : '');
  const size = arg('size', '1680x959');
  const port = parseInt(arg('port', '9411'), 10);
  const [w, h] = size.split('x').map(Number);
  const profile = path.join(require('os').tmpdir(), 'edge-cdp-' + Date.now());
  const child = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--disable-extensions', '--mute-audio', '--no-default-browser-check',
    '--remote-debugging-port=' + port, '--user-data-dir=' + profile,
    '--window-size=' + w + ',' + h, 'about:blank'
  ], { stdio: 'ignore', windowsHide: true });

  const errors = [];
  let client;
  try {
    await waitPort(port, 20000);
    const list = await getJSON('http://127.0.0.1:' + port + '/json/list');
    const page = list.find(t => t.type === 'page');
    client = await CDP({ target: page.webSocketDebuggerUrl, local: true });
    const { Page, Runtime, Emulation } = client;
    await Page.enable(); await Runtime.enable();
    await Emulation.setDeviceMetricsOverride({ width: w, height: h, deviceScaleFactor: 1, mobile: false });
    Runtime.exceptionThrown(p => errors.push('EXCEPTION: ' + (p.exceptionDetails && p.exceptionDetails.text) + ' ' + ((p.exceptionDetails && p.exceptionDetails.exception) || {}).description));
    Runtime.consoleAPICalled(p => {
      if (p.type === 'error' || p.type === 'assert') errors.push('CONSOLE: ' + p.args.map(a => a.value || a.description || a.type).join(' '));
    });
    const loaded = new Promise(resolve => { Page.loadEventFired(() => resolve()); setTimeout(resolve, 15000); });
    await Page.navigate({ url });
    await loaded;
    await sleep(wait);
    let evalResult = null;
    if (expr) {
      const r = await Runtime.evaluate({ expression: expr, returnByValue: true, awaitPromise: true });
      evalResult = r.result && r.result.value !== undefined ? r.result.value : (r.exceptionDetails ? ('EVAL_ERROR: ' + r.exceptionDetails.text) : null);
    }
    if (out) {
      const shot = await Page.captureScreenshot({ format: 'png' });
      fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
    }
    console.log(JSON.stringify({ ok: true, errors, evalResult, out: out || null }));
  } catch (e) {
    console.log(JSON.stringify({ ok: false, error: String(e && e.stack || e), errors }));
    process.exitCode = 1;
  } finally {
    try { if (client) await client.close(); } catch (e) {}
    try { child.kill(); } catch (e) {}
    await sleep(300);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
  }
})();