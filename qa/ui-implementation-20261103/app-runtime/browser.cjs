'use strict';
// Local integration QA: owned headless Edge profile, synthetic credentials and temporary SQLite only.
// All browser /api requests are intercepted and fulfilled from the owned ephemeral server.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { newSession, until, sleep } = require('../../lib.js');
const app = path.resolve(__dirname, '../../../apps/liyun-explorer');
const out = __dirname;
const base = 'http://127.0.0.1:5176';
const SAVE = 'liyun.exploration.v2', LEGACY = 'liyun.exploration.v1', TOKEN = 'liyun.session.v1';
const checks = [], apiLog = [], evidence = {};
function check(name, pass, detail) { checks.push({ name, pass: Boolean(pass), detail: detail === undefined ? undefined : structuredClone(detail) }); if (!pass) throw new Error(name + ': ' + JSON.stringify(detail)); }

(async () => {
  let s, server, store, temporary;
  const faults = { failReads: 0, holdNextPut: false, releasePut: null, holdNextRead: false, releaseRead: null };
  try {
    const { openStore } = await import(pathToFileURL(path.join(app, 'server/store.mjs')));
    const { createApiServer } = await import(pathToFileURL(path.join(app, 'server/server.mjs')));
    const { DEFAULT_SETTINGS } = await import(pathToFileURL(path.join(app, 'shared/game-settings.mjs')));
    temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'liyun-app-runtime-'));
    store = openStore({ dataDir: temporary });
    server = createApiServer(store, { production: false, publicOrigin: null });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const apiBase = 'http://127.0.0.1:' + server.address().port;
    const direct = async (route, { method = 'GET', token, body } = {}) => {
      const r = await fetch(apiBase + route, { method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) });
      if (!r.ok) throw new Error('Owned fixture API ' + r.status);
      return r.json();
    };
    const settings = { ...DEFAULT_SETTINGS, music: false, uiSound: false, autoDegrade: false, messageDuration: 5, zoomLimit: 3.8 };
    const local = { version: 3, discoveredIds: ['tower'], unlockedRegionIds: ['park'], playerUV: { u: .502, v: .507 }, settings };
    const cloud = { ...local, discoveredIds: ['beihu'], unlockedRegionIds: ['park', 'beihu'] };
    const sentinel = JSON.stringify(local);
    const credentials = { nickname: 'App Runtime Fixture', studentId: 'app-runtime-' + Date.now(), password: 'synthetic-runtime-passphrase-2026' };
    const seeded = await direct('/api/auth/login', { method: 'POST', body: credentials });
    await direct('/api/progress', { method: 'PUT', token: seeded.token, body: { state: cloud } });

    s = await newSession({ size: '1440x900', hardwareRendering: true });
    await s.call('Emulation.setFocusEmulationEnabled', { enabled: true });
    await s.call('Page.bringToFront');
    // Replace this owned client's default local-only interception; no existing server is contacted.
    s.client.removeAllListeners('Fetch.requestPaused');
    s.client.on('Fetch.requestPaused', async p => {
      try {
        const url = new URL(p.request.url);
        if (url.pathname.startsWith('/api/')) {
          const body = p.request.postData ? JSON.parse(p.request.postData) : undefined;
          const row = { method: p.request.method, path: url.pathname, ids: body?.state?.discoveredIds, at: Date.now() };
          apiLog.push(row);
          if (row.method === 'GET' && row.path === '/api/progress' && faults.failReads-- > 0) {
            row.status = 503; row.expectedFailure = true;
            await s.call('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: 503, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from('{"error":"synthetic read outage"}').toString('base64') });
            return;
          }
          if (row.method === 'PUT' && faults.holdNextPut) {
            faults.holdNextPut = false; row.held = true;
            await new Promise(resolve => { faults.releasePut = resolve; });
          }
          const response = await fetch(apiBase + url.pathname + url.search, { method: row.method, headers: p.request.headers, body: p.request.postData });
          row.status = response.status;
          const responseBody = Buffer.from(await response.arrayBuffer());
          if (row.method === 'GET' && row.path === '/api/progress' && faults.holdNextRead) {
            faults.holdNextRead = false; row.held = true;
            await new Promise(resolve => { faults.releaseRead = resolve; });
          }
          await s.call('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: response.status, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Cache-Control', value: 'no-store' }], body: responseBody.toString('base64') });
        } else if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && /^https?:$/.test(url.protocol)) {
          await s.call('Fetch.failRequest', { requestId: p.requestId, errorReason: 'BlockedByClient' });
        } else await s.call('Fetch.continueRequest', { requestId: p.requestId });
      } catch (error) { s.errors.push('INTERCEPT: ' + String(error)); await s.call('Fetch.failRequest', { requestId: p.requestId, errorReason: 'Failed' }).catch(() => {}); }
    });
    await s.call('Page.addScriptToEvaluateOnNewDocument', { source: `
      try {
        if (!sessionStorage.getItem('runtime-seeded')) {
          localStorage.setItem(${JSON.stringify(SAVE)}, ${JSON.stringify(sentinel)});
          localStorage.setItem(${JSON.stringify(LEGACY)}, 'legacy-sentinel');
          localStorage.setItem(${JSON.stringify(TOKEN)}, 'ordinary-token-sentinel');
          sessionStorage.setItem('runtime-seeded','1');
        }
        window.__runtimeStorageLog=[];
        for(const method of ['getItem','setItem','removeItem']) {
          const original=Storage.prototype[method];
          Storage.prototype[method]=function(key,...rest) {
            if(this===localStorage&&${JSON.stringify([SAVE, LEGACY, TOKEN])}.includes(key)) window.__runtimeStorageLog.push({method,key});
            return original.call(this,key,...rest);
          };
        }
      } catch {}
    ` });
    const pointerClick = s.click;
    s.click = async selector => { await s.evaluate(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'nearest'});true`); await sleep(60); await pointerClick(selector); };
    // Vite can retain HMR timestamps in a fresh page's import graph; use that exact module instance.
    const module = source => `import(performance.getEntriesByType('resource').map(e=>e.name).find(name=>new URL(name).pathname===${JSON.stringify(source)})??${JSON.stringify(source)})`;
    const state = () => s.evaluate(`window.__LIYUN__?window.__LIYUN__.getState():${module('/src/app/stores/useExploration.ts')}.then(m=>m.useExploration.getState().state)`);
    const ready = () => until(() => s.evaluate('Boolean(document.querySelector("[data-testid=game-stage]"))'), 15000, 'app ready');
    const openMenu = async () => { await s.click('.hud-brand-badge'); await until(() => s.evaluate('Boolean(document.querySelector(".menu-screen[data-state=open]"))'), 5000, 'menu opens'); await sleep(400); };
    const openSettings = async () => { await openMenu(); await s.click('.menu-grid [aria-label="设置"]'); await until(() => s.evaluate('Boolean(document.querySelector(".settings-screen[data-state=open]"))'), 5000, 'settings opens'); await sleep(500); };
    const tab = async id => { await s.click('#settings-tab-' + id); await sleep(450); };
    const clickText = async (scope, text) => {
      await s.evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(scope + ' button')})].find(e=>e.textContent.trim()===${JSON.stringify(text)});if(!e)throw Error('button missing');e.dataset.runtimeTarget='yes';return true})()`);
      await s.click('[data-runtime-target="yes"]'); await s.evaluate('document.querySelector("[data-runtime-target]")?.removeAttribute("data-runtime-target");true');
    };
    const confirm = async text => { await clickText('.settings-panel', text); await sleep(250); await clickText('.settings-confirm', text); };
    const escape = async () => { await s.call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await s.call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await sleep(450); };
    const putCount = () => apiLog.filter(r => r.method === 'PUT').length;
    const ordinary = () => s.evaluate(`({save:localStorage.getItem(${JSON.stringify(SAVE)}),legacy:localStorage.getItem(${JSON.stringify(LEGACY)}),token:localStorage.getItem(${JSON.stringify(TOKEN)})})`);
    const login = async () => {
      for (const [selector, text] of [['.entry-login input:not([type=password])', credentials.nickname], ['.entry-login label:nth-of-type(2) input', credentials.studentId], ['.entry-login input[type=password]', credentials.password]]) { await s.click(selector); await s.call('Input.insertText', { text }); }
      await s.click('.entry-login button[type=submit]');
      await until(() => s.evaluate('Boolean(document.querySelector(".account-chip"))'), 10000, 'synthetic account authenticated');
      await s.click('.entry-card .enter-campus'); await sleep(350);
    };

    // Fixed QA presets isolate every data operation, not only initial loading.
    await s.navigate(base + '/?qa=1&preset=explored'); await ready();
    await until(() => s.evaluate('Boolean(window.__LIYUN__)'), 10000, 'QA bridge');
    check('QA initial hydration never reads/writes ordinary save or token', await s.evaluate('window.__runtimeStorageLog.length===0'), await s.evaluate('window.__runtimeStorageLog'));
    check('QA initial hydration does not call an account API', apiLog.length === 0, apiLog);
    await s.evaluate('window.__LIYUN__.setSettings({music:false,autoDegrade:false,messageDuration:5,zoomLimit:3.8});true');
    await openSettings(); await tab('data');
    await confirm('重置探索进度'); await sleep(500);
    let current = await state();
    check('QA reset empties exploration and independent regions while retaining settings', current.discoveredIds.length === 0 && current.unlockedRegionIds.length === 0 && current.settings.zoomLimit === 3.8 && current.settings.messageDuration === 5, current);
    await s.evaluate('window.__LIYUN__.unlockRegion("park");window.__runtimeOriginalURL=URL.createObjectURL;URL.createObjectURL=b=>{window.__runtimeExport=b;return window.__runtimeOriginalURL(b)};true');
    await clickText('.settings-panel', '导出 JSON'); await sleep(250);
    const exported = await s.evaluate('window.__runtimeExport.text().then(JSON.parse)');
    check('QA export reads sanitized current memory instead of ordinary archive', exported.discoveredIds.length === 0 && exported.unlockedRegionIds.join() === 'park' && exported.settings.zoomLimit === 3.8, exported);
    await confirm('清空本机存档'); await sleep(800);
    check('QA clear returns to a usable entry with map route', await s.evaluate('document.querySelector("[data-testid=game-stage]").dataset.route==="map"&&document.querySelector(".entrance-overlay")&&!document.querySelector(".hud-layer").inert&&!document.querySelector(".settings-screen")'), true);
    check('QA reset, export and clear preserve ordinary keys exactly', JSON.stringify(await ordinary()) === JSON.stringify({ save: sentinel, legacy: 'legacy-sentinel', token: 'ordinary-token-sentinel' }), await ordinary());
    check('QA data actions never contact the account API', apiLog.length === 0, apiLog);
    await s.screenshot(path.join(out, 'shots', 'qa-clear-entry.png'));

    await s.navigate(base + '/?tool=calibration'); await ready(); await sleep(800);
    check('Calibration direct entry never reads/writes ordinary save or token', await s.evaluate('window.__runtimeStorageLog.length===0'), await s.evaluate('window.__runtimeStorageLog'));
    check('Calibration direct entry has no QA bridge and no cloud activity', await s.evaluate('!window.__LIYUN__') && apiLog.length === 0, apiLog);
    await s.screenshot(path.join(out, 'shots', 'calibration-isolated.png'));

    // Ordinary guest -> account entry must close all portal routes before showing the form.
    await s.evaluate(`localStorage.removeItem(${JSON.stringify(TOKEN)});true`);
    await s.navigate(base + '/'); await ready();
    check('Ordinary development page does not expose the QA bridge', await s.evaluate('!window.__LIYUN__'), true);
    await s.click('.entry-card .entry-alt'); await sleep(300);
    await openSettings(); await tab('account'); await clickText('.settings-panel', '登录账号'); await sleep(700);
    check('Guest login prompt closes routes and leaves entry interactive', await s.evaluate('document.querySelector("[data-testid=game-stage]").dataset.route==="map"&&!document.querySelector(".menu-screen,.settings-screen")&&!document.querySelector(".hud-layer").inert&&Boolean(document.querySelector(".entry-login"))'), true);

    // Inject a failed initial cloud read: no stale local PUT is allowed before recovery.
    faults.failReads = 1;
    await login();
    await sleep(1200);
    check('Failed initial cloud read cannot autosave the stale local snapshot', putCount() === 0 && (await state()).discoveredIds.join() === 'tower', { puts: putCount(), state: await state() });
    await s.evaluate('window.dispatchEvent(new Event("online"));true');
    await until(async () => (await state()).discoveredIds.join() === 'beihu', 8000, 'cloud GET recovery');
    check('Online recovery restores the cloud snapshot and independent regions', (await state()).unlockedRegionIds.join() === 'park,beihu', await state());
    await sleep(1000);

    // Hold an old debounced PUT; explicit reset commits memory immediately and waits for its empty PUT.
    await openSettings(); await tab('data');
    faults.holdNextPut = true;
    await s.evaluate(module('/src/app/stores/useSettings.ts') + '.then(m=>m.useSettings.getState().update({zoomLimit:3.5}))');
    await until(() => Boolean(faults.releasePut), 5000, 'older PUT held');
    const beforeResetPuts = putCount();
    await confirm('重置探索进度'); await sleep(300);
    current = await state();
    check('Reset commits empty memory before its cloud write completes', current.discoveredIds.length === 0 && current.unlockedRegionIds.length === 0 && current.settings.zoomLimit === 3.5, current);
    check('Reset waits behind the older cloud write and shows busy feedback', putCount() === beforeResetPuts && await s.evaluate('document.querySelector(".settings-confirm").getAttribute("aria-busy")==="true"'), { puts: putCount(), beforeResetPuts });
    faults.releasePut(); faults.releasePut = null;
    await until(() => s.evaluate('!document.querySelector(".settings-confirm")'), 8000, 'reset cloud completed');
    await sleep(900);
    const resetCloud = await direct('/api/progress', { token: seeded.token });
    check('Serialized reset leaves cloud exploration empty and settings intact', resetCloud.state.discoveredIds.length === 0 && resetCloud.state.unlockedRegionIds.length === 0 && resetCloud.state.settings.zoomLimit === 3.5, resetCloud.state);
    evidence.resetWrites = apiLog.filter(r => r.method === 'PUT').map(({ ids, held, status }) => ({ ids, held, status }));
    await s.screenshot(path.join(out, 'shots', 'reset-cloud-complete.png'));

    await s.navigate(base + '/'); await ready();
    await until(() => s.evaluate('Boolean(document.querySelector(".account-chip"))'), 8000, 'restored session');
    await s.click('.entry-card .enter-campus'); await sleep(300);
    current = await state();
    check('Refresh restores the empty reset and retained controls', current.discoveredIds.length === 0 && current.unlockedRegionIds.length === 0 && current.settings.zoomLimit === 3.5, current);
    await openSettings(); await tab('account'); await clickText('.settings-panel', '退出登录'); await sleep(800);
    check('Logout closes portals, removes token and makes entry interactive', await s.evaluate(`!localStorage.getItem(${JSON.stringify(TOKEN)})&&!document.querySelector(".settings-screen,.menu-screen")&&!document.querySelector(".hud-layer").inert&&Boolean(document.querySelector(".entry-login"))`), true);
    await login();
    check('Re-login retains the reset cloud journey', (await state()).discoveredIds.length === 0 && (await state()).settings.zoomLimit === 3.5, await state());
    await sleep(900);

    // A distinct cloud fixture makes accidental clearing or empty PUTs observable.
    await openSettings(); await tab('data');
    await direct('/api/progress', { method: 'PUT', token: seeded.token, body: { state: cloud } });
    const beforeClearPuts = putCount();
    await confirm('清空本机存档'); await sleep(1400);
    const afterClear = await ordinary();
    check('Clear-local removes both local keys and session without immediately rewriting an empty key', afterClear.save === null && afterClear.legacy === null && afterClear.token === null, afterClear);
    check('Clear-local sends no empty cloud PUT and preserves distinct cloud data', putCount() === beforeClearPuts && (await direct('/api/progress', { token: seeded.token })).state.discoveredIds.join() === 'beihu', { beforeClearPuts, afterClearPuts: putCount() });
    check('Clear-local leaves entry outside inert and all routes closed', await s.evaluate('document.querySelector("[data-testid=game-stage]").dataset.route==="map"&&!document.querySelector(".settings-screen,.menu-screen")&&!document.querySelector(".hud-layer").inert'), true);
    await s.screenshot(path.join(out, 'shots', 'clear-local-cloud-retained.png'));
    await login();
    check('Cloud journey recovers after clearing this browser', (await state()).discoveredIds.join() === 'beihu' && (await state()).unlockedRegionIds.join() === 'park,beihu', await state());

    // Export succeeds with no archive key and includes memory-only independent regions.
    await openSettings(); await tab('data');
    await s.evaluate(`localStorage.removeItem(${JSON.stringify(SAVE)});window.__runtimeOriginalURL=URL.createObjectURL;URL.createObjectURL=b=>{window.__runtimeExport=b;return window.__runtimeOriginalURL(b)};true`);
    await clickText('.settings-panel', '导出 JSON'); await sleep(250);
    const noArchiveExport = await s.evaluate('window.__runtimeExport.text().then(JSON.parse)');
    check('Ordinary export succeeds with no local key using current sanitized memory', noArchiveExport.discoveredIds.join() === 'beihu' && noArchiveExport.unlockedRegionIds.join() === 'park,beihu' && noArchiveExport.playerUV.u === .502, noArchiveExport);

    // A cloud snapshot already read before reset must not restore its old journey when it arrives late.
    faults.holdNextRead = true;
    await s.navigate(base + '/'); await ready();
    await until(() => Boolean(faults.releaseRead), 5000, 'older cloud GET held after reading');
    await s.click('.entry-card .entry-alt'); await sleep(300);
    await openSettings(); await tab('data'); await confirm('重置探索进度');
    await until(() => s.evaluate('!document.querySelector(".settings-confirm")'), 5000, 'reset while cloud restoring');
    faults.releaseRead(); faults.releaseRead = null; await sleep(1000);
    current = await state();
    check('An older delayed cloud GET cannot overwrite an explicit reset', current.discoveredIds.length === 0 && current.unlockedRegionIds.length === 0 && (await direct('/api/progress', { token: seeded.token })).state.discoveredIds.length === 0, current);

    // Discoveries use browser geolocation simulation; the same production validator still gates the commit.
    const apiBeforeQaDiscovery = apiLog.length;
    const archiveBeforeQaDiscovery = await ordinary();
    await s.navigate(base + '/?qa=1&preset=fog'); await ready();
    await until(() => s.evaluate('Boolean(window.__LIYUN__)'), 8000, 'QA discovery bridge');
    await s.evaluate('window.__LIYUN__.setSettings({music:false,uiSound:false,autoDegrade:false,showCinematic:true});window.__LIYUN__.unlockRegion("park");window.__LIYUN__.discover("beihu");true');
    check('QA discover still rejects missing GPS without mutating progress or queue', await s.evaluate('window.__LIYUN__.getState().discoveredIds.length===0&&!window.__LIYUN__.getEvent()&&window.__LIYUN__.getUi().cinematicQueue.length===0'), true);
    await s.call('Browser.grantPermissions', { permissions: ['geolocation'], origin: base });
    const setGps = async id => {
      const geo = await s.evaluate(`${module('/src/location/campus.ts')}.then(m=>{const p=m.campusLandmarks.find(p=>p.id===${JSON.stringify(id)});return {latitude:p.latitude,longitude:p.longitude,accuracy:5}})`);
      await s.call('Emulation.setGeolocationOverride', geo);
    };
    await setGps('beihu'); await s.click('.location-primary');
    await until(() => s.evaluate('document.querySelector(".location-controls")?.dataset.status==="tracking"'), 8000, 'simulated browser GPS tracking');
    await s.evaluate('window.__LIYUN__.select("beihu");true'); await sleep(300);
    check('Real check-in button enables only after valid simulated browser GPS', await s.evaluate('!document.querySelector("[data-testid=check-in-button]").disabled'), true);
    await s.click('[data-testid=check-in-button]');
    const discovery = await s.evaluate('({state:window.__LIYUN__.getState(),event:window.__LIYUN__.getEvent(),ui:window.__LIYUN__.getUi(),cinematic:!!document.querySelector("[data-testid=cinematic-screen]")})');
    check('Valid discovery commits progress and independent region before the 3.2s prelude', discovery.state.discoveredIds.join() === 'beihu' && discovery.state.unlockedRegionIds.join() === 'park,beihu' && discovery.event.duration === 3200 && !discovery.cinematic && discovery.ui.cinematicQueue[0].availableAt - discovery.event.startedAt === 3200, discovery);
    await until(() => s.evaluate('Boolean(document.querySelector("[data-testid=cinematic-screen]"))'), 7000, 'cinematic after prelude');
    const beforeSkip = await state();
    await s.screenshot(path.join(out, 'shots', 'discovery-cinematic.png'));
    await s.call('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
    await s.call('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
    await until(() => s.evaluate('!document.querySelector("[data-testid=cinematic-screen]")'), 5000, 'cinematic skip');
    check('Skipping a cinematic changes neither exploration nor independent regions', JSON.stringify(await state()) === JSON.stringify(beforeSkip), await state());
    await setGps('teaching'); await sleep(300);
    await s.evaluate('window.__LIYUN__.discover("teaching");true'); await sleep(150);
    const quick = await s.evaluate('window.__LIYUN__.getUi().cinematicQueue');
    check('A consecutive discovery queues the quick presentation', quick.length === 1 && quick[0].contentId === 'teaching' && quick[0].quick === true && (await state()).discoveredIds.length === 2, quick);
    await s.evaluate('window.__LIYUN__.setSettings({showCinematic:false});true'); await sleep(150);
    check('Disabling cinematic clears queued presentation and retains committed discoveries', await s.evaluate('window.__LIYUN__.getUi().cinematicQueue.length===0&&window.__LIYUN__.getState().discoveredIds.length===2'), true);
    await sleep(3300);
    check('Disabled cinematic does not reappear after the prelude', await s.evaluate('!document.querySelector("[data-testid=cinematic-screen]")'), true);
    await s.evaluate('window.__LIYUN__.setSettings({showCinematic:true,reducedMotion:true});true');
    await setGps('sports'); await sleep(300); await s.evaluate('window.__LIYUN__.discover("sports");true');
    await until(() => s.evaluate('Boolean(document.querySelector("[data-testid=cinematic-screen]"))'), 4000, 'reduced cinematic');
    await until(() => s.evaluate('document.querySelector("[data-testid=cinematic-screen]")?.dataset.timelineReady==="true"'), 4000, 'reduced timeline initialized');
    check('Reduced-motion discovery has a 0.4s prelude and <=1.2s actual GSAP timeline', await s.evaluate('window.__LIYUN__.getEvent()?.duration===400&&Number(document.querySelector("[data-testid=cinematic-screen]").dataset.timelineDuration)<=1.2'), await s.evaluate('({...document.querySelector("[data-testid=cinematic-screen]").dataset})'));
    await sleep(1300);
    const still = () => s.evaluate('JSON.stringify([...document.querySelector("[data-testid=cinematic-screen]").querySelectorAll("[data-cinema-hero],[data-cinema-copy],[data-cinema-art]")].map(e=>e.getAttribute("style")))');
    const firstStill = await still(); await sleep(300);
    check('Reduced-motion timeline retains a stable readable terminal frame with focus inside', firstStill === await still() && await s.evaluate('document.querySelector("[data-testid=cinematic-screen]").contains(document.activeElement)'), firstStill);
    const beforeReducedContinue = await state();
    await s.call('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
    await s.call('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
    await until(() => s.evaluate('!document.querySelector("[data-testid=cinematic-screen]")'), 4000, 'reduced cinematic continues');
    check('Space leaves the reduced terminal frame without changing the saved journey', JSON.stringify(await state()) === JSON.stringify(beforeReducedContinue), await state());
    check('QA discovery, regions and cinematic never touch ordinary archive or cloud', apiLog.length === apiBeforeQaDiscovery && JSON.stringify(await ordinary()) === JSON.stringify(archiveBeforeQaDiscovery), { apiBeforeQaDiscovery, apiAfter: apiLog.length, archive: await ordinary() });
    evidence.discovery = await state();

    const unexpected = s.errors.filter(e => !e.includes('HTTP 503:') && !e.includes('Failed to load resource: the server responded with a status of 503'));
    check('No unexpected browser exception or request failure', unexpected.length === 0, unexpected);
    evidence.mode = 'Owned temporary headless Edge; synthetic SQLite API; CDP native inputs; simulated browser GPS, not field GPS';
    evidence.presentationDecision = '5.2s normal / <=1.2s reduced measure the animation timeline. The terminal story frame stays readable until Continue, any click, Escape or Space.';
    evidence.api = apiLog;
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ ok: true, checks, evidence, errors: s.errors }, null, 2));
    console.log(JSON.stringify({ ok: true, passed: checks.length, expectedInjectedFailures: 1 }));
  } catch (error) {
    await s?.screenshot(path.join(out, 'shots', 'failure.png')).catch(() => {});
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ ok: false, error: String(error.stack || error), checks, evidence, api: apiLog, errors: s?.errors }, null, 2));
    console.error(String(error.stack || error)); process.exitCode = 1;
  } finally {
    faults.releasePut?.();
    faults.releaseRead?.();
    await s?.close();
    if (server) await new Promise(resolve => server.close(resolve));
    store?.close();
    if (temporary && path.resolve(temporary).startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(temporary).startsWith('liyun-app-runtime-')) fs.rmSync(temporary, { recursive: true, force: true });
  }
})();
