import assert from 'node:assert/strict';
import { loadPlaywright, launchChromium } from './browser-tools.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getPeriod } from '../src/atmosphere.js';
import { roadFormation } from '../src/road.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const playwright = loadPlaywright();
const target = process.env.CAMPUS_TEST_URL || 'http://127.0.0.1:58127/';
const output = path.join(root, '.preview');
await mkdir(output, { recursive: true });
const browser = await launchChromium(playwright, {
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-extensions'],
});
const errors = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 1 });
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
const report = { checks: [], errors };
const check = (name, value) => { assert(value, name); report.checks.push(name); };
try {
  const response = await page.goto(target + '?time=day', { waitUntil: 'networkidle', timeout: 60000 });
  check('page responds successfully', response.ok());
  await page.waitForFunction(() => Boolean(window.campus), null, { timeout: 60000 });
  await page.locator('#startup').waitFor({ state: 'hidden' });
  await page.locator('#pause-button').click();
  await page.screenshot({ path: path.join(output, 'desktop.png') });
  report.initial = await page.evaluate(() => window.campus.stats());
  check('WebGL draws the world', report.initial.drawCalls > 20 && report.initial.triangles > 30000);
  check('all islands and fixed road rows exist', report.initial.islandCount === 8 && report.initial.roadRows === 92);
  check('camera is close to the road', report.initial.cameraHeight < 2.8 && report.initial.cameraHeight > 2.2);
  check('nearby road is actively assembling', report.initial.formingRows > 8 && report.initial.farVisibleDistance <= 115);
  for (const [hour, period] of [[0,'night'],[5.999,'night'],[6,'morning'],[8.999,'morning'],[9,'day'],[16.999,'day'],[17,'evening'],[18.999,'evening'],[19,'night'],[23.999,'night'],[24,'night']]) {
    check(`exact period boundary ${hour}`, getPeriod(hour) === period);
  }
  const pausedDistance = report.initial.distance;
  await page.waitForTimeout(450);
  check('pause stops travel', Math.abs((await page.evaluate(() => window.campus.stats().distance)) - pausedDistance) < 0.01);
  await page.locator('#start-button').click();
  await page.waitForFunction(() => window.campus.stats().distance > 4);
  check('start activates the journey', await page.locator('body').evaluate((el) => el.classList.contains('journey-active')));
  await page.waitForFunction(() => window.campus.stats().audio.enabled && !window.campus.stats().audio.loading);
  check('start plays the current period BGM after a gesture', await page.locator('#sound-button').getAttribute('aria-pressed') === 'true');
  await page.locator('[data-speed="1.6"]').click();
  check('speed control updates travel speed', (await page.evaluate(() => window.campus.stats())).speed === 1.6);
  await page.locator('#sound-button').click();
  check('audio switches off', await page.locator('#sound-button').getAttribute('aria-pressed') === 'false');
  await page.locator('#sound-button').click();
  check('audio switches on after gesture', await page.locator('#sound-button').getAttribute('aria-pressed') === 'true');
  await page.locator('#sound-button').click();
  check('audio switches off', await page.locator('#sound-button').getAttribute('aria-pressed') === 'false');
  await page.locator('#info-button').click();
  check('information dialog opens', await page.locator('#about-dialog').evaluate((el) => el.open));
  check('all four research sources linked', await page.locator('#source-links a').count() === 4);
  await page.locator('#close-info-button').click();
  await page.locator('#fullscreen-button').click();
  check('fullscreen control enters fullscreen', await page.evaluate(() => Boolean(document.fullscreenElement)));
  await page.locator('#fullscreen-button').click();
  await page.locator('#scene').click({ position: { x: 800, y: 450 } });
  await page.keyboard.press('h');
  check('hide interface shortcut works', await page.locator('body').evaluate((el) => el.classList.contains('ui-hidden')));
  await page.keyboard.press('h');
  for (const index of [1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0]) {
    await page.locator(`[data-landmark="${index}"]`).click();
    await page.waitForTimeout(100);
  }
  report.afterLoop = await page.evaluate(() => window.campus.stats());
  check('scene continues beyond first full world cycle', report.afterLoop.distance > 700);
  check('cycling does not allocate additional GPU assets', report.afterLoop.geometries === report.initial.geometries && report.afterLoop.textures === report.initial.textures);
  await page.locator('#pause-button').click();
  await page.screenshot({ path: path.join(output, 'journey.png') });
  report.periods = {};
  for (const mode of ['morning', 'evening', 'night', 'day']) {
    await page.locator('#time-button').click();
    await page.locator(`[data-time-mode="${mode}"]`).click();
    await page.waitForFunction((mode) => window.campus.stats().period === mode && window.campus.stats().transitionError < 0.015, mode, {timeout:60000});
    report.periods[mode] = await page.evaluate(() => window.campus.stats());
    check(`time selector switches to ${mode}`, await page.locator('body').getAttribute('data-period') === mode);
    await page.screenshot({ path: path.join(output, `time-${mode}.png`) });
  }
  check('night moonlight enabled', report.periods.night.nightFactor > 0.98);
  check('strong morning shafts enabled', report.periods.morning.rayStrength > report.periods.day.rayStrength * 3);
  check('time switches do not grow GPU resources', Object.values(report.periods).every((s) => s.geometries === report.periods.morning.geometries && s.textures === report.periods.morning.textures));
  await page.locator('#time-button').click();
  await page.locator('[data-time-mode="auto"]').click();
  check('automatic time mode restores the real clock', (await page.evaluate(() => window.campus.stats())).timeMode === 'auto');
  for (const index of [1, 2, 3]) {
    await page.locator(`[data-landmark="${index}"]`).click();
    await page.locator('#pause-button').click();
    await page.waitForTimeout(450);
    await page.screenshot({ path: path.join(output, `landmark-${index}.png`) });
  }
  await page.setViewportSize({ width: 844, height: 390 });
  check('small landscape stays within the viewport', await page.evaluate(() => document.documentElement.scrollWidth === innerWidth));
  await page.screenshot({ path: path.join(output, 'mobile-landscape.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  check('portrait displays rotation notice', await page.locator('.portrait-notice').isVisible());
  check('portrait hides the 3D canvas', !(await page.locator('#scene').isVisible()));
  await page.screenshot({ path: path.join(output, 'portrait.png') });
  await writeFile(path.join(output, 'verification.json'), JSON.stringify(report, null, 2));
  check('no browser runtime errors', errors.length === 0);
  await writeFile(path.join(output, 'verification.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.log(JSON.stringify({ failed: error.message, errors, pageText: await page.locator('body').innerText() }, null, 2));
  await page.screenshot({ path: path.join(output, 'failure.png') });
  throw error;
} finally { await browser.close(); }
