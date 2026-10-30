'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { newSession, until, sleep } = require('../lib.js');

const TARGET = 'https://studentop.cn:14355/voxel-campus/';
const target = new URL(TARGET);
const options = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 2) {
  const name = argv[i];
  if (!['--expected-script', '--out'].includes(name) || Object.hasOwn(options, name)) throw new Error('Usage: node public-browser.cjs --expected-script <./assets/index-HASH.js> [--out <new-report.json>]');
  if (!argv[i + 1]?.trim() || argv[i + 1].startsWith('--')) throw new Error('Missing value for ' + name);
  options[name] = argv[i + 1];
}
if (!options['--expected-script']) throw new Error('--expected-script is required.');
const expected = new URL(options['--expected-script'], TARGET);
if (expected.origin !== target.origin || expected.username || expected.password || expected.search || expected.hash || !/^\/voxel-campus\/assets\/index-[A-Za-z0-9_-]+\.js$/.test(expected.pathname)) throw new Error('--expected-script must identify the hashed index bundle under the exact production /voxel-campus/assets/ path.');
const reportPath = path.resolve(options['--out'] || path.join(__dirname, 'public-browser.json'));
if (fs.existsSync(reportPath)) throw new Error('Report already exists; use --out with a new file. Existing receipts will not be overwritten.');

// Observe native media and events only. No synthetic playback, state changes,
// permission overrides, source substitutions, seeking or gain changes.
const observerSource = `(() => {
  const tracks = [], events = [];
  const snapshot = () => tracks.map(({ media, context }, id) => ({
    id, src: media.currentSrc || media.src, paused: media.paused,
    currentTime: media.currentTime, duration: Number.isFinite(media.duration) ? media.duration : null,
    readyState: media.readyState, networkState: media.networkState,
    contextState: context.state, error: media.error ? { code: media.error.code, message: media.error.message } : null
  }));
  Object.defineProperty(window, '__VOXEL_RELEASE_OBSERVER__', { value: { snapshot, events } });
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return;
  const original = Context.prototype.createMediaElementSource;
  Context.prototype.createMediaElementSource = function(media) {
    const node = Reflect.apply(original, this, arguments);
    const id = tracks.length;
    tracks.push({ media, context: this });
    for (const type of ['loadstart', 'loadedmetadata', 'canplay', 'playing', 'waiting', 'stalled', 'pause', 'ended', 'error', 'abort', 'emptied']) {
      media.addEventListener(type, () => {
        if (events.length < 256) events.push({ id, type, atMs: performance.now(), src: media.currentSrc || media.src, currentTime: media.currentTime, readyState: media.readyState, errorCode: media.error?.code || null });
      });
    }
    return node;
  };
})();`;

const report = {
  ok: false, target: TARGET, expectedScript: expected.href, startedAt: new Date().toISOString(),
  scope: 'Read-only public static page; actual UI clicks and native media observations; no authentication or application state injection.',
  environment: 'Owned headless Microsoft Edge, fresh isolated profile, extensions disabled, cache disabled, software rendering, 1440x900. Browser output is muted; this is playback/event evidence, not a physical listening or device performance test.',
  checks: [], snapshots: [], responses: [], mediaRequests: [], blockedRequests: [], diagnostics: [],
};
let session, closing = false;
function check(name, pass, evidence) {
  report.checks.push({ name, pass: Boolean(pass), ...(evidence === undefined ? {} : { evidence }) });
  assert(pass, name + (evidence === undefined ? '' : ': ' + JSON.stringify(evidence)));
}
const mediaPattern = key => new RegExp('^' + TARGET.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + 'assets/' + key + '-[A-Za-z0-9_-]+\\.opus$');
async function snapshot(label) {
  const value = await session.evaluate(`({ tracks: __VOXEL_RELEASE_OBSERVER__.snapshot(), ui: { pressed: document.querySelector('#sound-button')?.getAttribute('aria-pressed'), busy: document.querySelector('#sound-button')?.getAttribute('aria-busy'), track: document.querySelector('#sound-button')?.dataset.track } })`);
  report.snapshots.push({ label, ...value });
  return value;
}
async function playing(key) {
  await until(() => session.evaluate(`(() => {
    const button = document.querySelector('#sound-button');
    return button?.getAttribute('aria-pressed') === 'true' && button.getAttribute('aria-busy') === 'false' && button.dataset.track === ${JSON.stringify(key)} && __VOXEL_RELEASE_OBSERVER__.snapshot().some(m => new RegExp(${JSON.stringify(mediaPattern(key).source)}).test(m.src) && !m.paused && m.readyState >= 2 && m.currentTime > .05 && m.contextState === 'running' && !m.error);
  })()`), 45000, key + ' native public playback');
}
async function choosePeriod(key) {
  await session.click('#time-button');
  await until(() => session.evaluate('document.querySelector("#time-panel")?.hidden === false'), 3000, 'period menu opens');
  await session.click('#time-panel button[data-time-mode="' + key + '"]');
  await until(() => session.evaluate(`document.body.dataset.timeMode === '${key}' && document.querySelector('#time-panel button[data-time-mode="${key}"]')?.getAttribute('aria-pressed') === 'true'`), 3000, key + ' real period control');
}

(async () => {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  try {
    session = await newSession({ size: '1440x900', allowPublic: true });
    session.client.on('Network.requestWillBeSent', ({ request }) => {
      if (/\.opus(?:\?|$)/.test(request.url) && report.mediaRequests.length < 100) report.mediaRequests.push({ url: request.url, method: request.method });
    });
    session.client.on('Network.responseReceived', ({ response, type }) => {
      if (['Document', 'Script', 'Media'].includes(type) && report.responses.length < 100) report.responses.push({ url: response.url, status: response.status, mimeType: response.mimeType, type, fromDiskCache: Boolean(response.fromDiskCache), fromServiceWorker: Boolean(response.fromServiceWorker) });
    });
    session.client.on('Fetch.requestPaused', ({ requestId, request }) => {
      if (closing) return;
      let allowed = /^(data:|blob:)/.test(request.url);
      try {
        const url = new URL(request.url);
        allowed ||= ['GET', 'HEAD'].includes(request.method) && url.origin === target.origin && !url.username && !url.password && url.pathname.startsWith(target.pathname);
      } catch {}
      if (!allowed) report.blockedRequests.push({ url: request.url, method: request.method });
      void session.call(allowed ? 'Fetch.continueRequest' : 'Fetch.failRequest', { requestId, ...(allowed ? {} : { errorReason: 'BlockedByClient' }) }).catch(error => { if (!closing) report.diagnostics.push('Request interception: ' + error.message); });
    });
    await session.call('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
    await session.call('Network.setCacheDisabled', { cacheDisabled: true });
    await session.call('Page.addScriptToEvaluateOnNewDocument', { source: observerSource });
    await session.navigate(TARGET);
    await until(() => session.evaluate('document.querySelector("#startup")?.classList.contains("is-complete")'), 30000, 'public scene startup');
    check('exact public target without authentication navigation', await session.evaluate('location.href') === TARGET);
    const scripts = await session.evaluate('[...document.querySelectorAll("script[src]")].map(s => s.src)');
    check('expected new bundle is referenced and successfully fetched', scripts.includes(expected.href) && report.responses.some(r => r.url === expected.href && r.type === 'Script' && r.status === 200 && !r.fromDiskCache && !r.fromServiceWorker), { expected: expected.href, scripts });
    check('production exposes no development campus global', await session.evaluate('typeof window.campus === "undefined"'));
    const initial = await snapshot('before-intent');
    check('entry is silent without media downloads before a user gesture', initial.ui.pressed === 'false' && initial.tracks.length === 0 && report.mediaRequests.length === 0);

    await choosePeriod('day');
    check('changing the daylight preview before starting stays silent', await session.evaluate('__VOXEL_RELEASE_OBSERVER__.snapshot().length === 0') && report.mediaRequests.length === 0);
    const started = Date.now();
    await session.click('#start-button');
    await playing('day');
    report.dayPlayingAfterClickMs = Date.now() - started;
    const day = (await snapshot('day-playing')).tracks.find(m => mediaPattern('day').test(m.src));
    await until(() => session.evaluate(`__VOXEL_RELEASE_OBSERVER__.snapshot().some(m => m.id === ${day.id} && !m.paused && m.currentTime > ${day.currentTime + .1})`), 6000, 'real day playback time advances');
    check('day recording advances and has a successful public media response', report.responses.some(r => r.url === day.src && [200, 206].includes(r.status)), { src: day.src });

    await choosePeriod('night');
    await playing('night');
    await until(() => session.evaluate(`__VOXEL_RELEASE_OBSERVER__.snapshot().every(m => new RegExp(${JSON.stringify(mediaPattern('night').source)}).test(m.src) || m.paused)`), 8000, 'outgoing day pauses after crossfade');
    const nightState = await snapshot('night-playing');
    const night = nightState.tracks.find(m => mediaPattern('night').test(m.src));
    check('night control plays the real night recording and stops the outgoing day', Boolean(night && !night.paused && nightState.tracks.find(m => m.id === day.id)?.paused) && report.responses.some(r => r.url === night.src && [200, 206].includes(r.status)), { src: night?.src });

    await session.click('#sound-button');
    await until(() => session.evaluate('document.querySelector("#sound-button").getAttribute("aria-pressed") === "false" && document.querySelector("#sound-button").getAttribute("aria-busy") === "false" && __VOXEL_RELEASE_OBSERVER__.snapshot().every(m => m.paused)'), 6000, 'public mute completes');
    const muted = await snapshot('muted');
    check('mute updates the real UI and pauses every observed player', muted.tracks.every(m => m.paused) && muted.ui.pressed === 'false');
    await session.click('#sound-button');
    await playing('night');
    const restored = await snapshot('night-restored');
    check('unmute restores night using the same native player', restored.tracks.length === muted.tracks.length && restored.tracks.some(m => m.id === night.id && !m.paused && mediaPattern('night').test(m.src)));
    await sleep(250);
    const nativeEvents = await session.evaluate('__VOXEL_RELEASE_OBSERVER__.events');
    check('native playing and pause events substantiate the interactions', nativeEvents.some(e => e.id === day.id && e.type === 'playing') && nativeEvents.filter(e => e.id === night.id && e.type === 'playing').length >= 2 && nativeEvents.some(e => e.id === night.id && e.type === 'pause'));
    check('no native media decoding or playback errors', !nativeEvents.some(e => e.type === 'error') && restored.tracks.every(m => !m.error));
    check('all requests stay within read-only public voxel assets', report.blockedRequests.length === 0, report.blockedRequests);
    check('no JavaScript, console, HTTP or network errors', session.errors.length === 0 && report.diagnostics.length === 0, [...session.errors, ...report.diagnostics]);
    report.ok = true;
  } catch (error) {
    report.error = String(error.stack || error);
    process.exitCode = 1;
  } finally {
    if (session) {
      try { report.audio = await session.evaluate('({ tracks: __VOXEL_RELEASE_OBSERVER__?.snapshot() || [], events: __VOXEL_RELEASE_OBSERVER__?.events || [] })'); }
      catch (error) { report.diagnostics.push('Final observation: ' + error.message); }
      report.errors = [...session.errors];
      report.navigations = [...session.nav];
      if (report.errors.length || report.diagnostics.length) { report.ok = false; process.exitCode = 1; }
      closing = true;
      try { await session.close(); }
      catch (error) { report.ok = false; report.diagnostics.push('Browser cleanup: ' + error.message); process.exitCode = 1; }
    }
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ ok: report.ok, checks: report.checks.length, passed: report.checks.filter(c => c.pass).length, report: reportPath }));
  }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
