import assert from 'node:assert/strict';
import { loadPlaywright, launchChromium } from './browser-tools.mjs';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { LANDMARKS } from '../src/landmarks.js';

const playwright = loadPlaywright();
const browser = await launchChromium(playwright, { headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-extensions'] });
const page = await browser.newPage({ viewport:{width:1200,height:900},deviceScaleFactor:1 });
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const report={errors,assets:[],navigation:[]};
try {
  await page.goto('http://127.0.0.1:58127/.preview/assets-fixture.html',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.assetReady);
  for(const id of ['gate','round','wing','heritage','motto']) {
    const asset=await page.evaluate(id=>window.showAsset(id),id);
    assert(asset.voxels>500);
    assert(asset.min.every(Number.isFinite)&&asset.max.every(Number.isFinite));
    assert(asset.min[0]>=-17.6&&asset.max[0]<=17.6);
    assert(asset.min[2]>=-12.6&&asset.max[2]<=12.6);
    assert(asset.max[1]<19);
    report.assets.push(asset);
    await page.screenshot({path:fileURLToPath(new URL(`../.preview/asset-${id}.png`,import.meta.url))});
    console.log(`${id}: ${asset.voxels} cubes, footprint checked`);
  }
  await page.goto('http://127.0.0.1:58127/?time=day',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.campus,null,{timeout:60000});
  await page.locator('#startup').waitFor({state:'hidden'});
  assert.equal(await page.locator('[data-landmark]').count(),LANDMARKS.length);
  const initial=await page.evaluate(()=>window.campus.stats());
  assert.equal(initial.islandCount,8);
  assert.deepEqual(new Set(initial.landmarks.map(l=>l.id)),new Set(LANDMARKS.map(l=>l.id)));
  for(const landmark of LANDMARKS) {
    await page.locator(`[data-landmark-id="${landmark.id}"]`).click();
    await page.waitForFunction(title=>document.getElementById('landmark-title').textContent===title,landmark.title);
    report.navigation.push(landmark.id);
    await page.locator('#pause-button').click();
  }
  await page.setViewportSize({width:844,height:390});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth));
  assert.equal(await page.locator('[data-landmark]').count(),8);
  await page.screenshot({path:fileURLToPath(new URL('../.preview/eight-landmarks-landscape.png',import.meta.url)),animations:'disabled'});
  const after=await page.evaluate(()=>window.campus.stats());
  assert.equal(after.islandCount,initial.islandCount);
  assert.equal(after.totalInstances,initial.totalInstances);
  report.final=after;
  assert.deepEqual(errors,[]);
  await writeFile(new URL('../.preview/assets-verification.json',import.meta.url),JSON.stringify(report,null,2));
  console.log('Five photo assets, eight landmark controls and landscape integration passed.');
} catch(error) {
  console.log(JSON.stringify({error:error.message,errors},null,2));
  await page.screenshot({path:fileURLToPath(new URL('../.preview/assets-failure.png',import.meta.url))});
  throw error;
} finally {await browser.close();}
