'use strict';
// Only the boot / lock / login UI, with an isolated synthetic authentication fixture.
// Does not read real auth config, start apps, or run the whole-site acceptance suite.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { newSession, until, sleep } = require('../lib.js');
const { startFixture } = require('../revision-20261028/fixture.cjs');
const out = __dirname;
const report = { ok: false, date: new Date().toISOString(), baseline: 'c80f946 + codex/aidenos-particle-gate working tree', scope: 'boot, lock and synthetic desktop login only', browser: 'owned headless Edge; OpenCLI disconnected', checks: [], screenshots: [] };
let browser, fixture;
async function check(name, expression) {
  const pass = typeof expression === 'string' ? await browser.evaluate(expression) : expression;
  report.checks.push({ name, pass: !!pass });
  assert(pass, name);
}
async function shot(name) {
  const { data } = await browser.call('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true });
  fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(data, 'base64'));
  report.screenshots.push(name + '.png');
}
async function key(name, code) {
  await browser.call('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code: name, windowsVirtualKeyCode: code });
  await browser.call('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code: name, windowsVirtualKeyCode: code });
}
async function ready() { await until(() => browser.evaluate('lockScreen.dataset.gateView === "clock" && lockScreen.dataset.gateStatus === "ready"'), 9000, 'clock ready'); }
async function answer(value) {
  await browser.click('#gateAnswer');
  await browser.call('Input.insertText', { text: value });
}
async function submitCorrect() {
  await answer(fixture.answer); await browser.click('#gateSubmit');
  await until(() => browser.evaluate('lockScreen.classList.contains("is-dissolving")'), 5000, 'authorized particle exit');
}
async function swipe() {
  await browser.call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 560 }] });
  for (let y = 530; y >= 350; y -= 30) await browser.call('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y }] });
  await browser.call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
(async () => {
  fixture = await startFixture(); browser = await newSession({ size: '1440x900' });
  report.browserVersion = (await browser.call('Browser.getVersion')).product;
  await browser.call('Page.addScriptToEvaluateOnNewDocument', { source: 'window.__gatePosts=0;window.__gateUnlocks=0;document.addEventListener("submit",e=>{if(e.target.id==="gateForm")window.__gatePosts++},true);' });
  await browser.navigate(fixture.origin + '/');
  await until(() => browser.evaluate('window.DesktopGate && lockScreen.dataset.gateView === "boot"'), 6000, 'boot');
  await sleep(700);
  await check('particles_are_drawn_before_artwork', '(()=>{const c=gateBootParticles.getContext("2d"),d=c.getImageData(0,0,gateBootParticles.width,gateBootParticles.height).data;return d.some((v,i)=>i%4===3&&v>0)&&getComputedStyle(document.querySelector(".gate-art-moon")).opacity==="0"})()');
  await shot('boot-gather');
  await sleep(650); await shot('boot-word-particles');
  await until(() => browser.evaluate('lockScreen.classList.contains("is-boot-formed")'), 4000, 'word formed');
  await sleep(1500); await shot('boot-landscape');
  const firstRing = await browser.evaluate('getComputedStyle(document.querySelector(".gate-loader-ring")).transform');
  await sleep(150);
  await check('loading_ring_really_rotates', (await browser.evaluate('getComputedStyle(document.querySelector(".gate-loader-ring")).transform')) !== firstRing);
  await check('artwork_is_loaded_without_baked_text', 'document.querySelector(".gate-art img").naturalWidth===1672');
  await ready(); await sleep(650); await shot('lock-clock');
  await check('clock_has_simple_layout_and_desktop_is_inert', 'desktop.inert && Win.isLocked() && !gateClockView.hidden && gateQuestionView.hidden && document.querySelector(".lock-inner").getBoundingClientRect().top<innerHeight*.3');
  await browser.call('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 700, y: 650, deltaX: 0, deltaY: 100 });
  await until(() => browser.evaluate('lockScreen.dataset.gateView === "question"'), 4000, 'wheel opens login');
  await sleep(800); await shot('lock-login');
  await check('login_wallpaper_dims_and_blurs', 'getComputedStyle(lockWall).filter.includes("brightness(0.49)") && getComputedStyle(lockWall).filter.includes("blur(15px)")');
  await check('plain_text_input_without_password_styling', 'gateAnswer.type==="text" && getComputedStyle(gateAnswer).webkitTextSecurity==="none"');
  await check('clock_is_inert_after_upward_transition', 'gateClockView.inert && gateClockView.hidden && document.activeElement===gateAnswer');
  await answer('合成中文测试');
  await check('Chinese_text_is_visible_and_editable', 'gateAnswer.value==="合成中文测试" && gateAnswer.type==="text"');
  await browser.evaluate('gateAnswer.dispatchEvent(new CompositionEvent("compositionstart",{bubbles:true,data:"测"}));gateForm.requestSubmit();');
  await sleep(120);
  await check('composing_cannot_submit', 'lockScreen.dataset.gateStatus==="ready" && gateAnswer.value==="合成中文测试" && desktop.inert');
  await browser.evaluate('gateAnswer.dispatchEvent(new CompositionEvent("compositionend",{bubbles:true,data:"测试"}))');
  await browser.click('#gateReveal');
  await check('clear_preserves_plain_text_and_focus', 'gateAnswer.type==="text" && gateAnswer.value==="" && document.activeElement===gateAnswer');
  await answer('Synthetic incorrect answer'); await browser.click('#gateSubmit');
  await until(() => browser.evaluate('lockScreen.dataset.gateStatus === "denied"'), 5000, 'wrong answer');
  await check('wrong_answer_cleared_and_cannot_unlock', 'gateAnswer.value==="" && desktop.inert && Win.isLocked()');
  await submitCorrect();
  report.revealStart = await browser.evaluate('({now:performance.now(),hidden:gateUnlockParticles.hidden,mask:lockScreen.style.getPropertyValue("--gate-erosion"),view:lockScreen.dataset.gateView,classes:lockScreen.className})');
  await check('desktop_still_inert_during_particle_exit', 'desktop.inert && Win.isLocked() && document.body.classList.contains("is-gate-revealing") && gateAnswer.value==="" && gateAnswer.disabled');
  await check('particle_exit_keeps_keyboard_focus_on_gate', 'document.activeElement===lockScreen');
  await until(() => browser.evaluate('parseFloat(lockScreen.style.getPropertyValue("--gate-erosion")) < 95'), 2000, 'visible edge erosion');
  report.revealDuring = await browser.evaluate('({now:performance.now(),hidden:gateUnlockParticles.hidden,mask:lockScreen.style.getPropertyValue("--gate-erosion"),view:lockScreen.dataset.gateView,classes:lockScreen.className})');
  await check('edge_mask_progresses_and_particles_visible', '!gateUnlockParticles.hidden && parseFloat(lockScreen.style.getPropertyValue("--gate-erosion"))<95');
  await shot('login-dissolve');
  await until(() => browser.evaluate('!Win.isLocked() && !desktop.inert && lockScreen.hidden'), 5000, 'authorized desktop');
  await check('authorized_exit_releases_actual_desktop', 'lockScreen.hidden && gateUnlockParticles.hidden && !desktop.inert');
  await shot('desktop-revealed');
  await browser.evaluate('window.__gateEvents=[];Win.bus.on("unlock",()=>__gateEvents.push({event:"unlock",time:performance.now()}));Win.bus.on("lock:request-close-all",()=>__gateEvents.push({event:"mask",time:performance.now()}))');
  report.relock = await browser.evaluate('(()=>{void DesktopGate.lock();return {locked:Win.isLocked(),view:lockScreen.dataset.gateView,status:lockScreen.dataset.gateStatus}})()'); await ready();
  await browser.click('#gateLogin'); await sleep(550); await submitCorrect();
  await key('Escape', 27); await sleep(1500); await ready();
  await check('Escape_during_dissolve_revokes_without_stale_release', 'desktop.inert && Win.isLocked() && !lockScreen.hidden && gateUnlockParticles.hidden');
  await browser.call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await browser.call('Emulation.setTouchEmulationEnabled', { enabled: true });
  await sleep(150); await shot('lock-mobile-clock');
  await swipe(); await sleep(750);
  await check('native_touch_swipe_opens_mobile_login', 'lockScreen.dataset.gateView==="question" && desktop.inert');
  await check('mobile_login_fits_without_horizontal_overflow', 'document.documentElement.scrollWidth===innerWidth && gateForm.getBoundingClientRect().left>=0 && gateSubmit.getBoundingClientRect().right<=innerWidth && gateSubmit.getBoundingClientRect().bottom<=innerHeight');
  await shot('lock-mobile-login');
  await browser.click('#gateBack'); await ready();
  await browser.click('#gateReplay');
  await until(() => browser.evaluate('lockScreen.classList.contains("is-boot-formed") && lockScreen.dataset.gateView==="boot"'), 4000, 'mobile opening');
  await sleep(1500); await shot('boot-mobile');
  await browser.click('#gateLoader'); await ready();
  await check('loading_button_is_an_actual_skip_action', 'desktop.inert && Win.isLocked() && lockScreen.dataset.gateView==="clock"');
  await browser.call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await browser.click('#gateReplay'); await ready();
  await check('reduced_motion_skips_long_opening', 'desktop.inert && lockScreen.dataset.gateView==="clock"');
  await browser.click('#gateLogin'); await answer(fixture.answer); await browser.click('#gateSubmit');
  await until(() => browser.evaluate('!desktop.inert && lockScreen.hidden'), 5000, 'reduced motion release');
  await check('reduced_motion_authorizes_without_particle_animation', 'gateUnlockParticles.hidden && !Win.isLocked()');
  // Expected HTTP 401 is the deliberate incorrect synthetic answer above.
  const unexpected = browser.errors.filter(e => !e.startsWith('HTTP 401:') && !e.includes('401 (Unauthorized)'));
  report.errors = unexpected;
  await check('no_unexpected_browser_errors', unexpected.length === 0);
  report.ok = true;
})().catch(async error => {
  report.error = error.stack; process.exitCode = 1;
  if (browser) report.failureState = await browser.evaluate('({view:lockScreen.dataset.gateView,status:lockScreen.dataset.gateStatus,message:gateStatus.textContent,locked:Win.isLocked(),inert:desktop.inert,hidden:lockScreen.hidden,visibility:document.visibilityState,events:window.__gateEvents})').catch(() => null);
}).finally(async () => {
  if (browser) report.observedErrors = browser.errors;
  if (browser) await browser.close(); if (fixture) await fixture.close();
  report.total = report.checks.length; report.passed = report.checks.filter(c => c.pass).length;
  fs.writeFileSync(path.join(out, 'checks.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ ok: report.ok, passed: report.passed, total: report.total, error: report.error }));
});
