// Tests the production build through request interception, with no local server
// or tunnel. Playwright locations below are simulated, never a field GPS test.
import { createRequire } from 'node:module';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createCampusMap } from '../src/location/vendor/coordinates.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const dist = resolve(root, 'dist');
const out = resolve(root, 'qa/location');
mkdirSync(out, { recursive:true });
const metadata = JSON.parse(readFileSync(resolve(root,'src/location/data/map.json')));
const artifact = JSON.parse(readFileSync(resolve(root,'src/location/data/selected_model.json')));
const map = createCampusMap(metadata, artifact);
const gps = map.uvToGeo(.34,.49);
const nextGps = map.uvToGeo(.35,.50);
const checks = [];
const consoleErrors = [];
let activePage;
const check = (name, value) => { assert.ok(value,name);checks.push(name); };
const browser = await chromium.launch({ channel:'msedge',headless:true });
const mime = { '.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2','.mp3':'audio/mpeg' };

async function open(viewport={width:1440,height:900}, mocked=false, secure=true, legacy=true) {
  const context = await browser.newContext({ viewport, reducedMotion:'reduce',
    ...(mocked ? {} : { geolocation:{latitude:gps.latitude,longitude:gps.longitude,accuracy:5},permissions:['geolocation'] }) });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname !== 'campus-location.test') return route.abort();
    const path = resolve(dist, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!path.startsWith(dist+sep) || !existsSync(path)) return route.fulfill({status:404,body:'Not found'});
    return route.fulfill({path,contentType:mime[extname(path)] || 'application/octet-stream'});
  });
  await context.addInitScript(({mocked,secure,legacy}) => {
    if(legacy) localStorage.setItem('liyun.exploration.v1',JSON.stringify({version:1,discoveredIds:['wencui'],playerUV:{u:.9,v:.9},settings:{music:false,reducedMotion:true,quality:'low'}}));
    HTMLMediaElement.prototype.play = async function() {};
    if (!secure) Object.defineProperty(window,'isSecureContext',{value:false});
    if (mocked) {
      const test = { callbacks:[],clears:[],time:0, hidden:false,permissionCalls:0,permission:'granted',angle:0,order:[],activations:[],deferPermission:false,resolvePermission:null };
      const now = Date.now;
      Date.now = () => now() + test.time;
      Object.defineProperty(navigator,'geolocation',{value:{
        watchPosition(success,error,options) { test.order.push('gps');test.callbacks.push({success,error,options});return test.callbacks.length-1; },
        clearWatch(id) {test.clears.push(id);},
      }});
      Object.defineProperty(document,'hidden',{configurable:true,get:()=>test.hidden});
      Object.defineProperty(screen.orientation,'angle',{configurable:true,get:()=>test.angle});
      function MockOrientationEvent() {}
      MockOrientationEvent.requestPermission = absolute => {
        test.order.push('heading');test.permissionCalls++;test.activations.push(navigator.userActivation.isActive);
        test.absoluteRequested=absolute;
        return test.deferPermission ? new Promise(resolve=>{test.resolvePermission=resolve;}) : Promise.resolve(test.permission);
      };
      Object.defineProperty(window,'DeviceOrientationEvent',{value:MockOrientationEvent,configurable:true});
      window.__gpsTest = test;
    }
  },{mocked,secure,legacy});
  const page = await context.newPage();
  activePage = page;
  page.on('pageerror',error=>consoleErrors.push(error.message));
  await page.goto('https://campus-location.test/',{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'进入校园',exact:true}).click();
  return {context,page};
}
const marker = page => page.getByTestId('real-location-marker');
async function uv(page) {
  return marker(page).evaluate(element=>({u:Number(element.dataset.u),v:Number(element.dataset.v)}));
}
async function emit(page,gps,accuracy=5,index) {
  await page.evaluate(({gps,accuracy,index})=>{
    const t=window.__gpsTest,c=t.callbacks[index ?? t.callbacks.length-1];
    c.success({timestamp:Date.now(),coords:{latitude:gps.latitude,longitude:gps.longitude,accuracy}});
  },{gps,accuracy,index});
}
async function stateIs(page,status) { await page.waitForFunction(status=>document.querySelector('.location-controls')?.getAttribute('data-status')===status,status); }
async function headingIs(page,status) { await page.waitForFunction(status=>document.querySelector('.location-controls')?.getAttribute('data-heading-status')===status,status); }
async function emitHeading(page,bearing=35,accuracy=5) {
  await page.evaluate(({bearing,accuracy})=>window.dispatchEvent(Object.assign(new Event('deviceorientation'),{webkitCompassHeading:bearing,webkitCompassAccuracy:accuracy,beta:0,gamma:0})),{bearing,accuracy});
}
const sector = page=>page.getByTestId('heading-sector');
const checkInButton = page=>page.getByTestId('check-in-button');
async function selectPlace(page,name) {
  await page.locator('.utility-nav button').filter({hasText:'收集图鉴'}).click();
  await page.locator('.collection-item').filter({hasText:name}).click();
}
async function checkInReason(page,reason) { await page.waitForFunction(reason=>document.querySelector('[data-testid=check-in-status]')?.getAttribute('data-reason')===reason,reason); }

try {
  const {page,context} = await open();
  check('No fake/persisted player marker before GPS authorization',await marker(page).count()===0);
  check('Legacy auto-completed Wencui migrates to zero initial progress',await page.getByTestId('game-stage').getAttribute('data-progress')==='0');
  check('Migrated save has no discovered or unlocked points',await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('liyun.exploration.v2'));return s.version===2 && s.discoveredIds.length===0 && s.unlockedRegionIds.length===0;}));
  check('Legacy data and audio settings survive migration',await page.evaluate(()=>JSON.parse(localStorage.getItem('liyun.exploration.v1')).discoveredIds[0]==='wencui' && JSON.parse(localStorage.getItem('liyun.exploration.v2')).settings.music===false));
  check('Uses exact calibrated full-canvas map',await page.locator('.map-base-image').getAttribute('src')==='/assets/maps/calibrated/campus_no_labels.webp');
  await page.getByRole('button',{name:'定位到我',exact:true}).click();
  await stateIs(page,'tracking');
  let value=await uv(page);
  check('Native browser geolocation maps simulated WGS84 onto calibrated UV',Math.hypot(value.u-.34,value.v-.49)<1e-7);
  const bounds=await marker(page).boundingBox();
  check('Follow centres real position inside viewport',bounds && bounds.x>0 && bounds.x<1440 && bounds.y>0 && bounds.y<900);
  await context.setGeolocation({latitude:nextGps.latitude,longitude:nextGps.longitude,accuracy:5});
  await page.waitForFunction(()=>Math.abs(Number(document.querySelector('[data-testid=real-location-marker]')?.getAttribute('data-u'))-.35)<1e-7);
  check('Walking updates native geolocation marker',true);
  await page.mouse.move(740,450);await page.mouse.down();await page.mouse.move(800,500,{steps:4});await page.mouse.up();
  check('Panning preserves GPS coordinates',Math.abs((await uv(page)).u-.35)<1e-7);
  await selectPlace(page,'北湖');await checkInReason(page,'out-of-range');
  check('Far-away landmark cannot be completed by clicking',await checkInButton(page).isDisabled());
  await checkInButton(page).evaluate(button=>button.click());
  check('Blocked click leaves progress unchanged',await page.evaluate(()=>JSON.parse(localStorage.getItem('liyun.exploration.v2')).discoveredIds.length===0));
  await page.screenshot({path:resolve(out,'desktop-check-in-too-far.png')});
  const beihu=map.uvToGeo(358/1000.56,459/1240.28003);
  const nearBeihu={latitude:beihu.latitude+20/6378137*180/Math.PI,longitude:beihu.longitude,accuracy:5};
  await context.setGeolocation(nearBeihu);await checkInReason(page,'ready');
  check('Arrival enables confirmation in the open landmark dialog',await checkInButton(page).isEnabled());
  await checkInButton(page).click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('liyun.exploration.v2')).discoveredIds.includes('beihu'));
  const nearUV=map.gpsToMap(nearBeihu.latitude,nearBeihu.longitude);
  value=await uv(page);
  check('Successful range-checked animation never teleports the real GPS marker',Math.hypot(value.u-nearUV.u,value.v-nearUV.v)<1e-7);
  check('Live GPS is not persisted as a user position',!(await page.evaluate(()=>localStorage.getItem('liyun.exploration.v2'))).includes(String(nearBeihu.latitude)));
  await page.getByRole('button',{name:'停止定位',exact:true}).click();await stateIs(page,'stopped');
  check('Stop removes the live marker',await marker(page).count()===0);
  await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:'进入校园',exact:true}).click();
  check('Reload preserves a validated check-in without adding Wencui',await page.evaluate(()=>JSON.stringify(JSON.parse(localStorage.getItem('liyun.exploration.v2')).discoveredIds)==='["beihu"]'));
  check('Reload does not reuse saved GPS as a fresh fix',await marker(page).count()===0);
  await context.close();

  const arrival=await open({width:844,height:390},true,true,false);
  const a=arrival.page;
  check('A brand-new browser starts with all points unvisited',await a.getByTestId('game-stage').getAttribute('data-progress')==='0');
  await selectPlace(a,'文萃楼');await checkInReason(a,'no-location');
  check('Wencui also requires GPS before check-in',await checkInButton(a).isDisabled());
  await a.getByRole('button',{name:'定位并显示朝向',exact:true}).click();
  const wencui=map.uvToGeo(535/1000.56,584/1240.28003);
  await emit(a,{...wencui,latitude:wencui.latitude+60/6378137*180/Math.PI});await checkInReason(a,'out-of-range');
  check('Wencui at 60 metres fails its 45 metre range',await checkInButton(a).isDisabled());
  await emit(a,wencui,80);await checkInReason(a,'poor-accuracy');
  check('Even at the target, poor GPS cannot complete check-in',await checkInButton(a).isDisabled());
  await emit(a,wencui,5);await checkInReason(a,'ready');
  await checkInButton(a).scrollIntoViewIfNeeded();
  const confirmBox=await checkInButton(a).boundingBox();
  check('Mobile arrival confirmation remains visible in the scrollable dialog',confirmBox && confirmBox.y>=0 && confirmBox.y+confirmBox.height<=390);
  await a.screenshot({path:resolve(out,'mobile-check-in-ready.png')});
  // Expire the fix and click in the same task, before the freshness timer can
  // repaint the button. The mutation itself must still reject the stale fix.
  await a.evaluate(()=>{window.__gpsTest.time+=15001;document.querySelector('[data-testid=check-in-button]').click();});
  check('Mutation rejects a stale fix even while its button was previously enabled',await a.evaluate(()=>JSON.parse(localStorage.getItem('liyun.exploration.v2')).discoveredIds.length===0));
  await checkInReason(a,'stale');
  await emit(a,wencui,5);await checkInReason(a,'ready');await checkInButton(a).click();
  await a.waitForFunction(()=>JSON.parse(localStorage.getItem('liyun.exploration.v2')).discoveredIds.includes('wencui'));
  check('Wencui is completed only after an actual arrival confirmation',await a.getByTestId('game-stage').getAttribute('data-progress')==='3');
  await a.locator('.utility-nav button').filter({hasText:'设置'}).click();
  await a.getByRole('button',{name:'重置探索进度',exact:true}).click();
  await a.getByRole('button',{name:'确认重新出发',exact:true}).click();
  check('Reset also returns to zero rather than auto-unlocking Wencui',await a.getByTestId('game-stage').getAttribute('data-progress')==='0');
  await arrival.context.close();

  const mobile = await open({width:844,height:390},true);
  check('Mobile does not request GPS until tapped',await mobile.page.evaluate(()=>window.__gpsTest.callbacks.length)===0);
  check('Heading permission is not requested before locate click',await mobile.page.evaluate(()=>window.__gpsTest.permissionCalls)===0);
  await mobile.page.getByRole('button',{name:'定位到我',exact:true}).click();
  await emit(mobile.page,gps);await stateIs(mobile.page,'tracking');
  await emitHeading(mobile.page);await headingIs(mobile.page,'active');
  check('One locate click starts both GPS and absolute orientation',await mobile.page.evaluate(()=>window.__gpsTest.permissionCalls===1 && window.__gpsTest.callbacks.length===1 && window.__gpsTest.absoluteRequested===true));
  check('Direction request runs inside the user gesture before GPS',await mobile.page.evaluate(()=>window.__gpsTest.order[0]==='heading' && window.__gpsTest.order[1]==='gps' && window.__gpsTest.activations[0]));
  check('Valid GPS and compass display a heading sector',await sector(mobile.page).count()===1);
  const firstAngle=Number(await sector(mobile.page).getAttribute('data-angle'));
  await mobile.page.evaluate(()=>{window.__gpsTest.angle=90;window.dispatchEvent(new Event('orientationchange'));});
  await mobile.page.waitForFunction(angle=>Math.abs(Number(document.querySelector('[data-testid=heading-sector]')?.getAttribute('data-angle'))-angle)>30,firstAngle);
  check('Landscape orientation updates heading without another permission request',await mobile.page.evaluate(()=>window.__gpsTest.permissionCalls)===1);
  await mobile.page.locator('.location-primary').click();
  check('Recentring does not duplicate GPS or direction requests',await mobile.page.evaluate(()=>window.__gpsTest.permissionCalls===1 && window.__gpsTest.callbacks.length===1));
  const buttonBox=await mobile.page.locator('.location-primary').boundingBox();
  check('Mobile landscape locate button is visible and touch-sized',buttonBox && buttonBox.x>=0 && buttonBox.x+buttonBox.width<=844 && buttonBox.height>=34);
  await mobile.page.screenshot({path:resolve(out,'mobile-simulated-gps.png')});
  await mobile.page.screenshot({path:resolve(out,'mobile-simulated-heading.png')});
  const positionBox=await marker(mobile.page).boundingBox();
  if(positionBox) await mobile.page.screenshot({path:resolve(out,'location-pointer-detail.png'),clip:{x:Math.max(0,positionBox.x-65),y:Math.max(0,positionBox.y-65),width:230,height:140}});
  await emitHeading(mobile.page,35,80);await headingIs(mobile.page,'calibrating');
  check('Unreliable compass hides sector but preserves location',await sector(mobile.page).count()===0 && await marker(mobile.page).count()===1);
  await emitHeading(mobile.page);await headingIs(mobile.page,'active');
  await mobile.page.evaluate(()=>{window.__gpsTest.time+=3501;});await headingIs(mobile.page,'stale');
  check('Stale compass hides sector while fresh GPS remains',await sector(mobile.page).count()===0 && await marker(mobile.page).count()===1);
  await emitHeading(mobile.page);await headingIs(mobile.page,'active');
  await emit(mobile.page,gps,150);
  check('Poor accuracy is explicitly distinguished',await mobile.page.locator('.location-controls').innerText().then(text=>text.includes('精度较低')));
  check('Low GPS accuracy hides the heading sector',await sector(mobile.page).count()===0);
  const outside=map.uvToGeo(-.1,.4);await emit(mobile.page,outside);
  await mobile.page.waitForFunction(()=>document.querySelector('.location-controls').textContent.includes('画布之外'));
  check('Off-map GPS is not snapped to campus',await marker(mobile.page).count()===0);
  await emit(mobile.page,gps);
  await mobile.page.evaluate(()=>{window.__gpsTest.time+=16000;});await stateIs(mobile.page,'stale');
  check('Stale fix clearly marked as last position',await mobile.page.locator('.map-location-label').innerText()==='上次位置');
  await emitHeading(mobile.page);await headingIs(mobile.page,'active');
  check('Fresh heading cannot make a stale position look reliable',await sector(mobile.page).count()===0);
  await mobile.page.getByRole('button',{name:'定位到我',exact:true}).click();await emit(mobile.page,gps);await stateIs(mobile.page,'tracking');
  await mobile.page.evaluate(()=>{window.__gpsTest.hidden=true;document.dispatchEvent(new Event('visibilitychange'));});await stateIs(mobile.page,'paused');
  await headingIs(mobile.page,'paused');
  check('Background clears active GPS watch',await mobile.page.evaluate(()=>window.__gpsTest.clears.includes(1)));
  const watchCount=await mobile.page.evaluate(()=>window.__gpsTest.callbacks.length);
  await mobile.page.evaluate(()=>{window.__gpsTest.hidden=false;document.dispatchEvent(new Event('visibilitychange'));});
  await emit(mobile.page,gps,5,0);
  await emitHeading(mobile.page);
  check('Late callbacks after pause ignored',await marker(mobile.page).count()===0);
  check('Background detaches heading listeners',await sector(mobile.page).count()===0);
  check('Returning foreground does not silently restart GPS',await mobile.page.evaluate(()=>window.__gpsTest.callbacks.length)===watchCount);
  await mobile.page.getByRole('button',{name:'继续定位',exact:true}).click();await emit(mobile.page,gps);await stateIs(mobile.page,'tracking');
  await emitHeading(mobile.page);await headingIs(mobile.page,'active');
  check('Explicit resume uses cached heading grant',await mobile.page.evaluate(()=>window.__gpsTest.permissionCalls)===1);
  await mobile.page.screenshot({path:resolve(out,'mobile-simulated-gps.png')});
  await mobile.context.close();

  const headingDenied=await open({width:844,height:390},true);
  await headingDenied.page.evaluate(()=>{window.__gpsTest.permission='denied';});
  await headingDenied.page.locator('.location-primary').click();await emit(headingDenied.page,gps);
  await stateIs(headingDenied.page,'tracking');await headingIs(headingDenied.page,'denied');
  check('Denying heading still allows GPS from the same click',await marker(headingDenied.page).count()===1 && await sector(headingDenied.page).count()===0);
  await headingDenied.page.evaluate(()=>{window.__gpsTest.permission='granted';});
  await headingDenied.page.locator('.location-primary').click();await emitHeading(headingDenied.page);await headingIs(headingDenied.page,'active');
  check('Same locate button retries a denied heading without restarting GPS',await headingDenied.page.evaluate(()=>window.__gpsTest.callbacks.length===1 && window.__gpsTest.permissionCalls===2));
  await headingDenied.page.getByRole('button',{name:'停止定位',exact:true}).click();await emitHeading(headingDenied.page);
  check('Stopping location also stops compass and removes sector',await sector(headingDenied.page).count()===0);
  await headingDenied.context.close();

  const pendingHeading=await open(undefined,true);
  await pendingHeading.page.evaluate(()=>{window.__gpsTest.deferPermission=true;});
  await pendingHeading.page.locator('.location-primary').click();await emit(pendingHeading.page,gps);
  await headingIs(pendingHeading.page,'requesting');await pendingHeading.page.getByRole('button',{name:'停止定位',exact:true}).click();
  await pendingHeading.page.evaluate(()=>window.__gpsTest.resolvePermission('granted'));await emitHeading(pendingHeading.page);
  await headingIs(pendingHeading.page,'off');
  check('Late granted direction permission cannot restart a stopped session',await sector(pendingHeading.page).count()===0);
  await pendingHeading.context.close();

  const unsupported=await open(undefined,true);
  await unsupported.page.evaluate(()=>Object.defineProperty(window,'DeviceOrientationEvent',{value:undefined,configurable:true}));
  await unsupported.page.locator('.location-primary').click();await emit(unsupported.page,gps);await stateIs(unsupported.page,'tracking');await headingIs(unsupported.page,'unsupported');
  check('Devices without compass keep working GPS with no invented heading',await marker(unsupported.page).count()===1 && await sector(unsupported.page).count()===0);
  await unsupported.context.close();

  for (const code of [1,2,3]) {
    const {page,context}=await open(undefined,true);
    await page.getByRole('button',{name:'定位到我',exact:true}).click();
    await page.evaluate(code=>window.__gpsTest.callbacks[0].error({code}),code);
    await stateIs(page,code===1?'denied':'error');
    check(`Browser error ${code} visible without fake marker`,await marker(page).count()===0);
    if(code===1) await page.screenshot({path:resolve(out,'permission-denied.png')});
    await page.getByRole('button',{name:'定位到我',exact:true}).click();await emit(page,gps);await stateIs(page,'tracking');
    check(`Explicit retry after error ${code} works`,await marker(page).count()===1);
    if(code===1) await page.screenshot({path:resolve(out,'desktop-simulated-gps.png')});
    await context.close();
  }
  const insecure=await open(undefined,true,false);
  await insecure.page.getByRole('button',{name:'定位到我',exact:true}).click();await stateIs(insecure.page,'error');
  check('Insecure context explains HTTPS requirement',await insecure.page.locator('.location-controls').innerText().then(text=>text.includes('HTTPS')));
  check('No browser runtime errors',consoleErrors.length===0);
  writeFileSync(resolve(out,'report.json'),JSON.stringify({passed:true,simulated_gps:true,field_tested:false,local_server_started:false,checks,consoleErrors},null,2));
  console.log(JSON.stringify({passed:true,checks:checks.length,simulated_gps:true,field_tested:false,local_server_started:false}));
} catch (error) {
  if (activePage && !activePage.isClosed()) {
    await activePage.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});
    const state=await activePage.evaluate(()=>({viewport:{width:innerWidth,height:innerHeight},dialogs:[...document.querySelectorAll('[role=dialog]')].map(el=>({label:el.getAttribute('aria-label'),rect:el.getBoundingClientRect().toJSON()})),collection:[...document.querySelectorAll('.collection-item')].map(el=>({text:el.textContent,rect:el.getBoundingClientRect().toJSON(),display:getComputedStyle(el).display,visibility:getComputedStyle(el).visibility})),stage:document.querySelector('.game-stage')?.getAttribute('data-entered')})).catch(()=>null);
    writeFileSync(resolve(out,'failure.json'),JSON.stringify({passed:false,error:String(error),state,consoleErrors},null,2));
  }
  throw error;
} finally { await browser.close(); }
