import assert from 'node:assert/strict';
import { loadPlaywright, launchChromium } from './browser-tools.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, '.preview');
const target = process.env.CAMPUS_TEST_URL || 'http://127.0.0.1:58127/';
const playwright = loadPlaywright();
await mkdir(output, { recursive: true });
await writeFile(path.join(output, 'bgm-fixture.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><link rel="icon" href="data:,"></head><body>
<button id="start">Start</button><button id="toggle">Toggle</button>
<script type="module">
import { CampusAudio } from '/src/audio.js';
window.fixtureAudio = new CampusAudio({ onError: (message) => { window.fixtureLastError = message; } });
document.getElementById('start').onclick = () => window.fixtureAudio.start();
document.getElementById('toggle').onclick = () => window.fixtureAudio.toggle();
</script></body></html>`);

// Exercise the relative production asset paths under a non-root deployment.
const dist = path.join(root, 'dist');
const productionServer = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (!url.pathname.startsWith('/campus/')) { response.writeHead(404).end(); return; }
    const relative = decodeURIComponent(url.pathname.slice('/campus/'.length)) || 'index.html';
    const file = path.resolve(dist, relative);
    if (!file.startsWith(dist + path.sep)) { response.writeHead(403).end(); return; }
    const bytes = await readFile(file);
    const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.opus': 'audio/ogg', '.woff2': 'font/woff2' };
    const headers = { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Accept-Ranges': 'bytes' };
    const range = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Math.min(range[2] ? Number(range[2]) : bytes.length - 1, bytes.length - 1);
      if (start > end) { response.writeHead(416, { 'Content-Range': `bytes */${bytes.length}` }).end(); return; }
      response.writeHead(206, { ...headers, 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${bytes.length}` });
      response.end(bytes.subarray(start, end + 1));
    } else {
      response.writeHead(200, { ...headers, 'Content-Length': bytes.length });
      response.end(bytes);
    }
  } catch { response.writeHead(404).end(); }
});
await new Promise((resolve) => productionServer.listen(0, '127.0.0.1', resolve));
const productionURL = `http://127.0.0.1:${productionServer.address().port}/campus/`;
const browser = await launchChromium(playwright, {
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-extensions'],
});
const report = { checks: [], errors: [], periods: {} };
const check = (name, value) => { assert(value, name); report.checks.push(name); console.log(`PASS ${name}`); };
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', (error) => report.errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') report.errors.push(message.text()); });
const audioState = () => page.evaluate(() => window.campus.stats().audio);
const waitForTrack = async (key, settled = true) => page.waitForFunction(({ key, settled }) => {
  const state = window.campus?.stats().audio;
  if (!state?.enabled || state.loading || state.activeTrack !== key || state.error) return false;
  return !settled || state.players.every((player) => player.key === key
    ? !player.paused && player.readyState >= 2 && player.gain > 0.99
    : player.paused && player.gain < 0.001);
}, { key, settled }, { timeout: 30000 });
const selectTime = async (period) => {
  await page.locator('#time-button').click();
  await page.locator(`[data-time-mode="${period}"]`).click();
};

try {
  await page.goto(target + '?time=day');
  await page.waitForFunction(() => Boolean(window.campus), null, { timeout: 60000 });
  await page.locator('#startup').waitFor({ state: 'hidden' });
  const initial = await audioState();
  check('page entry is silent and downloads no BGM', !initial.enabled && initial.contextState === 'idle' && initial.players.length === 0);
  await page.locator('#start-button').click();
  await waitForTrack('day');
  const day = await audioState();
  check('Start plays the provided day recording', day.players[0].src.includes('/bgm/day.opus') && day.players[0].duration > 100 && day.players[0].currentTime > 0.2);
  check('the native loop and music button are enabled', day.players[0].loop && await page.locator('#sound-button').getAttribute('aria-pressed') === 'true');

  await selectTime('morning');
  await waitForTrack('dawn_dusk', false);
  await page.waitForTimeout(650);
  const fading = await audioState();
  check('period changes crossfade actual running players', fading.players.filter((player) => !player.paused && player.gain > 0.01 && player.gain < 0.99).length === 2);
  await waitForTrack('dawn_dusk');
  const morning = await audioState();
  const morningTime = morning.players.find((player) => player.key === 'dawn_dusk').currentTime;
  await selectTime('evening');
  await page.waitForTimeout(450);
  const evening = await audioState();
  check('morning and evening share a continuous recording', evening.activeTrack === 'dawn_dusk' && evening.players.find((player) => player.key === 'dawn_dusk').currentTime >= morningTime && evening.players.length === 2);
  check('music controls describe the current period', (await page.locator('#sound-button').getAttribute('aria-label')).includes('黄昏'));
  await selectTime('night');
  await waitForTrack('night');
  const night = await audioState();
  check('night plays the supplied recording and pauses old tracks', night.players.find((player) => player.key === 'night').src.includes('/bgm/night.opus') && night.players.length === 3);
  report.periods = { day, morning, evening, night };

  await page.keyboard.press('m');
  await page.waitForFunction(() => { const s = window.campus.stats().audio; return !s.enabled && s.players.every((p) => p.paused); });
  check('M fades out and pauses all players', (await audioState()).masterGain < 0.001);
  await selectTime('day');
  await page.locator('#home-button').click();
  await page.locator('#start-button').click();
  check('changing periods and starting again preserve explicit mute', !(await audioState()).enabled);
  await page.keyboard.press('m');
  await waitForTrack('day');
  await page.evaluate(() => {
    for (const period of ['night', 'morning', 'day', 'evening', 'night']) document.querySelector(`[data-time-mode="${period}"]`).click();
  });
  await waitForTrack('night');
  check('rapid changes settle on the final selection with only three players', (await audioState()).players.length === 3);
  await selectTime('auto');
  await page.waitForFunction(() => { const s = window.campus.stats(); return !s.audio.loading && s.audio.period === s.period; });
  check('automatic clock drives music and scenery together', (await audioState()).track === ({ morning: 'dawn_dusk', day: 'day', evening: 'dawn_dusk', night: 'night' })[await page.evaluate(() => window.campus.stats().period)]);

  // A small audio-only fixture checks actual waveform output and the end-of-file loop.
  await page.goto(new URL('.preview/bgm-fixture.html', target).href);
  await page.waitForFunction(() => Boolean(window.fixtureAudio));
  await page.locator('#start').click();
  await page.waitForFunction(() => window.fixtureAudio.enabled && !window.fixtureAudio.loading);
  await page.evaluate(() => {
    const player = window.fixtureAudio;
    window.audioTap = player.context.createAnalyser();
    window.audioTap.fftSize = 2048;
    player.master.connect(window.audioTap);
  });
  await page.waitForFunction(() => {
    const samples = new Float32Array(window.audioTap.fftSize);
    window.audioTap.getFloatTimeDomainData(samples);
    return samples.some((sample) => Math.abs(sample) > 0.0001);
  }, null, { timeout: 15000 });
  check('the supplied Opus recording produces non-silent Web Audio output', true);
  await page.evaluate(() => { const media = window.fixtureAudio.tracks.get('day').media; media.currentTime = media.duration - 0.25; });
  await page.waitForFunction(() => { const media = window.fixtureAudio.tracks.get('day').media; return !media.paused && media.currentTime > 0.1 && media.currentTime < 3; }, null, { timeout: 10000 });
  check('the actual recording loops at end of file', true);
  await page.evaluate(() => window.fixtureAudio.dispose());
  check('disposing the player releases its tracks', await page.evaluate(() => window.fixtureAudio.tracks.size === 0 && !window.fixtureAudio.enabled));

  // Native media failures must be recoverable with the music button.
  const recovery = await browser.newPage();
  recovery.on('pageerror', (error) => report.errors.push(error.message));
  await recovery.route('**/bgm/day.opus', (route) => route.abort());
  await recovery.goto(new URL('.preview/bgm-fixture.html', target).href);
  await recovery.waitForFunction(() => Boolean(window.fixtureAudio));
  await recovery.locator('#start').click();
  await recovery.waitForFunction(() => Boolean(window.fixtureLastError));
  check('a missing BGM shows a recoverable error and resets the music state', await recovery.evaluate(() => !window.fixtureAudio.enabled && !window.fixtureAudio.loading));
  await recovery.unroute('**/bgm/day.opus');
  await recovery.locator('#toggle').click();
  await recovery.waitForFunction(() => window.fixtureAudio.enabled && !window.fixtureAudio.loading && !window.fixtureAudio.error, null, { timeout: 15000 });
  check('retry reloads a failed recording successfully', true);
  await recovery.close();

  await page.goto(productionURL + '?time=morning');
  await page.waitForFunction(() => Boolean(window.campus), null, { timeout: 60000 });
  await page.locator('#startup').waitFor({ state: 'hidden' });
  await page.locator('#start-button').click();
  for (const [period, key] of [['morning', 'dawn_dusk'], ['night', 'night'], ['day', 'day']]) {
    if (period !== 'morning') await selectTime(period);
    await waitForTrack(key);
    const state = await audioState();
    const track = state.players.find((player) => player.key === key);
    check(`production ${period} BGM works under a relative deployment path`, track.src.startsWith(productionURL + 'assets/') && track.src.endsWith('.opus'));
  }
  check('no unexpected browser runtime or resource errors', report.errors.length === 0);
  await writeFile(path.join(output, 'bgm-verification.json'), JSON.stringify(report, null, 2));
  console.log(`BGM verification passed: ${report.checks.length} checks.`);
} catch (error) {
  report.failed = error.message;
  await writeFile(path.join(output, 'bgm-verification.json'), JSON.stringify(report, null, 2));
  throw error;
} finally {
  await browser.close();
  await new Promise((resolve) => productionServer.close(resolve));
}
