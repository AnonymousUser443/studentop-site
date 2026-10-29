'use strict';
// Visual diagnostic only: run the real Canvas renderer at a fixed 600ms frame.
// Native timing / authorization is covered separately by browser.cjs.
const fs = require('node:fs');
const path = require('node:path');
const { newSession, until } = require('../lib.js');
const { startFixture } = require('../revision-20261028/fixture.cjs');
let browser, fixture;
(async () => {
  fixture = await startFixture(); browser = await newSession();
  await browser.navigate(fixture.origin + '/');
  await until(() => browser.evaluate('window.DesktopGate && lockScreen.dataset.gateView==="boot"'), 5000, 'boot');
  await browser.click('#gateSkip');
  await until(() => browser.evaluate('lockScreen.dataset.gateStatus==="ready"'), 5000, 'ready');
  await browser.click('#gateLogin'); await browser.click('#gateAnswer');
  // Hold only animation callbacks so the screenshot encoder cannot skip the frame.
  await browser.evaluate('window.__visualRAF=[];window.requestAnimationFrame=fn=>(__visualRAF.push(fn),__visualRAF.length)');
  await browser.call('Input.insertText', { text: fixture.answer }); await browser.click('#gateSubmit');
  await until(() => browser.evaluate('lockScreen.classList.contains("is-dissolving") && __visualRAF.length>0'), 5000, 'authorized reveal');
  await browser.evaluate('(()=>{const callbacks=__visualRAF.splice(0);callbacks.forEach(fn=>fn(performance.now()+600))})()');
  const { data } = await browser.call('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true });
  fs.writeFileSync(path.join(__dirname, 'login-dissolve-frame.png'), Buffer.from(data, 'base64'));
  const state = await browser.evaluate('({inert:desktop.inert,hidden:gateUnlockParticles.hidden,mask:lockScreen.style.getPropertyValue("--gate-erosion")})');
  if (!state.inert || state.hidden || !(parseFloat(state.mask) < 60 && parseFloat(state.mask) > 20)) throw new Error('Fixed-frame diagnostic did not reach the middle of the authorized exit');
  console.log(JSON.stringify({ ok: true, diagnostic: 'presentation at controlled 600ms; not a native timing test', state }));
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close(); if (fixture) await fixture.close();
});
