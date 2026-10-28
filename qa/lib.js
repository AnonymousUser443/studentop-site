/* Shared legacy QA harness. Importing this module never launches a browser. Node >=22.12. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const net = require('node:net');
const { EventEmitter } = require('node:events');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function args(argv = process.argv.slice(2)) {
  const options = { _: [] };
  const known = new Set(['url','out','wait','eval','eval-file','size','port','targets','target','mode','outdir','start-selector','door-selector','allow-public','require-checks','help']);
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) { options._.push(argv[i]); continue; }
    const name = argv[i].slice(2);
    if (!known.has(name)) throw new Error('Unknown option: --' + name);
    if (['allow-public', 'require-checks', 'help'].includes(name)) options[name] = true;
    else {
      if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error('Missing value for --' + name);
      options[name] = argv[++i];
    }
  }
  return options;
}
function loopback(url) { return ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname); }
function targetURL(raw, allowPublic = false) {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Target must be an HTTP(S) URL without credentials.');
  if (!allowPublic && !loopback(url.href)) throw new Error('Public target blocked. Use --allow-public only with explicit owner authorization.');
  return url.href;
}
function matchesTarget(actual, expected) {
  try { const a = new URL(actual); const b = new URL(expected); return a.origin === b.origin && a.pathname === b.pathname && (!b.search || a.search === b.search) && (!b.hash || a.hash === b.hash); }
  catch { return false; }
}
function evaluation(raw, requireChecks = false) {
  let value = raw;
  if (typeof raw === 'string' && (/^[\[{]/.test(raw.trim()) || ['true','false','null'].includes(raw.trim()))) {
    try { value = JSON.parse(raw); } catch { throw new Error('Malformed JSON evaluation result.'); }
  }
  if (value === false || value === undefined || value === null) throw new Error('Evaluation returned no successful result.');
  if (value && typeof value === 'object') {
    if (value.ok === false || value.success === false || value.fatal || value.__error || value.error) throw new Error('Evaluation reports failure: ' + JSON.stringify(value));
    if (Array.isArray(value.errors) && value.errors.length) throw new Error('Evaluation contains errors: ' + JSON.stringify(value.errors));
    const hasChecks = Object.hasOwn(value, 'checks') || Object.hasOwn(value, 'results');
    const checks = Object.hasOwn(value, 'checks') ? value.checks : value.results;
    if (hasChecks) {
      if (!Array.isArray(checks) || checks.length === 0) throw new Error('Assertion list is empty or invalid.');
      const failed = checks.filter(c => {
        if (!c || typeof c !== 'object') return true;
        const flags = ['pass','passed','ok'].filter(key => Object.hasOwn(c,key));
        return !flags.length || flags.some(key => c[key] !== true);
      });
      if (failed.length) throw new Error('Failed assertions: ' + JSON.stringify(failed));
      if (value.total !== undefined && value.total !== checks.length) throw new Error('Assertion total mismatch.');
      if (typeof value.passed === 'number' && value.passed !== checks.length) throw new Error('Assertion count mismatch.');
      return { value, assertions: checks.length };
    }
  }
  if (requireChecks) throw new Error('Expected a nonempty checks/results array.');
  return { value, assertions: 0 };
}
class Protocol extends EventEmitter {
  constructor(ws) {
    super(); this.ws = ws; this.seq = 0; this.pending = new Map();
    ws.addEventListener('message', event => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const item = this.pending.get(message.id); if (!item) return;
        this.pending.delete(message.id); clearTimeout(item.timer);
        if (message.error) item.reject(new Error(JSON.stringify(message.error))); else item.resolve(message.result);
      } else if (message.method) this.emit(message.method, message.params || {});
    });
    ws.addEventListener('close', () => { for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new Error('CDP closed')); } this.pending.clear(); });
  }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { ws.close(); reject(new Error('CDP connect timeout')); }, 15000);
      ws.addEventListener('open', () => { clearTimeout(timer); resolve(); }, {once:true});
      ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error('CDP connect failed')); }, {once:true});
    });
    return new Protocol(ws);
  }
  call(method, params = {}, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const id = ++this.seq;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, timeout);
      this.pending.set(id, {resolve, reject, timer});
      this.ws.send(JSON.stringify({id, method, params}));
    });
  }
  close() { this.ws.close(); }
}
async function getJSON(url) {
  const response = await fetch(url, {signal:AbortSignal.timeout(3000)});
  if (!response.ok) throw new Error('HTTP ' + response.status + ': ' + url);
  return response.json();
}
async function freePort(port) {
  if (port === 0) return;
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen({host:'127.0.0.1', port, exclusive:true}, () => probe.close(resolve));
  });
}
async function newSession(options = {}) {
  if (typeof WebSocket !== 'function') throw new Error('Node >=22.12 with native WebSocket required.');
  const port = Number(options.port ?? 0);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid debugging port.');
  const size = String(options.size || '1440x900');
  const [width, height] = size.split('x').map(Number);
  if (!/^[0-9]+x[0-9]+$/.test(size) || ![width,height].every(n => Number.isInteger(n) && n >= 200 && n <= 8192)) throw new Error('Invalid --size.');
  await freePort(port); // Never attach to an existing debugging service.
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-qa-'));
  const edge = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  let child, client, childError;
  let closing = false;
  const errors = [];
  const nav = [];
  const close = async () => {
    closing = true;
    if (client) { try { await client.call('Browser.close', {}, 3000); } catch {} client.close(); }
    if (child && child.exitCode === null && child.signalCode === null) {
      await new Promise(resolve => {
        const timer = setTimeout(() => { child.kill(); resolve(); }, 2000);
        child.once('exit', () => { clearTimeout(timer); resolve(); });
      });
    }
    try { fs.rmSync(profile, {recursive:true, force:true}); } catch {}
  };
  try {
    child = spawn(edge, ['--headless=new','--no-first-run','--no-default-browser-check','--disable-extensions','--mute-audio',
      '--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-address=127.0.0.1',
      '--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--window-size=' + width + ',' + height, 'about:blank'],
      {stdio:'ignore', windowsHide:true});
    child.on('error', error => { childError = error; });
    let actualPort = port, version;
    const deadline = Date.now() + 25000;
    while (Date.now() < deadline) {
      if (childError) throw childError;
      if (child.exitCode !== null || child.signalCode !== null) throw new Error('Owned browser exited before connection.');
      try {
        if (!actualPort) actualPort = Number(fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]);
        if (actualPort) { version = await getJSON('http://127.0.0.1:' + actualPort + '/json/version'); if (version.webSocketDebuggerUrl) break; }
      } catch {}
      await sleep(100);
    }
    if (!version?.webSocketDebuggerUrl) throw new Error('Owned browser startup timed out.');
    const pages = await getJSON('http://127.0.0.1:' + actualPort + '/json/list');
    const page = pages.find(p => p.type === 'page' && p.url === 'about:blank');
    if (!page) throw new Error('Isolated blank target missing.');
    client = await Protocol.connect(page.webSocketDebuggerUrl);
    const call = client.call.bind(client);
    client.on('Runtime.exceptionThrown', p => errors.push('EXCEPTION: ' + (p.exceptionDetails?.exception?.description || p.exceptionDetails?.text)));
    client.on('Runtime.consoleAPICalled', p => { if (['error','assert'].includes(p.type)) errors.push('CONSOLE: ' + p.args.map(a => a.value ?? a.description ?? a.type).join(' ')); });
    client.on('Network.responseReceived', p => { if (p.response.status >= 400) errors.push('HTTP ' + p.response.status + ': ' + p.response.url); });
    client.on('Network.loadingFailed', p => { if (!closing && !p.canceled) errors.push('NETWORK: ' + p.errorText); });
    client.on('Page.frameNavigated', p => { if (!p.frame.parentId) nav.push(p.frame.url); });
    await Promise.all([call('Page.enable'),call('Runtime.enable'),call('Network.enable')]);
    await call('Emulation.setDeviceMetricsOverride', {width,height,deviceScaleFactor:1,mobile:false});
    if (!options.allowPublic) {
      client.on('Fetch.requestPaused', p => {
        if (closing) return;
        const url = p.request.url;
        if (/^https?:/.test(url) && !loopback(url)) {
          errors.push('PUBLIC REQUEST BLOCKED: ' + url);
          void call('Fetch.failRequest', {requestId:p.requestId,errorReason:'BlockedByClient'}).catch(e => { if (!closing) errors.push(String(e)); });
        } else void call('Fetch.continueRequest', {requestId:p.requestId}).catch(e => { if (!closing) errors.push(String(e)); });
      });
      await call('Fetch.enable', {patterns:[{urlPattern:'*',requestStage:'Request'}]});
    }
    async function evaluate(expression) {
      const result = await call('Runtime.evaluate', {expression,returnByValue:true,awaitPromise:true}, 90000);
      if (result.exceptionDetails) throw new Error('EVAL: ' + (result.exceptionDetails.exception?.description || result.exceptionDetails.text));
      return result.result?.value;
    }
    async function navigate(url) {
      targetURL(url, options.allowPublic);
      const response = await call('Page.navigate', {url});
      if (response.errorText) throw new Error('Navigation: ' + response.errorText);
      await until(async () => (await evaluate('document.readyState')) === 'complete', 20000, 'Page load');
    }
    async function screenshot(out) {
      fs.mkdirSync(path.dirname(path.resolve(out)), {recursive:true});
      fs.writeFileSync(out, Buffer.from((await call('Page.captureScreenshot', {format:'png'})).data, 'base64'));
    }
    async function click(selector, count = 1) {
      const box = await evaluate('(() => { const e=document.querySelector(' + JSON.stringify(selector) + '); if(!e || e.disabled) return null; const r=e.getBoundingClientRect(); const s=getComputedStyle(e); return r.width>0 && r.height>0 && s.visibility!=="hidden" && s.display!=="none" ? {x:r.x+r.width/2,y:r.y+r.height/2} : null; })()');
      if (!box) throw new Error('Visible enabled target missing: ' + selector);
      for (let clickCount=1;clickCount<=count;clickCount++) {
        await call('Input.dispatchMouseEvent',{type:'mousePressed',...box,button:'left',clickCount});
        await call('Input.dispatchMouseEvent',{type:'mouseReleased',...box,button:'left',clickCount});
      }
    }
    return {call,client,evaluate,navigate,screenshot,click,close,errors,nav,port:actualPort};
  } catch (error) { await close(); throw error; }
}
async function until(check, timeout, label) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { const value = await check(); if (value) return value; await sleep(100); }
  throw new Error(label + ' timed out after ' + timeout + 'ms');
}
function reportFailure(error, extra = {}) { console.log(JSON.stringify({...extra,ok:false,error:String(error.stack || error)})); process.exitCode=1; }
module.exports = {args,loopback,targetURL,matchesTarget,evaluation,newSession,until,sleep,reportFailure};
