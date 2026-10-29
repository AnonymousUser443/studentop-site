import assert from 'node:assert/strict';
import { loadPlaywright, launchChromium } from './browser-tools.mjs';
import * as THREE from 'three';
import { VoxelPortal } from '../src/portal.js';
import { EndlessRoad } from '../src/road.js';

const road = new EndlessRoad(new THREE.Scene());
const portal = new VoxelPortal();
portal.userData.anchor = 218;
const start = road.supportReadyAt(218, 1.8);
portal.updateConstruction(start - 0.01, road);
assert.equal(portal.visible, false);
assert.equal(portal.constructionStats().visibleVoxels, 0);
assert.equal(portal.diamond.visible, false);
assert.equal(road.hasSettledSupport(218, 1.8, start - 0.01), false);
assert(portal.bricks.every((b) => b.width <= 0.62 && b.height <= 0.62 && b.depth <= 0.62));

let lastHeight = -Infinity;
let lastComplete = 0;
let leftFlights = 0;
let rightFlights = 0;
const matrix = new THREE.Matrix4();
for (let step = 1; step <= 20; step++) {
  const travel = start + 12 * step / 20;
  portal.updateConstruction(travel, road, 0);
  const state = portal.constructionStats();
  assert.equal(state.supported, true);
  assert(state.builtHeight >= lastHeight);
  assert(state.completedVoxels >= lastComplete);
  for (let i = 0; i < portal.bricks.length; i++) {
    const b = portal.bricks[i];
    portal.voxels.getMatrixAt(i, matrix);
    if (matrix.elements[0] === 0) continue;
    const offset = matrix.elements[12] - b.x;
    if (offset < -0.01) leftFlights++;
    if (offset > 0.01) rightFlights++;
    if (Math.abs(b.x) > 0.01) assert(offset * Math.sign(b.x) >= -1e-5);
    assert(Math.abs(matrix.elements[14] - b.z) < 1e-5);
    assert(matrix.elements[13] <= b.y + 1e-5);
    if (step === 20) {
      assert(Math.abs(offset) < 1e-5);
      assert(Math.abs(matrix.elements[13] - b.y) < 1e-5);
      assert(Math.abs(matrix.elements[1]) < 1e-5);
      assert(Math.abs(matrix.elements[2]) < 1e-5);
    }
  }
  if (step <= 10) {
    assert.equal(portal.diamond.visible, false);
  }
  lastHeight = state.builtHeight;
  lastComplete = state.completedVoxels;
}
assert.equal(portal.constructionStats().completedVoxels, portal.bricks.length);
assert.equal(portal.diamond.visible, true);
assert(leftFlights > 100 && rightFlights > 100);
assert.equal(portal.constructionStats().flyingVoxels, 0);

portal.updateConstruction(start + 3, road, 0);
const paused = Array.from(portal.voxels.instanceMatrix.array);
portal.updateConstruction(start + 3, road, 0);
assert.deepEqual(Array.from(portal.voxels.instanceMatrix.array), paused);
portal.userData.anchor += 705;
portal.updateConstruction(start + 3, road);
assert.equal(portal.visible, false);
assert.equal(portal.constructionStats().completedVoxels, 0);
portal.updateConstruction(road.supportReadyAt(portal.userData.anchor, 1.8) + 13, road);
assert.equal(portal.constructionStats().completedVoxels, portal.bricks.length);
console.log('Crossing support, flights from both sides, exact assembly, pause, recycling and jumps passed.');
portal.dispose(); road.dispose();

if (!process.argv.includes('--browser')) process.exit(0);
const { writeFile } = await import('node:fs/promises');
const { fileURLToPath } = await import('node:url');
const playwright = loadPlaywright();
const browser = await launchChromium(playwright, { headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-extensions'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
const states = [];
try {
  await page.goto('http://127.0.0.1:58127/.preview/portal-fixture.html', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.fixtureWorld));
  for (const [name, offset] of [['before', -1], ['base', 2], ['pillars', 6], ['complete', 12.1]]) {
    await page.evaluate((offset) => {
      const w = window.fixtureWorld;
      w.travel = w.road.supportReadyAt(w.portals[0].userData.anchor, 1.8) + offset;
    }, offset);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const state = await page.evaluate(() => window.fixtureWorld.stats());
    states.push({ name, ...state });
    await page.screenshot({ path: fileURLToPath(new URL(`../.preview/portal-${name}.png`, import.meta.url)), animations: 'disabled' });
    const p = state.portals[0];
    assert.equal(p.supported, offset >= 0);
    if (offset < 0) assert.equal(p.visibleVoxels, 0);
    if (name === 'pillars') assert(p.flyingVoxels > 0);
    if (name === 'complete') assert.equal(p.completedVoxels, p.totalVoxels);
    console.log(`${name}: ${p.completedVoxels}/${p.totalVoxels} voxels complete`);
  }
  assert.deepEqual(errors, []);
  await writeFile(new URL('../.preview/portal-verification.json', import.meta.url), JSON.stringify({ errors, states }, null, 2));
  console.log('Browser crossing construction sequence passed.');
} finally { await browser.close(); }
