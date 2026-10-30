'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { args, newSession, until, sleep } = require('../lib.js');
const { startFixture } = require('./fixture.cjs');
const argv = process.argv.slice(2);
if (argv.length && (argv.length !== 2 || argv[0] !== '--out')) throw new Error('Usage: node browser.cjs [--out <new-report.json>]');
const options = args(argv);
if (options.out !== undefined && !options.out.trim()) throw new Error('--out must be a nonempty file path.');
const reportPath = path.resolve(options.out || path.join(__dirname, 'browser-checks.json'));
const failurePath = path.join(path.dirname(reportPath), 'failure.json');
const reportFlag = options.out === undefined ? 'w' : 'wx';
if (options.out !== undefined && (reportPath === failurePath || fs.existsSync(reportPath) || fs.existsSync(failurePath))) throw new Error('--out requires new success and failure report paths; existing receipts will not be overwritten.');
const checks = [], timings = {}, base = '0cee85c7d9da3e08b68342f882f9a88e078ae811';
let fixture, session, mark;
const check = (name, value, evidence) => { assert(value, name + ': ' + JSON.stringify(evidence)); checks.push({ name, pass: true, ...(evidence === undefined ? {} : { evidence }) }); };
const state = () => session.evaluate('audio.getState()');
const pending = () => fixture.requests.slice(mark);
async function page(policy, source) {
  fixture.configure(policy, source);
  mark = fixture.requests.length;
  await session.navigate(fixture.origin + '/');
  await until(() => session.evaluate('Boolean(window.audio)'), 3000, 'fixture audio module');
}
async function live(key, timeout = 16000) {
  await until(() => session.evaluate(`audio.enabled && !audio.loading && audio.activeKey === ${JSON.stringify(key)} && !audio.tracks.get(${JSON.stringify(key)}).media.paused && audio.tracks.get(${JSON.stringify(key)}).media.currentTime > .05`), timeout, 'playing ' + key);
}
async function heldSwitch() {
  await session.click('#start');
  await until(() => pending().some(r => r.file.includes('day')), 3000, 'pending day HTTP');
  await session.click('#night');
  await until(() => pending().some(r => r.file.includes('night')), 3000, 'pending night HTTP');
  await sleep(350);
  return { dayCancelled: pending().filter(r => r.file.includes('day')).every(r => r.closedAt && !r.endedAt), ...(await state()) };
}
(async () => {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fixture = await startFixture();
  session = await newSession({ size: '960x600' });
  await session.call('Network.setCacheDisabled', { cacheDisabled: true });
  const oldSource = execFileSync('git', ['show', base + ':apps/liangxiang-cloudwalk/src/audio.js'], { encoding: 'utf8' });
  await page('hold', oldSource);
  const before = await heldSwitch();
  check('baseline reproduces two competing pending songs before either can play', !before.dayCancelled && before.players.filter(p => !p.paused && p.readyState === 0).length === 2, { pendingUnpaused: before.players.filter(p => !p.paused).length, oldRequestClosed: before.dayCancelled });
  await session.click('#dispose');

  await page('stream');
  await sleep(150);
  check('entry stays silent and downloads no recording before intent', pending().length === 0 && (await state()).contextState === 'idle');
  const startedAt = Date.now();
  await session.click('#start');
  await session.evaluate('tapOutput();true');
  await live('day');
  timings.coldStreamPlayingMs = Date.now() - startedAt;
  check('cold throttled play starts with an incomplete recording', !await session.evaluate('bufferComplete("day")'), { elapsedMs: timings.coldStreamPlayingMs, fullBytes: 743661, transferredBytes: pending().reduce((sum, r) => sum + r.bytes, 0) });
  await until(() => session.evaluate('hasOutput()'), 15000, 'non-silent real recording output');
  timings.coldStreamSignalMs = Date.now() - startedAt;
  check('real Opus produces nonzero master output before full buffering', !await session.evaluate('bufferComplete("day")'), { elapsedMs: timings.coldStreamSignalMs });
  await session.click('#dispose');

  await page('hold');
  const switched = await heldSwitch();
  check('switching an unready song aborts its actual HTTP request immediately', switched.dayCancelled && switched.players.find(p => p.key === 'day').paused);
  check('expected cancellation leaves the selected song loading without an error', switched.enabled && switched.loading && switched.track === 'night' && !switched.error && await session.evaluate('audioErrors.length === 0'));
  await session.click('#toggle');
  await until(() => pending().every(r => r.closedAt && !r.endedAt), 2000, 'mute cancels pending fetch');
  const muted = await state();
  check('mute before first sample cancels every pending download and playback', !muted.enabled && !muted.loading && muted.players.every(p => p.paused));
  const mutedRequestCount = fixture.requests.length;
  await session.click('#start');
  await sleep(150);
  check('explicit mute survives reentering the journey without new downloads', !(await state()).enabled && fixture.requests.length === mutedRequestCount);
  await session.evaluate('window.dayElement = audio.tracks.get("day").media;true');
  fixture.configure('instant');
  await session.click('#day');
  await session.click('#toggle');
  await live('day');
  check('reselecting a cancelled recording restores its URL and reuses its player', await session.evaluate('audio.tracks.get("day").media === dayElement && audio.tracks.size === 2 && !audio.error'));

  fixture.configure('delay');
  await session.click('#night');
  const fading = await state();
  check('already audible music continues while the next recording buffers', fading.loading && !fading.players.find(p => p.key === 'day').paused && fading.activeTrack === 'day');
  await live('night');
  await until(() => session.evaluate('audio.tracks.get("day").media.paused && audio.tracks.get("night").gain.gain.value > .99'), 5000, 'crossfade cleanup');
  check('crossfade ends on the selected song and pauses the outgoing one', true);
  fixture.configure('instant');
  await session.click('#morning');
  await live('dawn_dusk');
  await session.evaluate('window.sharedTime = audio.tracks.get("dawn_dusk").media.currentTime;true');
  const sharedRequests = fixture.requests.length;
  await session.click('#evening');
  check('morning and evening keep the shared recording without reloading', await session.evaluate('audio.tracks.get("dawn_dusk").media.currentTime >= sharedTime && audio.tracks.size === 3') && fixture.requests.length === sharedRequests);
  await session.evaluate('(() => { const m = audio.tracks.get("dawn_dusk").media;m.currentTime = m.duration - .2;return true; })()');
  await until(() => session.evaluate('(() => { const m = audio.tracks.get("dawn_dusk").media;return !m.paused && m.currentTime > .05 && m.currentTime < 3; })()'), 8000, 'native loop');
  check('the original real recording still loops at its end', true);
  await session.click('#dispose');

  await page('fail');
  await session.click('#start');
  await until(() => session.evaluate('Boolean(audio.error)'), 4000, 'recoverable media failure');
  check('network failure has an explicit error and resets loading', await session.evaluate('!audio.enabled && !audio.loading && audioErrors.length === 1'));
  fixture.configure('instant');
  await session.click('#toggle');
  await live('day');
  check('retry after a real failed response restores playback', !await session.evaluate('Boolean(audio.error)'));
  await session.click('#toggle');
  await until(() => session.evaluate('audio.tracks.get("day").media.paused'), 2000, 'mute previously audible track');
  fixture.configure('hold');
  await session.evaluate('audio.tracks.get("day").media.load();true');
  mark = fixture.requests.length;
  await session.click('#toggle');
  await until(() => pending().some(r => r.file.includes('day')), 3000, 'rebuffering prior active song');
  await session.click('#night');
  await until(() => pending().some(r => r.file.includes('night')), 3000, 'replacement for prior active song');
  await until(() => pending().filter(r => r.file.includes('day')).every(r => r.closedAt && !r.endedAt), 2000, 'cancel prior active but unready song');
  check('a previously audible but now unready song also releases its pending request', await session.evaluate('audio.tracks.get("day").media.paused && !audio.error'));
  await session.click('#dispose');

  await page('hold');
  await session.click('#start');
  await until(() => pending().length > 0, 3000, 'pending dispose request');
  await session.click('#dispose');
  await until(() => pending().every(r => r.closedAt && !r.endedAt), 2000, 'dispose abort');
  check('dispose aborts an unready request and closes its AudioContext', await session.evaluate('audio.tracks.size === 0 && audio.context.state === "closed"'));

  fixture.configure('instant');
  await session.call('Page.addScriptToEvaluateOnNewDocument', { source: `window.voxelTestMedia=[];const original=AudioContext.prototype.createMediaElementSource;AudioContext.prototype.createMediaElementSource=function(media){voxelTestMedia.push(media);return original.call(this,media);};` });
  await session.navigate(fixture.origin + '/voxel-campus/?time=day');
  await until(() => session.evaluate('document.querySelector("#startup")?.classList.contains("is-complete")'), 15000, 'production scene startup');
  check('production keeps development globals private', await session.evaluate('typeof window.campus === "undefined"'));
  await session.click('#start-button');
  await until(() => session.evaluate('voxelTestMedia.some(m => m.currentTime > .05 && !m.paused) && document.querySelector("#sound-button").getAttribute("aria-busy") === "false"'), 8000, 'production UI playback');
  check('real production UI plays its relative-path Opus asset', await session.evaluate('voxelTestMedia[0].currentSrc.startsWith(location.origin + "/voxel-campus/assets/") && voxelTestMedia[0].currentSrc.endsWith(".opus")'));
  await session.click('#time-button');
  await session.click('[data-time-mode="night"]');
  await until(() => session.evaluate('voxelTestMedia.some(m => m.currentSrc.includes("/night-") && m.currentTime > .05 && !m.paused)'), 8000, 'production night switch');
  check('production period control selects its night recording', await session.evaluate('document.querySelector("#sound-button").dataset.track === "night"'));
  check('no JavaScript exceptions in cold, failure, cancellation or production cases', !session.errors.some(e => e.startsWith('EXCEPTION:')), session.errors.filter(e => e.startsWith('EXCEPTION:')));

  const sha = text => createHash('sha256').update(text).digest('hex');
  fs.writeFileSync(reportPath, JSON.stringify({ ok: true, baseCommit: base, source: 'actual supplied Opus recordings with a local Range server; no production writes', environment: 'Owned headless Microsoft Edge, empty isolated profile, extensions disabled, cache disabled, 960x600; real Web Audio analyser', sourceSHA256: { before: sha(oldSource), after: sha(fs.readFileSync(path.join(__dirname, '../../apps/liangxiang-cloudwalk/src/audio.js'))) }, streamBytesPerSecond: Math.round(8192 / .15), timings, checks }, null, 2) + '\n', { flag: reportFlag });
  console.log(JSON.stringify({ ok: true, checks: checks.length, timings }));
})().catch(async error => {
  console.error(error.stack);
  try { fs.writeFileSync(failurePath, JSON.stringify({ ok: false, error: error.stack, checks, timings, errors: session?.errors }, null, 2) + '\n', { flag: reportFlag }); }
  catch (writeError) { console.error('Failure report could not be written:', writeError.message); }
  process.exitCode = 1;
}).finally(async () => { if (session) await session.close(); if (fixture) await fixture.close(); });
