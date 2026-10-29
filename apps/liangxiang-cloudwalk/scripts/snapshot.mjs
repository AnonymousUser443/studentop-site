import assert from 'node:assert/strict';
import { loadPlaywright, launchChromium } from './browser-tools.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { roadFormation } from '../src/road.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const playwright = loadPlaywright();
for (let row = 0; row < 10; row++) {
  for (let column = -2; column <= 2; column++) {
    assert.equal(roadFormation(18, column, row).lift, 0);
    assert.equal(roadFormation(63, column, row).visible, false);
    let previousLift = -Infinity;
    for (let d = 61; d >= 19; d--) {
      const f = roadFormation(d, column, row);
      assert(f.lift <= 0 && f.lift >= -8);
      assert(f.lift >= previousLift, 'slabs rise monotonically from below');
      assert.equal(f.offsetX, 0);
      assert.equal(f.offsetZ, 0);
      assert.equal(f.tiltX, 0);
      assert.equal(f.tiltZ, 0);
      previousLift = f.lift;
    }
  }
}
const output = path.join(root, '.preview');
await mkdir(output, { recursive: true });
const browser = await launchChromium(playwright, { headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-extensions'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (e) => { if (e.type() === 'error') errors.push(e.text()); });
const report = { errors, modes: {} };
const selectedModes = process.argv.slice(2).filter((mode) => ['day', 'morning', 'evening', 'night'].includes(mode));
try {
  for (const mode of selectedModes.length ? selectedModes : ['day', 'morning', 'evening', 'night']) {
    await page.goto(`http://127.0.0.1:58127/?time=${mode}`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForFunction(() => Boolean(window.campus), null, { timeout: 60000 });
    await page.locator('#startup').waitFor({ state: 'hidden' });
    await page.locator('#start-button').click();
    await page.locator('#pause-button').click();
    await page.screenshot({ path: path.join(output, `time-${mode}.png`), animations: 'disabled' });
    report.modes[mode] = await page.evaluate(() => window.campus.stats());
    assert.equal(report.modes[mode].period, mode);
    assert(report.modes[mode].formingRows >= 10);
    assert(report.modes[mode].drawCalls > 50);
    assert(report.modes[mode].transitionError < 1e-8);
    console.log(`${mode}: rendered, camera ${report.modes[mode].cameraHeight.toFixed(2)}, ${report.modes[mode].formingRows} assembling rows`);
    if (mode === 'day') {
      await page.locator('#pause-button').click();
      await page.waitForFunction(() => window.campus.stats().distance > 8);
      await page.locator('#pause-button').click();
      await page.screenshot({ path: path.join(output, 'road-after-motion.png'), animations: 'disabled' });
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, selectedModes.length ? 'vertical-visuals.json' : 'final-visuals.json'), JSON.stringify(report, null, 2));
  console.log('Final shader compilation and vertical road motion checks passed.');
} finally { await browser.close(); }
