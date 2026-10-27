/* 快捷方式端到端验证：真实（可信）双击桌面图标，确认新标签页打开了对应项目站点。
   用法：node shortcut-test.js [url]   （默认线上主页，可传 http://127.0.0.1:8899/ 做本地验证） */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
/* chrome-remote-interface：优先本地依赖，其次全局安装（npm i -g chrome-remote-interface） */
const CDP = loadCDP();
function loadCDP() {
  try { return require('chrome-remote-interface'); } catch (e) { /* 继续找全局 */ }
  try {
    const { execSync } = require('child_process');
    const root = execSync('npm root -g', { encoding: 'utf8' }).trim();
    return require(require('path').join(root, 'chrome-remote-interface'));
  } catch (e) {
    throw new Error('缺少 chrome-remote-interface，请先执行：npm i -g chrome-remote-interface');
  }
}

const EDGE = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const URL_ARG = process.argv[2] || 'https://studentop.cn:14355/?skipLock=1';
const PORT = 9417;

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

(async () => {
  const profile = path.join(os.tmpdir(), 'edge-shortcut-' + Date.now());
  const child = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--disable-extensions', '--mute-audio', '--no-default-browser-check',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile,
    '--window-size=1680,959', 'about:blank'
  ], { stdio: 'ignore', windowsHide: true });

  const result = { url: URL_ARG, opened: [], errors: [] };
  let client;
  try {
    await waitPort(PORT, 20000);
    const list = await getJSON('http://127.0.0.1:' + PORT + '/json/list');
    const page = list.find(t => t.type === 'page');
    client = await CDP({ target: page.webSocketDebuggerUrl, local: true });
    const { Page, Runtime, Input, Emulation } = client;
    await Page.enable(); await Runtime.enable();
    await Emulation.setDeviceMetricsOverride({ width: 1680, height: 959, deviceScaleFactor: 1, mobile: false });
    Runtime.exceptionThrown(p => result.errors.push('EXCEPTION: ' + (p.exceptionDetails && p.exceptionDetails.text)));
    const loaded = new Promise(r => { Page.loadEventFired(() => r()); setTimeout(r, 15000); });
    await Page.navigate({ url: URL_ARG });
    await loaded;
    await sleep(1500);

    for (const appId of ['frost-atlas', 'liyun-explorer', 'genshin-start']) {
      const box = await Runtime.evaluate({
        expression: '(function(){var el=document.querySelector(\'.desktop-icon[data-app="' + appId + '"]\');if(!el)return null;var r=el.getBoundingClientRect();return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2});})()',
        returnByValue: true
      });
      const raw = box.result && box.result.value;
      if (!raw) { result[appId] = 'ICON_NOT_FOUND'; continue; }
      const { x, y } = JSON.parse(raw);
      // 真实双击：两次 press/release，第二次 clickCount=2
      for (const clickCount of [1, 2]) {
        await Input.dispatchMouseEvent({ type: 'mousePressed', x, y, button: 'left', clickCount });
        await Input.dispatchMouseEvent({ type: 'mouseReleased', x, y, button: 'left', clickCount });
        await sleep(60);
      }
      await sleep(2200);
      const after = await getJSON('http://127.0.0.1:' + PORT + '/json/list');
      const urls = after.filter(t => t.type === 'page').map(t => t.url);
      result[appId] = urls.filter(u => /frost\.studentop\.cn|liyun\.studentop\.cn|genshin\.studentop\.cn/.test(u));
      // 关掉新标签页，避免影响下一次统计
      for (const t of after.filter(t => t.type === 'page' && /studentop\.cn/.test(t.url) && t.url !== URL_ARG)) {
        try {
          const c2 = await CDP({ target: t.webSocketDebuggerUrl, local: true });
          await c2.Page.close(); await c2.close();
        } catch (e) {}
      }
      await sleep(500);
    }
    console.log(JSON.stringify(result));
  } catch (e) {
    console.log(JSON.stringify({ ok: false, error: String(e && e.stack || e), ...result }));
    process.exitCode = 1;
  } finally {
    try { if (client) await client.close(); } catch (e) {}
    try { child.kill(); } catch (e) {}
    await sleep(300);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
  }
})();
