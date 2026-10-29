'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {newSession,until,sleep}=require('../lib.js');
const ORIGIN='https://liyun.studentop.cn:14355';
const SRC=path.resolve(__dirname,'../../apps/liyun-explorer/src');
// Derive the check-in target from the app's own public calibration model (never a user location).
async function campusGeo() {
  const {pathToFileURL}=require('node:url');
  const {createCampusMap}=await import(pathToFileURL(path.join(SRC,'location/vendor/coordinates.mjs')).href);
  const metadata=JSON.parse(fs.readFileSync(path.join(SRC,'location/data/map.json'),'utf8'));
  const artifact=JSON.parse(fs.readFileSync(path.join(SRC,'location/data/selected_model.json'),'utf8'));
  const map=createCampusMap(metadata,artifact);
  const inside=map.uvToGeo(358/1000.56,459/1240.28003);
  for(const dy of [0.0008,0.0012,0.0016,0.002]) {
    if(map.gpsToMap(inside.latitude+dy,inside.longitude).inside_image) return { inside, far:{ latitude:inside.latitude+dy, longitude:inside.longitude } };
  }
  throw new Error('No mapped far test point');
}
(async()=>{ let s;
  const session=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../.release-local/pr2-stack-session.json'),'utf8'));
  const manifest=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../.release-local',session.id,'manifest.json'),'utf8'));
  const report={ ok:false, environment:'production-public', target:ORIGIN, expectedCommit:manifest.appCommit, release:manifest.id, fixtureChecks:[], method:'owned isolated Edge/CDP; normal UI, real clicks, real fog pixels; geolocation overridden by CDP to a model-derived point', checks:[] };
  const check=(name,pass,detail)=>{ report.checks.push({ name, pass:!!pass, ...(detail===undefined?{}:{detail}) }); if(!pass) throw new Error(name); };
  const responses=[], failures=[]; let phase='navigation';
  const page=fn=>s.evaluate('('+fn.toString()+')()');
  const readText=sel=>s.evaluate('(()=>{const e=document.querySelector('+JSON.stringify(sel)+');return e?e.textContent.trim():null;})()');
  async function click(sel) {
    const hit=await s.evaluate('(()=>{const e=document.querySelector('+JSON.stringify(sel)+');if(!e||e.disabled||e.closest("[inert]"))return false;const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;const t=document.elementFromPoint(x,y);return x>=0&&y>=0&&x<innerWidth&&y<innerHeight&&!!t&&(t===e||e.contains(t));})()');
    if(!hit) throw new Error('Real clickable target missing: '+sel);
    await s.click(sel);
  }
  async function type(sel,text) { await click(sel); await s.call('Input.insertText',{text}); await sleep(60); }
  async function sample() {
    const p=await page(()=>{ const c=document.querySelector('canvas[data-effect-layer=fog]'); const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; const pixels=[]; let alpha=0; for(let i=0;i<d.length;i+=1024){ pixels.push(d[i],d[i+1],d[i+2],d[i+3]); alpha+=d[i+3]; } const stage=document.querySelector('[data-testid=game-stage]'); return { pixels, alpha, dimensions:[c.width,c.height], camera:document.querySelector('.map-world').style.transform, progress:Number(stage.dataset.progress), hidden:document.hidden }; });
    return { ...p, hash:crypto.createHash('sha256').update(Buffer.from(p.pixels)).digest('hex') };
  }
  const diff=(a,b)=>{ let changed=0; for(let i=0;i<a.pixels.length;i++) if(Math.abs(a.pixels[i]-b.pixels[i])>1) changed++; return { changed, channels:a.pixels.length, ratio:changed/a.pixels.length }; };
  async function roi() {
    return page(()=>{
      const marker=document.querySelector('[data-testid=poi-beihu]'), scene=document.querySelector('[data-testid=map-scene]'), c=document.querySelector('canvas[data-effect-layer=fog]');
      if(!marker||!scene||!c) return null;
      const sr=scene.getBoundingClientRect();
      const left=parseFloat(marker.style.left), top=parseFloat(marker.style.top);
      if(!Number.isFinite(left)||!Number.isFinite(top)) return null;
      const x=sr.left+left, y=sr.top+top;
      const cr=c.getBoundingClientRect(), sx=c.width/cr.width, sy=c.height/cr.height;
      const cx=(x-cr.left)*sx, cy=(y-cr.top)*sy, w=Math.round(48*sx), h=Math.round(48*sy);
      const px=Math.round(cx-w/2), py=Math.round(cy-h/2);
      if(!(w>0&&h>0)||px<0||py<0||px+w>c.width||py+h>c.height) return null;
      const d=c.getContext('2d').getImageData(px,py,w,h).data; let total=0; for(let i=3;i<d.length;i+=4) total+=d[i];
      return { meanAlpha:total/(d.length/4), camera:document.querySelector('.map-world').style.transform, anchor:[Math.round(x),Math.round(y)] };
    });
  }
  try {
    const geo=await campusGeo();
    s=await newSession({ size:'1440x900', allowPublic:true });
    s.client.on('Network.responseReceived',p=>responses.push({ url:p.response.url, status:p.response.status, mime:p.response.mimeType, type:p.type }));
    s.client.on('Network.loadingFailed',p=>failures.push({ errorText:p.errorText, canceled:p.canceled, phase }));
    await s.call('Browser.grantPermissions',{ origin:ORIGIN, permissions:['geolocation'] });
    await s.call('Emulation.setGeolocationOverride',{ latitude:geo.far.latitude, longitude:geo.far.longitude, accuracy:8 });
    await s.call('Page.navigate',{ url:ORIGIN+'/' });
    await until(()=>s.evaluate('document.readyState==="complete"&&!!document.querySelector(".enter-campus")'),90000,'production app ready');
    check('real_final_url_without_dev_api', await page(()=>location.origin==='https://liyun.studentop.cn:14355'&&location.pathname==='/'&&!location.search&&typeof window.__LIYUN__==='undefined'));
    const bundle=manifest.files.find(f=>/^assets\/index-.*\.js$/.test(f.path));
    check('expected_bundle_and_new_map_requested', responses.some(r=>r.url===ORIGIN+'/'+bundle.path&&r.status===200&&/javascript/.test(r.mime))&&responses.some(r=>/campus_no_labels\.webp$/.test(r.url)&&r.status===200), { bundle:bundle.path });
    const suffix=crypto.randomBytes(6).toString('hex'), nickname='QA-'+suffix, studentId='qa-'+suffix, password=crypto.randomBytes(18).toString('base64url');
    await type('.entry-login label:nth-child(1) input',nickname);
    await type('.entry-login label:nth-child(2) input',studentId);
    await type('.entry-login label:nth-child(3) input',password);
    await click('.entry-login button[type=submit]');
    await until(()=>s.evaluate('!!document.querySelector(".account-chip strong")'),30000,'account created');
    check('account_registration_logs_in', (await readText('.account-chip strong'))===nickname);
    await click('.enter-campus');
    await until(()=>s.evaluate('document.querySelector("[data-testid=game-stage]").dataset.entered==="true"'),20000,'entered');
    check('account_enters_site_with_visible_uid', (await readText('.campus-progress small')||'').includes(nickname)&&/UID/.test(await readText('.campus-progress small')||''), { bottom:await readText('.campus-progress small') });
    await click('.location-primary');
    await until(()=>s.evaluate('document.querySelector("section[aria-label=校园真实定位]").dataset.status==="tracking"'),30000,'geolocation tracking');
    await click('[data-testid=poi-beihu]');
    await until(()=>s.evaluate('!!document.querySelector("[role=dialog][aria-label=北湖]")'),15000,'landmark dialog');
    await until(()=>s.evaluate('(()=>{const e=document.querySelector("[data-testid=check-in-status]");return e&&e.dataset.reason&&e.dataset.reason!=="unknown";})()'),30000,'eligibility resolved');
    const blocked=await page(()=>{ const e=document.querySelector('[data-testid=check-in-status]'), b=document.querySelector('[data-testid=check-in-button]'); return { reason:e.dataset.reason, disabled:b.disabled, label:b.textContent.trim(), progress:Number(document.querySelector('[data-testid=game-stage]').dataset.progress) }; });
    check('out_of_range_check_in_is_blocked', blocked.reason==='out-of-range'&&blocked.disabled&&blocked.progress===0, blocked);
    await s.screenshot(path.join(__dirname,'public-out-of-range.png'));
    await s.call('Emulation.setGeolocationOverride',{ latitude:geo.inside.latitude, longitude:geo.inside.longitude, accuracy:8 });
    await until(()=>s.evaluate('(()=>{const e=document.querySelector("[data-testid=check-in-status]");return e&&e.dataset.reason==="ready";})()'),30000,'check-in range reached');
    const before=await roi();
    await click('[data-testid=check-in-button]');
    await until(()=>s.evaluate('document.querySelector("[data-testid=poi-beihu]").classList.contains("is-discovered")'),20000,'real check-in accepted');
    await until(()=>s.evaluate('!document.querySelector("[role=dialog][aria-label=北湖]")'),15000,'dialog closed');
    // The unlock plays a bright flash before the fog settles; wait for it to finish.
    await until(()=>s.evaluate('!document.querySelector("[data-testid=poi-beihu]").classList.contains("is-newly-found")'),15000,'unlock flash finished').catch(()=>{});
    await sleep(1500);
    const settledA=await roi(); await sleep(1200); const settledB=await roi(); const discovered=await sample();
    const after=(settledB&&settledA&&settledB.meanAlpha<settledA.meanAlpha)?settledB:(settledA||settledB);
    check('check_in_marks_discovered_and_adds_progress', discovered.progress===7, { progress:discovered.progress });
    check('real_check_in_clears_fog_at_landmark', !!before&&!!after&&!!settledA&&!!settledB&&before.meanAlpha>80&&settledA.meanAlpha<before.meanAlpha*0.6&&settledB.meanAlpha<before.meanAlpha*0.6, { before, settledA, settledB, cameraChanged:!!before&&!!settledB&&before.camera!==settledB.camera });
    await s.screenshot(path.join(__dirname,'public-checked-in.png'));
    phase='reload';
    await s.call('Page.navigate',{ url:ORIGIN+'/' });
    await until(()=>s.evaluate('document.readyState==="complete"&&!!document.querySelector(".enter-campus")'),90000,'reloaded gate');
    await until(()=>s.evaluate('!!document.querySelector(".account-chip strong")||!!document.querySelector(".entry-error")'),30000,'session restore finished');
    const gate=await page(()=>({ nickname:document.querySelector('.account-chip strong')?.textContent||null, form:!!document.querySelector('.entry-login') }));
    check('reload_restores_logged_in_account', gate.nickname===nickname&&!gate.form, gate);
    await click('.entry-alt');
    await until(()=>s.evaluate('!!document.querySelector(".entry-login")'),15000,'logout to login form');
    await type('.entry-login label:nth-child(1) input',nickname);
    await type('.entry-login label:nth-child(2) input',studentId);
    await type('.entry-login label:nth-child(3) input',password+'wrong');
    await click('.entry-login button[type=submit]');
    await until(()=>s.evaluate('!!document.querySelector(".entry-error")'),20000,'wrong passphrase rejected');
    check('wrong_passphrase_cannot_enter_existing_account', (await readText('.entry-error')||'').length>0&&await s.evaluate('document.querySelector("[data-testid=game-stage]").dataset.entered!=="true"'), { error:await readText('.entry-error') });
    await type('.entry-login label:nth-child(3) input',password);
    await click('.entry-login button[type=submit]');
    await until(()=>s.evaluate('!!document.querySelector(".account-chip strong")'),30000,'correct passphrase accepted');
    await click('.enter-campus');
    await until(()=>s.evaluate('document.querySelector("[data-testid=game-stage]").dataset.entered==="true"'),20000,'correct passphrase enters');
    await sleep(900);
    const resumed=await sample();
    check('correct_passphrase_restores_same_cloud_progress', resumed.progress===7, { progress:resumed.progress });
    phase='idle';
    const a=await sample(); await sleep(1200); const b=await sample(); await sleep(1200); const c2=await sample();
    check('independent_fog_billows_at_idle', diff(a,b).changed>100&&diff(b,c2).changed>100&&a.camera===c2.camera&&a.progress===c2.progress, { differences:[diff(a,b),diff(b,c2)] });
    await click('nav[aria-label="旅途工具"] button:nth-of-type(1)');
    const sw='[role=switch][aria-label="减少动态效果"]';
    if(!(await s.evaluate('document.querySelector('+JSON.stringify(sw)+').getAttribute("aria-checked")==="true"'))) await click(sw);
    check('real_reduced_motion_switch_on', await s.evaluate('document.querySelector('+JSON.stringify(sw)+').getAttribute("aria-checked")==="true"'));
    await click('button[aria-label="关闭面板"]'); await sleep(900);
    const stillA=await sample(); await sleep(1200); const stillB=await sample();
    check('reduced_motion_stops_idle_fog_loop', diff(stillA,stillB).changed===0&&stillB.alpha>0, { difference:diff(stillA,stillB) });
    await click('nav[aria-label="旅途工具"] button:nth-of-type(1)'); await click(sw); await click('button[aria-label="关闭面板"]'); await sleep(900);
    const movingA=await sample(); await sleep(1200); const movingB=await sample();
    check('motion_switch_off_resumes_fog', diff(movingA,movingB).changed>100, diff(movingA,movingB));
    await s.evaluate('document.fonts.ready.then(()=>true)');
    const visual=await page(()=>{ const imgs=['.map-base-image','.border-art.pine','.border-art.mountain'].map(sel=>{ const e=document.querySelector(sel); return { sel, exists:!!e, complete:!!e?.complete, width:e?.naturalWidth||0, src:e?.currentSrc||'' }; }); return { imgs, fonts:[...document.fonts].map(f=>({ family:f.family, status:f.status })) }; });
    check('enhanced_map_and_art_decoded', visual.imgs.every(x=>x.exists&&x.complete&&x.width>0)&&visual.imgs[0].src.includes('campus_no_labels.webp'), visual.imgs);
    await s.call('DOM.enable'); await s.call('CSS.enable');
    const doc=await s.call('DOM.getDocument'); const fontEvidence=[];
    for(const sel of ['.brand-copy strong','.map-help .desktop-help']) { const q=await s.call('DOM.querySelector',{ nodeId:doc.root.nodeId, selector:sel }); const f=q.nodeId?await s.call('CSS.getPlatformFontsForNode',{ nodeId:q.nodeId }):{ fonts:[] }; fontEvidence.push({ selector:sel, fonts:f.fonts }); }
    check('actual_custom_chinese_fonts_used', fontEvidence.every(e=>e.fonts.some(f=>f.isCustomFont&&f.glyphCount>0)), fontEvidence);
    phase='viewport';
    await s.call('Emulation.setDeviceMetricsOverride',{ width:844, height:390, deviceScaleFactor:1, mobile:true });
    await until(()=>s.evaluate('innerWidth===844&&innerHeight===390'),10000,'landscape viewport'); await sleep(900);
    check('landscape_mobile_stays_usable', await page(()=>{ const m=document.querySelector('.map-base-image'); return !document.querySelector('.orientation-gate')&&!!m&&m.currentSrc.includes('campus_no_labels.webp')&&document.documentElement.scrollWidth<=844; })&&await s.evaluate('document.querySelectorAll("canvas[data-effect-layer]").length===2'));
    await s.screenshot(path.join(__dirname,'public-mobile-844.png'));
    await s.call('Emulation.setDeviceMetricsOverride',{ width:390, height:844, deviceScaleFactor:1, mobile:true }); await sleep(600);
    check('portrait_shows_original_rotation_gate', await page(()=>!!document.querySelector('[role=dialog][aria-label="请横屏探索"]')&&document.querySelector('.hud-layer').inert&&Number(document.querySelector('[data-testid=game-stage]').dataset.progress)===7));
    await s.call('Emulation.setDeviceMetricsOverride',{ width:1440, height:900, deviceScaleFactor:1, mobile:false }); await sleep(700);
    const expected401=s.errors.filter(e=>e==='HTTP 401: '+ORIGIN+'/api/auth/login');
    const unexpectedErrors=s.errors.filter(e=>!expected401.includes(e));
    const unexpected=failures.filter(f=>!f.canceled);
    const unexpectedHttp=responses.filter(r=>r.status>=400&&!r.url.endsWith('/api/auth/login'));
    check('no_unexpected_console_or_network_errors', unexpectedErrors.length===0&&unexpected.length===0&&unexpectedHttp.length===0&&expected401.length===1, { errors:unexpectedErrors.slice(0,5), failures:unexpected.slice(0,5), unexpectedHttp:unexpectedHttp.slice(0,5), intentionalUnauthorizedResponses:expected401.length });
    report.intentionalNegativeTest='One HTTP 401 from the deliberate wrong-passphrase attempt is expected; nothing else failed.';
    report.resourceSummary={ total:responses.length, api:responses.filter(r=>r.url.includes('/api/')).map(r=>({ url:r.url.replace(ORIGIN,''), status:r.status })) };
    report.ok=true;
  } catch(e) {
    report.error=String(e.stack||e); report.browserErrors=(s?.errors)||[]; report.networkFailures=failures.slice(0,10); report.lastPhase=phase; process.exitCode=1;
    if(s) await s.screenshot(path.join(__dirname,'public-failure.png')).catch(()=>{});
  } finally {
    phase='close'; if(s) await s.close();
    report.total=report.checks.length; report.passed=report.checks.filter(c=>c.pass).length;
    fs.writeFileSync(path.join(__dirname,'public-browser.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({ ok:report.ok, passed:report.passed, total:report.total, error:report.error||null }));
  }
})();
