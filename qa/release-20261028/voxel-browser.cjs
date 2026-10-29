/* Real voxel-campus acceptance. Run only after Lead starts the approved service.
 * OpenCLI doctor (Lead, 2026-10-28): bridge disconnected/profiles=[]; approved fallback:
 * qa/lib.js creates and closes its own isolated Edge/CDP profile, never a user's tab.
 * This script does not install, build, start a web service, authenticate, deploy, or edit source.
 * It observes actual DOM/media/WebGL and dispatches trusted CDP input. No fake app phase.
 * The shared Edge launcher mutes physical output; playback checks do not claim audible review.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { args, newSession, until, sleep } = require('../lib.js');
const DEFAULT_URL = 'http://127.0.0.1:5180/';
const PUBLIC_URL = 'https://studentop.cn:14355/voxel-campus/';
const OUTPUT = path.join(__dirname, 'voxel-browser.json');

function validateURL(raw, allowPublic = false) {
  const u = new URL(raw);
  if (u.username || u.password || u.search || u.hash) throw new Error('Credentials, query strings and fragments are not accepted QA targets.');
  if (u.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(u.hostname) && u.port === '5180' && u.pathname === '/') return { url: u.href, public: false };
  if (allowPublic && u.href === PUBLIC_URL) return { url: u.href, public: true };
  throw new Error('Target blocked: use loopback port 5180 root, or --allow-public with the exact approved /voxel-campus/ production URL.');
}

async function run() {
  const options = args();
  if (options._.length || Object.keys(options).some(k => !['_','url','allow-public','help'].includes(k))) throw new Error('Allowed options: --url, --allow-public, --help.');
  if (options.help) {
    console.log('node qa/release-20261028/voxel-browser.cjs [--url ' + DEFAULT_URL + ']\nnode qa/release-20261028/voxel-browser.cjs --allow-public --url ' + PUBLIC_URL);
    return;
  }
  const target = validateURL(options.url || DEFAULT_URL, !!options['allow-public']);
  const targetURL = new URL(target.url);
  const mode = target.public ? 'public' : 'local';
  const report = { ok: false, target: target.url, mode, startedAt: new Date().toISOString(), driver: 'owned isolated Edge/CDP via qa/lib.js', opencliDecision: 'Lead doctor: bridge disconnected/profiles=[]; no environment repair', physicalAudioMutedByHarness: true, softwareRendererDeviceScaleFactor: 0.5, checks: [], screenshots: [], canvas: [], media: {}, network: [], warnings: [], unexpectedErrors: [], optionalDevelopmentStats: null };
  let session, closing = false, currentStep = 'create isolated browser';
  const mediaEvents = [], mediaErrors = [], contextEvents = [], shaderErrors = [], blockedRequests = [];
  const mediaRequests = new Set();
  const resources = new Map();
  const warningSet = new Set();
  const pendingRequests = new Map();
  let mediaSupported = false, audioSupported = false;

  function record(name, details = {}) { report.checks.push({ name, pass: true, ...details }); console.log('PASS ' + name); }
  async function step(name, work) {
    currentStep = name;
    try { const details = await work(); assertNoErrors(); record(name, details || {}); }
    catch (error) { report.checks.push({ name, pass: false, error: String(error.message || error) }); throw error; }
  }
  function assertNoErrors() {
    const errors = [...(session?.errors || []), ...shaderErrors, ...mediaErrors, ...blockedRequests];
    assert.equal(errors.length, 0, 'Unexpected browser/network/media error: ' + errors.slice(0, 8).join(' | '));
  }
  function page(fn, ...values) { return session.evaluate('(' + fn.toString() + ')(...' + JSON.stringify(values) + ')'); }
  async function waitFor(fn, label, timeout = 30000, ...values) { return until(() => page(fn, ...values), timeout, label); }
  async function shot(name) {
    const file = 'voxel-' + mode + '-' + name + '.png';
    await session.screenshot(path.join(__dirname, file));
    report.screenshots.push(file);
  }
  async function hit(selector) {
    const result = await page(sel => {
      const e = document.querySelector(sel);
      if (!e || e.disabled) return { error: 'missing/disabled' };
      const r = e.getBoundingClientRect();
      for (let p = e; p && p.nodeType === 1; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (p.hidden || s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < .02) return { error: 'hidden ancestor' };
      }
      const x = r.x + r.width / 2, y = r.y + r.height / 2;
      const top = document.elementFromPoint(x, y);
      return { x, y, width: r.width, height: r.height, hit: !!top && (top === e || e.contains(top)), top: top?.id || top?.tagName || null, inViewport: x >= 0 && y >= 0 && x < document.documentElement.clientWidth && y < document.documentElement.clientHeight };
    }, selector);
    assert(!result.error && result.width > 0 && result.height > 0 && result.inViewport && result.hit, 'Unclickable ' + selector + ': ' + JSON.stringify(result));
    return result;
  }
  async function click(selector) {
    await hit(selector);
    await session.click(selector); // actual Input.dispatchMouseEvent, never element.click()
  }
  async function tap(selector) {
    const { x, y } = await hit(selector);
    await session.call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    await session.call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  async function key(keyValue, code, vk, text) {
    const down = { type: 'keyDown', key: keyValue, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk };
    if (text !== undefined) Object.assign(down, { text, unmodifiedText: text });
    await session.call('Input.dispatchKeyEvent', down);
    await session.call('Input.dispatchKeyEvent', { type: 'keyUp', key: keyValue, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  }
  async function resize(width, height, mobile = false) {
    await session.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 0.5, mobile, screenWidth: width, screenHeight: height, screenOrientation: { type: width > height ? 'landscapePrimary' : 'portraitPrimary', angle: width > height ? 90 : 0 } });
    await session.call('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: mobile ? 5 : 1 });
    await waitFor((w, h) => innerWidth === w && innerHeight === h, 'Viewport ' + width + 'x' + height, 10000, width, height);
    await sleep(250);
  }
  async function bounds(selectors) {
    const result = await page(list => {
      const root = document.documentElement;
      return { clientWidth: root.clientWidth, scrollWidth: root.scrollWidth, bodyScrollWidth: document.body.scrollWidth, boxes: list.map(sel => { const e = document.querySelector(sel); if (!e) return { selector: sel, missing: true }; const r = e.getBoundingClientRect(); return { selector: sel, x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; }) };
    }, selectors);
    assert(result.scrollWidth <= result.clientWidth, 'Root horizontal overflow: ' + JSON.stringify(result));
    assert(result.bodyScrollWidth <= result.clientWidth, 'Body horizontal overflow: ' + JSON.stringify(result));
    for (const b of result.boxes) assert(!b.missing && b.width > 0 && b.height > 0 && b.x >= -1 && b.right <= result.clientWidth + 1, 'Element horizontally outside viewport: ' + JSON.stringify(b));
    return result;
  }
  async function existingWebGLContexts() {
    // Query *existing* native objects: calling canvas.getContext here could create a
    // fake successful context on an otherwise blank app, so that is deliberately forbidden.
    const contexts = [];
    try {
      for (const type of ['WebGL2RenderingContext', 'WebGLRenderingContext']) {
        const proto = await session.call('Runtime.evaluate', { expression: 'typeof ' + type + ' === "function" ? ' + type + '.prototype : null', objectGroup: 'voxel-webgl-audit' });
        if (!proto.result?.objectId) continue;
        const objects = await session.call('Runtime.queryObjects', { prototypeObjectId: proto.result.objectId, objectGroup: 'voxel-webgl-audit' });
        const result = await session.call('Runtime.callFunctionOn', { objectId: objects.objects.objectId, functionDeclaration: 'function () { return Array.from(this).filter(c => c.canvas && c.canvas.id === "scene" && c.canvas.ownerDocument === document).map(c => ({version:c.getParameter(c.VERSION),renderer:c.getParameter(c.RENDERER),lost:c.isContextLost(),width:c.drawingBufferWidth,height:c.drawingBufferHeight,attributes:c.getContextAttributes()})); }', returnByValue: true });
        if (result.exceptionDetails) throw new Error('Unable to inspect actual WebGL context');
        contexts.push(...(result.result?.value || []));
      }
    } finally { await session.call('Runtime.releaseObjectGroup', { objectGroup: 'voxel-webgl-audit' }).catch(() => {}); }
    assert(contexts.length > 0, 'No existing renderer context belongs to canvas#scene');
    for (const c of contexts) assert(!c.lost && c.width > 200 && c.height > 150 && /WebGL/.test(c.version), 'Lost/invalid WebGL context');
    return contexts;
  }
  async function frame(label) {
    const data = await page(() => {
      const source = document.getElementById('scene');
      const sample = document.createElement('canvas'); sample.width = 48; sample.height = 30;
      const context = sample.getContext('2d', { willReadFrequently: true });
      context.drawImage(source, 0, 0, 48, 30); // read-only copy of the real already-rendered canvas
      const pixels = context.getImageData(0, 0, 48, 30).data;
      let hash = 2166136261, sum = 0, min = 255, max = 0, opaque = 0;
      const bins = new Set();
      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], l = .2126 * r + .7152 * g + .0722 * b;
        sum += l; min = Math.min(min, l); max = Math.max(max, l); if (pixels[i + 3] > 240) opaque++;
        const color = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4); bins.add(color); hash = Math.imul(hash ^ color, 16777619) >>> 0;
      }
      return { hash: hash.toString(16), meanLuma: sum / 1440, range: max - min, colorBins: bins.size, opaqueFraction: opaque / 1440, bufferWidth: source.width, bufferHeight: source.height, timeMode: document.body.dataset.timeMode, period: document.body.dataset.period };
    });
    assert(data.opaqueFraction > .95 && data.colorBins >= 6 && data.range > 18 && data.meanLuma > 1, 'Blank/flat rendered frame: ' + JSON.stringify(data));
    if (label) report.canvas.push({ label, ...data });
    return data;
  }
  async function distanceSample(simulatedSeconds = 1.2, minFrames = 30) {
    return page((targetSeconds, targetFrames) => new Promise((resolve, reject) => {
      const read = () => Number(document.getElementById('distance-value').textContent.replace(/,/g, ''));
      const start = read(); let last = performance.now(), simulated = 0, frames = 0, live = true, handle;
      const beginning = last;
      const timer = setTimeout(() => { live = false; cancelAnimationFrame(handle); reject(new Error('No sufficient real rendering frames for movement observation')); }, 45000);
      function observe(t) {
        if (!live) return;
        simulated += Math.min(Math.max((t - last) / 1000, 0), .06); last = t; frames++;
        if (simulated >= targetSeconds && frames >= targetFrames) { live = false; clearTimeout(timer); resolve({ start, end: read(), delta: read() - start, simulatedSeconds: simulated, frames, wallMs: t - beginning }); }
        else handle = requestAnimationFrame(observe);
      }
      handle = requestAnimationFrame(observe);
    }), simulatedSeconds, minFrames);
  }
  async function setPaused(paused, touch = false) {
    if (await page(() => document.getElementById('pause-button').getAttribute('aria-pressed') === 'true') !== paused) await (touch ? tap('#pause-button') : click('#pause-button'));
    await waitFor(value => document.getElementById('pause-button').getAttribute('aria-pressed') === String(value), 'Actual pause control', 10000, paused);
  }
  const playCount = () => mediaEvents.filter(e => /(?:kPlay|"event"\s*:\s*"playing")/i.test(e.value)).length;
  const pauseCount = () => mediaEvents.filter(e => /kPause/i.test(e.value)).length;
  async function waitPlaying(afterPlayCount) {
    await waitFor(() => { const b = document.getElementById('sound-button'); return b.getAttribute('aria-pressed') === 'true' && b.getAttribute('aria-busy') === 'false'; }, 'User-initiated audio playback', 30000);
    await until(() => playCount() > afterPlayCount && contextEvents.some(c => c.contextState === 'running') && mediaRequests.size > 0, 15000, 'Real Media/WebAudio/network playback evidence');
  }
  async function mute() {
    const before = pauseCount();
    if (await page(() => document.getElementById('sound-button').getAttribute('aria-pressed') === 'true')) await click('#sound-button');
    await waitFor(() => document.getElementById('sound-button').getAttribute('aria-pressed') === 'false', 'Explicit mute UI');
    await until(() => pauseCount() > before, 10000, 'Native audio player paused after mute fade');
  }

  try {
    session = await newSession({ size: '1440x900', allowPublic: target.public });
    // Keep the CSS viewport and all real rendering logic; reduce only pixel density for SwiftShader.
    await session.call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 0.5, mobile: false });
    session.client.on('Media.playerEventsAdded', e => { for (const event of e.events || []) mediaEvents.push({ playerId: e.playerId, ...event }); });
    session.client.on('Media.playerErrorsRaised', e => { for (const error of e.errors || []) mediaErrors.push('MEDIA: ' + JSON.stringify(error)); });
    session.client.on('WebAudio.contextCreated', e => contextEvents.push(e.context));
    session.client.on('WebAudio.contextChanged', e => contextEvents.push(e.context));
    session.client.on('Runtime.consoleAPICalled', e => {
      if (e.type !== 'warning') return;
      const text = e.args.map(a => a.value ?? a.description ?? a.type).join(' '); warningSet.add(text);
      if (/shader|webgl|GL_INVALID|context lost/i.test(text) && !/GPU stall due to ReadPixels/i.test(text)) shaderErrors.push('GPU WARNING: ' + text);
    });
    session.client.on('Log.entryAdded', e => {
      const text = e.entry?.text || '';
      if (e.entry?.level === 'warning') warningSet.add(text);
      if ((e.entry?.level === 'error' || /shader|GL_INVALID|context lost/i.test(text)) && !/GPU stall due to ReadPixels/i.test(text)) shaderErrors.push('BROWSER LOG: ' + text);
    });
    session.client.on('Network.requestWillBeSent', e => pendingRequests.set(e.requestId, { url: e.request.url, type: e.type }));
    session.client.on('Network.responseReceived', e => {
      const row = { url: e.response.url, type: e.type, status: e.response.status, mimeType: e.response.mimeType };
      resources.set(e.requestId, row);
      if (/audio\//i.test(row.mimeType) || /\.(?:opus|ogg|mp3|m4a)(?:$|[?#])/i.test(row.url)) mediaRequests.add(row.url);
    });
    session.client.on('Network.loadingFailed', e => {
      if (closing || e.canceled) return;
      const request = pendingRequests.get(e.requestId);
      warningSet.add('Request failed: ' + (request?.url || e.requestId) + ' ' + e.errorText);
    });
    await session.call('Log.enable');
    try { await session.call('Media.enable'); mediaSupported = true; } catch (e) { report.warnings.push('Media CDP unavailable: ' + e.message); }
    try { await session.call('WebAudio.enable'); audioSupported = true; } catch (e) { report.warnings.push('WebAudio CDP unavailable: ' + e.message); }
    if (target.public) {
      session.client.on('Fetch.requestPaused', e => {
        if (closing) return;
        const raw = e.request.url; let allowed = true;
        if (/^https?:/.test(raw)) { const u = new URL(raw); allowed = u.origin === targetURL.origin && u.pathname.startsWith('/voxel-campus/'); }
        if (!allowed) {
          blockedRequests.push('Out-of-scope public request blocked: ' + raw);
          void session.call('Fetch.failRequest', { requestId: e.requestId, errorReason: 'BlockedByClient' }).catch(error => { if (!closing) blockedRequests.push(String(error)); });
        } else void session.call('Fetch.continueRequest', { requestId: e.requestId }).catch(error => { if (!closing) blockedRequests.push(String(error)); });
      });
      await session.call('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
    }

    await step('startup completes into the actual campus UI without startup-error', async () => {
      await session.navigate(target.url);
      await waitFor(() => document.getElementById('startup')?.classList.contains('is-complete') && getComputedStyle(document.getElementById('startup')).visibility === 'hidden', 'Real startup rendering', 90000);
      const state = await page(() => ({ url: location.href, title: document.title, error: document.getElementById('startup').classList.contains('startup-error'), heading: document.getElementById('experience-title').textContent, active: document.body.classList.contains('journey-active'), count: document.querySelectorAll('[data-landmark]').length }));
      assert.equal(state.url, target.url); assert.equal(state.error, false); assert.equal(state.active, false); assert.equal(state.heading, '云上良乡'); assert.equal(state.count, 8);
      await hit('#start-button'); await shot('arrival-1440'); return state;
    });
    await step('existing WebGL renderer and nonblank canvas are independently observed', async () => {
      const contexts = await existingWebGLContexts(); const pixels = await frame('arrival'); return { contexts, pixels };
    });
    await step('arrival is silent before any explicit user gesture', async () => {
      assert(mediaSupported && audioSupported, 'This acceptance requires Media and WebAudio observation; do not silently pass unavailable instrumentation.');
      const state = await page(() => ({ pressed: document.getElementById('sound-button').getAttribute('aria-pressed'), busy: document.getElementById('sound-button').getAttribute('aria-busy') }));
      assert.equal(state.pressed, 'false'); assert.notEqual(state.busy, 'true'); assert.equal(playCount(), 0); assert.equal(mediaRequests.size, 0); assert.equal(contextEvents.length, 0); return state;
    });
    await step('real start click enters journey and starts intended user-initiated music', async () => {
      const before = playCount(); await click('#start-button');
      await waitFor(() => document.body.classList.contains('journey-active'), 'Journey start');
      await waitPlaying(before); const movement = await distanceSample(); assert(movement.delta > 0, 'Journey distance did not advance');
      await frame('journey-start'); await shot('journey-1440'); return { movement, nativePlayEvents: playCount(), audioContextRunning: true };
    });
    await step('pause stops real distance accumulation and resume continues it', async () => {
      await setPaused(true); const stopped = await distanceSample(.7, 20); assert.equal(stopped.delta, 0, 'Paused journey moved');
      await setPaused(false); const moving = await distanceSample(.7, 20); assert(moving.delta > 0, 'Resumed journey did not move'); return { stopped, moving };
    });
    await step('speed controls change selected state and observed movement rate', async () => {
      await click('[data-speed="0.6"]');
      assert.equal(await page(() => document.querySelector('[data-speed="0.6"]').getAttribute('aria-pressed')), 'true');
      const slow = await distanceSample(1.5, 36);
      await click('[data-speed="1.6"]');
      assert.equal(await page(() => document.querySelector('[data-speed="1.6"]').getAttribute('aria-pressed')), 'true');
      const fast = await distanceSample(1.5, 36);
      const slowRate = slow.delta / slow.simulatedSeconds, fastRate = fast.delta / fast.simulatedSeconds;
      assert(slow.delta > 0 && fastRate > slowRate * 1.5, 'Fast setting did not measurably exceed slow movement: ' + JSON.stringify({ slow, fast }));
      assert.equal(await page(() => document.querySelectorAll('[data-speed][aria-pressed="true"]').length), 1);
      await click('[data-speed="1"]'); await setPaused(true); return { slow, fast, slowRate, fastRate };
    });
    await step('explicit mute pauses the native media player', async () => { await mute(); return { nativePauseEvents: pauseCount() }; });
    await step('all eight real landmark buttons select matching content and camera travel', async () => {
      const available = await page(() => [...document.querySelectorAll('[data-landmark]')].map(e => ({ index: Number(e.dataset.landmark), id: e.dataset.landmarkId, title: e.title })));
      const current = await page(() => Number(document.querySelector('[data-landmark][aria-pressed="true"]').dataset.landmark));
      // This source intentionally jumps only to upcoming islands. Visit in cyclic
      // forward order from the currently visible landmark; never force travel backwards.
      const landmarks = available.slice(current).concat(available.slice(0, current));
      const evidence = [];
      for (const landmark of landmarks) {
        await click('[data-landmark="' + landmark.index + '"]');
        await waitFor((index, title) => document.querySelector('[data-landmark="' + index + '"]').getAttribute('aria-pressed') === 'true' && document.getElementById('landmark-index').textContent === String(index + 1).padStart(2, '0') && document.getElementById('landmark-title').textContent === title, 'Landmark ' + landmark.id, 45000, landmark.index, landmark.title);
        await setPaused(true); const pixels = await frame(); const distance = await page(() => document.getElementById('distance-value').textContent);
        evidence.push({ ...landmark, distance, frame: pixels.hash });
        assert.equal(await page(() => document.querySelectorAll('[data-landmark][aria-pressed="true"]').length), 1);
      }
      assert(new Set(evidence.map(e => e.frame)).size >= 6, 'Landmark jumps did not change rendered views'); await shot('landmark-last'); return { landmarks: evidence };
    });
    const lightFrames = {};
    for (const [light, label] of [['morning','清晨'],['day','白昼'],['evening','黄昏'],['night','月夜']]) {
      await step('real light selection ' + light + ' updates UI and rendered pixels', async () => {
        await click('#time-button'); await waitFor(() => !document.getElementById('time-panel').hidden, 'Light panel opens');
        await click('#time-panel button[data-time-mode="' + light + '"]');
        await waitFor((mode, text) => document.body.dataset.timeMode === mode && document.body.dataset.period === mode && document.getElementById('time-label').textContent === text && document.querySelector('#time-panel button[data-time-mode="' + mode + '"]').getAttribute('aria-pressed') === 'true' && document.getElementById('time-panel').hidden, 'Light state ' + light, 10000, light, label);
        // Actual render-frame budget, not assigning world.time/phase/debug state.
        await distanceSample(2.2, 42); const pixels = await frame(light); lightFrames[light] = pixels;
        await shot('light-' + light); return { pixels };
      });
    }
    await step('four light renders differ and night is visibly darker than day', async () => {
      assert.equal(new Set(Object.values(lightFrames).map(f => f.hash)).size, 4);
      assert(lightFrames.night.meanLuma < lightFrames.day.meanLuma * .85, 'Night did not darken the actual canvas');
      return { luminance: Object.fromEntries(Object.entries(lightFrames).map(([name, f]) => [name, f.meanLuma])) };
    });
    await step('music can be explicitly re-enabled and muted after the night switch', async () => {
      const before = playCount(); await click('#sound-button'); await waitPlaying(before);
      assert.equal(await page(() => document.getElementById('sound-button').dataset.track), 'night');
      await mute(); return { playEvents: playCount(), pauseEvents: pauseCount(), tracksRequested: [...mediaRequests] };
    });
    await step('time menu keyboard escape and auto-time controls remain real', async () => {
      await click('#time-button'); await key('Escape', 'Escape', 27);
      assert.equal(await page(() => document.getElementById('time-panel').hidden), true);
      assert.equal(await page(() => document.activeElement.id), 'time-button');
      await click('#time-button'); await click('#time-panel button[data-time-mode="auto"]');
      await waitFor(() => document.body.dataset.timeMode === 'auto' && !document.getElementById('time-auto-dot').hidden, 'Auto time');
      const value = await page(() => document.getElementById('time-value').textContent); assert(/^\d{2}:\d{2}$/.test(value)); return { displayedTime: value };
    });
    await step('about dialog opens, exposes safe reference links, and closes by Escape', async () => {
      await click('#info-button'); await waitFor(() => document.getElementById('about-dialog').open, 'About dialog');
      await hit('#close-info-button');
      const links = await page(() => [...document.querySelectorAll('#source-links a')].map(a => ({ href: a.href, target: a.target, rel: a.rel })));
      assert(links.length >= 1 && links.every(a => a.target === '_blank' && a.rel.includes('noopener') && a.rel.includes('noreferrer')));
      await shot('about'); await key('Escape', 'Escape', 27); await waitFor(() => !document.getElementById('about-dialog').open, 'About dialog Escape'); return { referencesInspectedNotOpened: links.length };
    });
    await step('H hides and restores the original interface without touching app state', async () => {
      await key('h', 'KeyH', 72, 'h'); await waitFor(() => document.body.classList.contains('ui-hidden') && Number(getComputedStyle(document.getElementById('ui')).opacity) < .02, 'Hide UI');
      await shot('canvas-only'); await key('h', 'KeyH', 72, 'h'); await waitFor(() => !document.body.classList.contains('ui-hidden') && Number(getComputedStyle(document.getElementById('ui')).opacity) > .98, 'Restore UI');
    });
    await step('home and re-entry preserve a prior explicit mute preference', async () => {
      await click('#home-button'); await waitFor(() => !document.body.classList.contains('journey-active') && Number(getComputedStyle(document.getElementById('start-button')).opacity) > .98, 'Home screen');
      const before = playCount(); await click('#start-button'); await waitFor(() => document.body.classList.contains('journey-active'), 'Re-enter');
      await sleep(700); assert.equal(await page(() => document.getElementById('sound-button').getAttribute('aria-pressed')), 'false'); assert.equal(playCount(), before); await setPaused(true);
    });
    for (const [width, height] of [[1920,1080],[1366,768]]) {
      await step('desktop landscape ' + width + 'x' + height + ' stays in viewport and clickable', async () => {
        await resize(width, height); const geometry = await bounds(['#scene','.masthead','.journey-footer','#time-button','#sound-button','#pause-button','.chapter-dots']);
        for (const sel of ['#time-button','#sound-button','#info-button','#pause-button','[data-speed="1"]']) await hit(sel);
        await frame(String(width)); await shot('landscape-' + width); return geometry;
      });
    }
    await step('844x390 touch landscape preserves the supplied design and working controls', async () => {
      await resize(844, 390, true);
      const geometry = await bounds(['#scene','.masthead','.journey-footer','#time-button','#sound-button','#pause-button','.chapter-dots']);
      assert.equal(await page(() => getComputedStyle(document.querySelector('.portrait-notice')).display), 'none');
      await tap('[data-speed="0.6"]'); assert.equal(await page(() => document.querySelector('[data-speed="0.6"]').getAttribute('aria-pressed')), 'true');
      await setPaused(false, true); const movement = await distanceSample(.7, 20); assert(movement.delta > 0); await setPaused(true, true);
      await tap('#time-button'); await waitFor(() => !document.getElementById('time-panel').hidden, 'Touch light panel');
      await tap('#time-panel button[data-time-mode="day"]'); await waitFor(() => document.body.dataset.timeMode === 'day', 'Touch light selection');
      await shot('landscape-844-touch'); return { geometry, movement };
    });
    await step('390x844 intentionally shows the original rotation notice instead of the canvas', async () => {
      await resize(390, 844, true);
      const state = await page(() => ({ portrait: getComputedStyle(document.querySelector('.portrait-notice')).display, canvas: getComputedStyle(document.getElementById('scene')).display, ui: getComputedStyle(document.getElementById('ui')).display, message: document.querySelector('.portrait-notice').textContent }));
      assert.notEqual(state.portrait, 'none'); assert.equal(state.canvas, 'none'); assert.equal(state.ui, 'none'); assert(/旋转至横屏/.test(state.message));
      const geometry = await bounds(['.portrait-notice','.portrait-notice h2','.rotate-device']); await shot('portrait-390'); return { state, geometry };
    });
    await step('rotation back to landscape restores real canvas and input', async () => {
      await resize(844, 390, true);
      await waitFor(() => getComputedStyle(document.getElementById('scene')).display !== 'none' && getComputedStyle(document.querySelector('.portrait-notice')).display === 'none', 'Rotate back');
      await existingWebGLContexts(); await tap('[data-speed="1"]'); await setPaused(false, true); const movement = await distanceSample(.7, 20); assert(movement.delta > 0); await setPaused(true, true); await frame('rotation-restored'); return { movement };
    });
    await step('no source debug global is required for acceptance', async () => {
      if (!target.public) {
        report.optionalDevelopmentStats = await page(() => typeof window.campus?.stats === 'function' ? window.campus.stats() : null);
      }
      return { productionGlobalRead: false, localOptionalDiagnostics: report.optionalDevelopmentStats !== null };
    });
    await step('final navigation, console, shader, media and network audit', async () => {
      assert.equal(await page(() => location.href), target.url);
      const unexpectedNavigations = session.nav.filter(url => url !== 'about:blank' && url !== target.url);
      assert.deepEqual(unexpectedNavigations, []); assertNoErrors();
      return { navigations: session.nav.length, resourceResponses: resources.size, mediaObserved: mediaEvents.length, webAudioObserved: contextEvents.length };
    });
    report.ok = true;
  } catch (error) {
    report.error = String(error.stack || error);
    if (!report.checks.some(c => c.pass === false)) report.checks.push({ name: currentStep, pass: false, error: String(error.message || error) });
    if (session) { try { await shot('failure'); } catch (shotError) { report.failureScreenshotError = String(shotError.message || shotError); } }
    process.exitCode = 1;
  } finally {
    report.finishedAt = new Date().toISOString();
    report.unexpectedErrors = [...(session?.errors || []), ...shaderErrors, ...mediaErrors, ...blockedRequests];
    if (report.unexpectedErrors.length && report.ok) {
      report.ok = false; process.exitCode = 1;
      report.checks.push({ name: 'late browser error audit', pass: false, error: report.unexpectedErrors.slice(0, 8).join(' | ') });
    }
    report.warnings.push(...warningSet);
    report.network = [...resources.values()];
    report.media = { mediaSupported, audioSupported, playEvents: playCount(), pauseEvents: pauseCount(), mediaURLs: [...mediaRequests], contexts: contextEvents, events: mediaEvents.slice(-100) };
    closing = true;
    if (session) {
      try { await session.close(); }
      catch (error) { report.ok = false; process.exitCode = 1; report.checks.push({ name: 'owned browser cleanup', pass: false, error: String(error.message || error) }); }
    }
    report.total = report.checks.length;
    report.passed = report.checks.filter(c => c.pass).length;
    fs.mkdirSync(__dirname, { recursive: true });
    fs.writeFileSync(OUTPUT, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ ok: report.ok, passed: report.passed, total: report.total, report: OUTPUT, mode, error: report.error || null }));
  }
}

module.exports = { validateURL };
if (require.main === module) run().catch(error => { console.error(String(error.stack || error)); process.exitCode = 1; });
