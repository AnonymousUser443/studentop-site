import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as wait } from 'node:timers/promises';
import { io } from 'socket.io-client';
import { createTestShow } from '../server/test-show.mjs';
import deliveryImages from '../src/content/delivery-images.json' with { type: 'json' };

const root = fileURLToPath(new URL('..', import.meta.url));
const deck = JSON.parse(await readFile(join(root, 'src/content/deck.json'), 'utf8'));
const base = (process.env.REVIEW_URL ?? 'http://127.0.0.1:5196').replace(/\/$/, '');
const basePath = new URL(base).pathname.replace(/\/$/, '');
const pin = process.env.REVIEW_PIN;
const audioFormat = process.argv.includes('--aac') ? 'm4a' : 'opus';
if (process.argv.includes('--review-flow') && !pin) throw new Error('--review-flow requires a disposable server and REVIEW_PIN');
const fixture = process.argv.includes('--review-flow') ? await createTestShow(base, pin, '三端实播验收') : null;
const roomApi = fixture ? base + '/api/rooms/' + fixture.show.id : null;
const chrome = process.env.REVIEW_CHROMIUM ?? 'C:/Users/12929/.cache/hyperframes/chrome/chrome-headless-shell/win64-152.0.7977.30/chrome-headless-shell-win64/chrome-headless-shell.exe';
const output = join(root, '验收');
const storyLedger = JSON.parse(await readFile(join(output,'场景制作清单.json'),'utf8'));
const sceneBeats = new Map(storyLedger.beats.filter(beat=>beat.scene).map(beat=>[beat.id,beat.scene]));
await mkdir(output, {recursive: true});
const temp = resolve(tmpdir());
const profile = await mkdtemp(join(temp, 'zhuiguangzhe-review-'));
const browser = spawn(chrome, [
  '--no-sandbox', '--no-first-run', '--no-proxy-server', '--disable-background-networking', '--disable-component-update',
  `--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE ${new URL(base).hostname}`, '--remote-debugging-pipe',
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--user-data-dir=${profile}`,
], {stdio:['ignore','ignore','pipe','pipe','pipe'], windowsHide:true});
let processError;
browser.on('error', (error) => { processError = error; });
let tail = '';
browser.stderr.on('data', (chunk) => { tail = (tail + chunk).slice(-2400); });
let counter = 0;
let buffer = Buffer.alloc(0);
const pending = new Map();
const errors = [];
browser.stdio[4].on('data', (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  for (let end; (end = buffer.indexOf(0)) !== -1;) {
    const message = JSON.parse(buffer.subarray(0, end).toString('utf8'));
    buffer = buffer.subarray(end + 1);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    const request = pending.get(message.id);
    if (request) request(message);
  }
});

function send(method, params = {}, sessionId) {
  if (processError) throw processError;
  const id = ++counter;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(processError ?? new Error(`${method} timed out\n${tail}`)); }, 12000);
    pending.set(id, (message) => {
      pending.delete(id);
      clearTimeout(timer);
      if (message.error) reject(new Error(`${method}: ${message.error.message}`));
      else resolve(message.result);
    });
    browser.stdio[3].write(`${JSON.stringify({id, method, params, sessionId})}\0`);
  });
}

async function tab(width, height, browserContextId) {
  const {targetId} = await send('Target.createTarget', {url:'about:blank', ...(browserContextId ? {browserContextId} : {})});
  const {sessionId} = await send('Target.attachToTarget', {targetId, flatten:true});
  const call = (method, params) => send(method, params, sessionId);
  await call('Page.enable');
  await call('Runtime.enable');
  await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  const systemMotion = process.argv.includes('--browser-compat') ? 'reduce' : 'no-preference';
  await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:systemMotion}]});
  const evalJS = async (expression) => {
    const result = await call('Runtime.evaluate', {expression, awaitPromise:true, returnByValue:true});
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const until = async (expression, seconds = 12) => {
    const deadline = Date.now() + seconds * 1000;
    while (Date.now() < deadline) {
      try { if (await evalJS('Boolean(' + expression + ')')) return; }
      catch (error) { if (!/context|navigat/i.test(String(error))) throw error; }
      await wait(80);
    }
    const state = await evalJS(`({url:location.href,slide:document.querySelector('[data-page-id]')?.dataset.pageId,ready:document.querySelector('.animated-slide')?.dataset.ready,transition:document.querySelector('.deck-host')?.dataset.transition,debug:document.querySelector('.display-debug')?.textContent,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches})`).catch(()=>null);
    throw new Error(`等待超时 ${expression}: ${JSON.stringify(state)} ${errors.slice(-2).join(' | ')}`);
  };
  return {
    async load(route, selector, seconds = 12, useFixture = true) {
      const target = new URL(base + route);
      if (useFixture && fixture && !target.searchParams.has('preview') && !target.searchParams.has('rehearsal') && !target.searchParams.has('manage') && target.searchParams.get('role') !== 'gallery') target.searchParams.set('show', fixture.show.id);
      const url = target.href;
      const navigation = await call('Page.navigate', {url});
      if (navigation.errorText) throw new Error(`${url}: ${navigation.errorText}`);
      await until(`location.href === ${JSON.stringify(url)} && document.querySelector(${JSON.stringify(selector)}) !== null`, seconds);
      await evalJS('Promise.allSettled([document.fonts.ready, ...[...document.images].map(im=>im.decode())]).then(()=>true)');
    },
    until,
    eval: evalJS,
    scriptOnLoad: source => call('Page.addScriptToEvaluateOnNewDocument', {source}),
    async key(key, code) {
      // Exercise the application's shortcut without depending on headless OS focus.
      await call('Runtime.evaluate', {expression:`document.body.dispatchEvent(new KeyboardEvent('keydown',${JSON.stringify({key,code,bubbles:true,cancelable:true})}))`,userGesture:true});
    },
    async click(selector) {
      const {x,y} = await evalJS('(()=>{const r=document.querySelector(' + JSON.stringify(selector) + ').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()');
      await call('Input.dispatchMouseEvent', {type:'mousePressed',button:'left',clickCount:1,x,y});
      await call('Input.dispatchMouseEvent', {type:'mouseReleased',button:'left',clickCount:1,x,y});
    },
    async navigate(direction) {
      const label = direction === 'prev' ? '上一页' : '下一页或开始';
      await evalJS(`document.querySelector(${JSON.stringify(`.display-toolbar button[aria-label="${label}"]`)}).click()`);
    },
    async offline(value) {
      await call('Network.enable');
      await call('Network.emulateNetworkConditions', {offline:value, latency:0, downloadThroughput:-1, uploadThroughput:-1});
    },
    async shot(path) {
      const format = path.endsWith('.jpg') ? 'jpeg' : 'png';
      const {data} = await call('Page.captureScreenshot',{format,quality:format==='jpeg'?84:undefined,captureBeyondViewport:false});
      await writeFile(join(output,path),Buffer.from(data,'base64'));
    },
    close: () => send('Target.closeTarget',{targetId}),
  };
}

const quality = `(() => ({
  ids: [...document.querySelectorAll('.production-slide[data-page-id],.story-stage[data-page-id]')].map(node=>node.dataset.pageId),
  scenes: [...document.querySelectorAll('.story-stage')].map(node=>({id:node.dataset.pageId,scene:node.dataset.storyScene,beat:node.dataset.storyBeat})),
  art: Object.fromEntries([...document.querySelectorAll('.production-slide[data-page-id]')].map(node=>[node.dataset.pageId,node.querySelector('img[data-production-art]')?.getAttribute('src') ?? null])),
  missing: [...document.images].filter(im=>!im.naturalWidth).map(im=>im.getAttribute('src')),
  overflow: [...document.querySelectorAll('.production-slide[data-page-id],.story-stage[data-page-id]')].flatMap(slide=>{
    const edge=slide.getBoundingClientRect();
    return [...slide.querySelectorAll('.prod-cover-copy h1,.prod-cover-copy p,.prod-block,.prod-media-copy p,[data-reveal],.ti-token-plate,.photo-gallery .photo,.comic-strip .photo,.prod-media-items .photo,.video-scene,[data-story-copy] p')].flatMap(node=>{
      const rect=node.getBoundingClientRect(), factor=edge.width/1920;
      const visible=getComputedStyle(node).visibility!=='hidden'&&Number(getComputedStyle(node).opacity)>.01&&!node.closest('[data-alpha="0"]');
      const leak=visible&&rect.width>0&&rect.height>0&&(rect.left<edge.left+28*factor||rect.right>edge.right-28*factor||rect.top<edge.top+25*factor||rect.bottom>edge.bottom-25*factor);
      return leak ? [{id:slide.dataset.pageId,text:node.textContent.slice(0,100)}] : [];
    });
  })
}))()`;

const sheets = [];
const samples = [];
const individuals = [];
const flow = [];
try {
  if (process.argv.includes('--all')) {
    const page = await tab(1680, 1200);
    for (let i = 0; i < Math.ceil(deck.length / 12); i++) {
      await page.load(`/?role=gallery&proof=1&sheet=${i}`, '.gallery-frame');
      const check = await page.eval(quality);
      if (check.ids.join(',') !== deck.slice(i*12, (i+1)*12).map(item=>item.id).join(',')) throw new Error(`联系表 ${i+1} 页序不一致`);
      const image = `联系表-${String(i+1).padStart(2,'0')}.png`;
      await page.shot(image);
      sheets.push({...check,image});
    }
    await page.close();
  }
  if (process.argv.includes('--individual')) {
    await mkdir(join(output,'逐页'), {recursive:true});
    const page = await tab(1280,720);
    for (const {id} of deck) {
      await page.load(`/?preview=${id}&clean=1&motion=off`, `[data-page-id="${id}"]`);
      const check = await page.eval(quality);
      const image = `逐页/${id}.jpg`;
      await page.shot(image);
      individuals.push({...check,image});
    }
    await page.close();
  }
  const targets = process.argv.slice(2).filter((arg) => /^P[0-8]-\d\d$/.test(arg));
  const page = await tab(1440, 810);
  for (const id of targets) {
    const live = process.argv.includes('--live');
    await page.load(`/?preview=${id}&clean=1${live?'':'&motion=off'}`, `[data-page-id="${id}"]`);
    if (live) {
      await page.until(`document.querySelector('.animated-slide')?.dataset.ready === 'true'`, 24);
      const tiExtra = { 'P5-01': 1100, 'P5-06': 5600, 'P5-07': 2100, 'P5-19': 1400 };
      if (tiExtra[id]) await wait(tiExtra[id]);
    }
    const check = await page.eval(quality);
    const mode = await page.eval(`document.querySelector('[data-ti-mode]')?.dataset.tiMode ?? null`);
    const image = `${id}${live?'-动效':''}.png`;
    await page.shot(image);
    samples.push({...check,image,mode});
  }
  if (process.argv.includes('--story-flow')) {
    const continuity=[];
    for (const scene of storyLedger.scenes) {
      const first=scene.beats[0],next=scene.beats[1];
      if (!next) continue;
      await page.load(`/?preview=${first}&clean=1`, `[data-page-id="${first}"]`);
      await page.until(`document.querySelector('.animated-slide')?.dataset.ready === 'true'`);
      await page.eval(`window.__storyBefore=document.querySelector('[data-story-scene]');window.__actorBefore=document.querySelector('[data-perform]');true`);
      await page.navigate('next');
      await page.until(`!!document.querySelector('[data-page-id="${next}"]')`);
      await page.until(`document.querySelector('.animated-slide')?.dataset.ready === 'true'`);
      const same=await page.eval(`({root:window.__storyBefore===document.querySelector('[data-story-scene]'),actor:window.__actorBefore===document.querySelector('[data-perform]'),actors:[...document.querySelectorAll('[data-perform]')].length})`);
      if (!same.root||!same.actor) throw new Error(`${scene.id} 同场景对象被重新挂载`);
      await page.navigate('prev');
      await page.until(`!!document.querySelector('[data-page-id="${first}"]')`);
      await page.until(`document.querySelector('.animated-slide')?.dataset.ready === 'true'`);
      const returned=await page.eval(`window.__storyBefore===document.querySelector('[data-story-scene]')`);
      if(!returned) throw new Error(`${scene.id} 回退重挂载`);
      continuity.push({scene:scene.id,from:first,to:next,same,returned});
    }
    await writeFile(join(output,'场景连续播放核验.json'),JSON.stringify({count:continuity.length,continuity,errors},null,2));
    flow.push(`${continuity.length} 个场景前进回退、对象持续挂载和有限时间轴就绪`);
  }
  if (process.argv.includes('--flow')) {
    await page.load('/?preview=P0-01&clean=1', '[data-page-id="P0-01"]');
    await page.until(`document.querySelector('.animated-slide')?.dataset.ready === 'true'`);
    await page.navigate('next');
    await page.until(`document.querySelector('[data-page-id="P0-02"]') && document.querySelector('.animated-slide')?.dataset.ready === 'true'`);
    const opened = await page.eval(`(()=>{const art=document.querySelector('.s0-welcome-lanyan img');const left=document.querySelector('.s0-curtain-left');return art?.naturalWidth>0 && art.getBoundingClientRect().bottom<=document.querySelector('.story-stage').getBoundingClientRect().bottom && left?.getBoundingClientRect().right<350;})()`);
    if (!opened) throw new Error('开幕布或蓝砚落位异常');
    flow.push('P0-01 → P0-02 纸帘让位、透明蓝砚完整落位');

    await page.load('/?preview=P5-03&clean=1', '[data-page-id="P5-03"]');
    await page.until(`document.querySelector('.animated-slide')?.dataset.ready === 'true'`);
    await page.eval(`window.__tiRotor=document.querySelector('.s5-rotor');true`);
    for (const id of ['P5-04','P5-05']) {
      await page.navigate('next');
      await page.until(`document.querySelector('[data-page-id="${id}"]') && document.querySelector('.animated-slide')?.dataset.ready === 'true'`);
    }
    const rotated = await page.eval(`(()=>{const rotor=document.querySelector('.s5-rotor');return rotor===window.__tiRotor && rotor?.dataset.rotate==='120' && Math.abs(new DOMMatrixReadOnly(getComputedStyle(rotor).transform).b)>.75;})()`);
    if (!rotated) throw new Error('Ti 计算核心未连续转入加速节拍');
    flow.push('P5-03 → P5-05 输入线路接入，同一计算核心旋转加速');

    await page.load('/?preview=P4-24&clean=1&debug=1', '[data-page-id="P4-24"]');
    await page.until(`document.querySelector('.animated-slide')?.dataset.ready === 'true'`);
    await page.navigate('next');
    await page.until(`document.querySelector('.deck-host')?.dataset.transition === 'blackout'`);
    await page.until(`!!document.querySelector('[data-page-id="P5-01"]')`);
    await page.until(`document.querySelector('.animated-slide')?.dataset.ready === 'true'`);
    flow.push('P4-24 → P5-01 黑场换章');
    await page.key('ArrowRight', 'ArrowRight');
    await page.until(`!!document.querySelector('[data-page-id="P5-02"]')`);
    flow.push('Ti 章内连续翻页');
    await page.load('/?preview=P1-07&clean=1&motion=off', 'video');
    await page.until(`document.querySelector('video')?.readyState >= 1`);
    const duration = await page.eval(`document.querySelector('video').duration`);
    if (!Number.isFinite(duration) || duration < 1) throw new Error('真实视频元数据异常');
    await page.key('v', 'KeyV');
    await page.until(`document.querySelector('video')?.currentTime > 0.1`);
    await page.key('v', 'KeyV');
    await page.until(`document.querySelector('video')?.paused === true`);
    flow.push(`真实校园视频开始、暂停，${duration.toFixed(1)} 秒`);
  }
  if (process.argv.includes('--offline')) {
    await page.load('/?rehearsal=1&debug=1', '.loading-paper');
    await page.until(`document.querySelector('.loading-progress')?.textContent.includes('纸面已备好')`, 160);
    await page.until(`navigator.serviceWorker.controller !== null`, 25);

    await page.offline(true);
    await page.navigate('next');
    await page.until('document.querySelector("[data-page-id=P0-02]") && document.querySelector(".animated-slide")?.dataset.ready === "true"');
    await page.navigate('next');
    await page.until('document.querySelector("[data-page-id=P0-03]") && document.querySelector(".animated-slide")?.dataset.ready === "true"');
    await page.eval('document.querySelector("[aria-label=节目单]").click()');
    await page.until('document.querySelector(".navigator-layout aside button:last-child")');
    await page.eval('document.querySelector(".navigator-layout aside button:last-child").click(); true');
    const lastPageButton = 'Array.from(document.querySelectorAll(".navigator-gallery-grid button")).find(button=>button.querySelector("span.mono")?.textContent==="P8-20")';
    await page.until('Boolean(' + lastPageButton + ')');
    await page.eval(lastPageButton + '.click(); true');
    await page.until('document.querySelector("[data-page-id=P8-20]") && document.querySelector(".animated-slide")?.dataset.ready === "true"');
    flow.push('断网后从舞台准备页开场、翻页及节目单跳到散场私信页');
    await page.load('/?preview=P6-01&clean=1&motion=off', '[data-page-id="P6-01"]');
    const check = await page.eval(quality);
    if (check.missing.length || !check.art['P6-01']) throw new Error('离线重载未命中章首素材');
    await page.shot('P6-01-离线.png');
    for (const id of ['P1-07', 'P2-13', 'P5-16']) {
      await page.load('/?preview=' + id + '&clean=1&motion=on','video');
      await page.until('document.querySelector(".animated-slide")?.dataset.ready === "true" && document.querySelector("video")?.readyState >= 2');
      await page.key('v','KeyV');
      await page.until('document.querySelector("video")?.currentTime > .2');
      await page.eval('document.querySelector("video").currentTime = document.querySelector("video").duration * .8; true');
      await page.until('!document.querySelector("video")?.seeking && document.querySelector("video")?.readyState >= 2');
      await page.shot(id + "-离线播放.png");
    }
    flow.push('完整预加载后断网重载，章首图及三段视频的动效后播放、拖动进度通过');
    await page.offline(false);
  }


  if (process.argv.includes('--browser-compat')) {
    await page.load('/?preview=P3-05', '[data-photo-archive]');
    await page.until('matchMedia("(prefers-reduced-motion:reduce)").matches && document.documentElement.dataset.motion==="on" && parseFloat(getComputedStyle(document.querySelector(".photo-archive-dimmer")).opacity)>.45');
    await page.until('document.querySelector(".animated-slide").dataset.ready==="true"', 24);
    await page.until('getComputedStyle(document.querySelector(".photo-archive-dimmer")).opacity==="0"', 24);
    await page.key('h','KeyH');
    if (!(await page.eval('["提词器","观众扫码","画册"].every(label=>{const node=document.querySelector(".display-toolbar [aria-label="+JSON.stringify(label)+"]");return node.querySelector("svg") && node.textContent.trim()===""})'))) throw new Error('舞台底栏入口未使用纯图标');
    await page.until('getComputedStyle(document.querySelector(".display-toolbar")).opacity==="1"');
    await page.shot('舞台图标操作栏.png');
    await page.click('.display-toolbar [aria-label="观众扫码"]');
    await page.until('document.querySelector(".show-qr-stage img")?.naturalWidth>0');
    await page.key('Escape','Escape');
    await page.load('/?preview=P3-05&motion=off', '.photo-archive-card');
    if (!(await page.eval('document.documentElement.dataset.motion==="off" && document.querySelector(".story-static") && getComputedStyle(document.querySelector(".photo-archive-dimmer")).opacity==="0" && getComputedStyle(document.querySelector(".photo-archive-card")).transform==="none"'))) throw new Error('显式静帧模式仍有照片动效');
    flow.push('系统设置减少动态时默认仍演出照片放大归位；显式静帧正常；底栏图标可点开二维码');
  }
  if (process.argv.includes('--extras')) {
    await page.load('/?preview=P0-01&motion=on', '[data-page-id="P0-01"]');
    await page.key('q','KeyQ');
    await page.until('document.querySelector(".show-qr-stage img")?.naturalWidth > 500');
    await page.shot('观众扫码-舞台.png');
    await page.key('Escape','Escape');
    await page.until('!document.querySelector(".show-qr-stage")');
    flow.push('舞台 Q 键显示清晰的正式观众二维码，Esc 收起');
  }
  if (process.argv.includes('--review-flow')) {

    const namespace = new URL(base).origin + '/show-' + fixture.show.id;
    const controller = io(namespace, { path: basePath + '/socket.io', transports: ['websocket'], timeout: 8000, reconnection: false });
    const {browserContextId} = await send('Target.createBrowserContext');
    const viewer = await tab(390, 844, browserContextId);
    const manager = await tab(1200, 820);
    const entered = id => 'document.querySelector(' + JSON.stringify('.animated-slide [data-page-id="' + id + '"]') + ') !== null';
    const readyAt = id => entered(id) + ' && document.querySelector(".animated-slide")?.dataset.ready === "true"';
    const input = (selector, value) => '(()=>{const field=document.querySelector(' + JSON.stringify(selector) + ');Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field),"value").set.call(field,' + JSON.stringify(value) + ');field.dispatchEvent(new Event("input",{bubbles:true}));return true})()';
    const control = async (event, payload) => {
      const result = await controller.timeout(8000).emitWithAck(event, payload);
      if (!result?.ok) throw new Error(event + ': ' + JSON.stringify(result));
      return result;
    };
    const go = id => control('control', { action:'go', pageId:id });
    try {
      if (!controller.connected) await once(controller, 'connect');
      await control('join', { role:'presenter', visitorId:'review-cdp-presenter' });
      await control('authenticate', { pin });
      await page.scriptOnLoad("window.__fiMusic = [];\nfor (const action of ['start','stop']) {\n  const original = AudioBufferSourceNode.prototype[action];\n  AudioBufferSourceNode.prototype[action] = function(...args) {\n    const duration = this.buffer?.duration || 0;\n    if (window.__probeFi && duration > 30) window.__fiMusic.push(action);\n    return original.apply(this, args);\n  };\n}");
      if (audioFormat === 'm4a') await page.scriptOnLoad(`
        const canPlayType = HTMLMediaElement.prototype.canPlayType;
        HTMLMediaElement.prototype.canPlayType = function (type) {
          return /opus/i.test(type) ? '' : canPlayType.call(this, type);
        };
      `);
      await page.load('/?role=display&debug=1', '.loading-paper');
      await page.until('document.querySelector("[role=progressbar]")?.getAttribute("aria-valuenow")==="100" && document.querySelector(".loading-progress").textContent.includes("纸面已备好")', 210);
      await page.navigate('next');
      await page.until('document.querySelector("#control-pin")');
      await page.eval(input('#control-pin', pin));
      await page.eval('document.querySelector(".auth-panel").requestSubmit()');
      await page.until('!document.querySelector(".auth-panel")');
      await page.navigate('next');
      await page.until(entered('P0-01'));
      await page.eval('window.__drape=document.querySelector(".s0-curtain-left"); true');
      await page.until(entered('P0-02'));
      const drapeMoving = await page.eval('(()=>{const drape=document.querySelector(".s0-curtain-left");return drape===window.__drape&&drape.getBoundingClientRect().right>380;})()');
      if (!drapeMoving) throw new Error('正式开幕没有保留移动中的帷幕');
      await page.until(readyAt('P0-02'));
      flow.push('正式放映预载到 100%，帷幕同节点从准备页状态拉开');
      await page.eval('(()=>{const host=document.querySelector(".deck-host");for(const [event,x] of [["pointerdown",660],["pointerup",490]])host.dispatchEvent(new PointerEvent(event,{pointerId:41,pointerType:"touch",isPrimary:true,clientX:x,clientY:250,bubbles:true}));return true})()');
      await page.until(readyAt('P0-03'));
      await page.eval('document.querySelector("[aria-label=节目单]").click()');
      await page.until('document.querySelector(".navigator-thumbnail [data-page-id=P0-03]")');
      await page.eval('document.querySelector(".navigator-gallery-grid button.current").click()');
      flow.push('舞台左滑可翻页，节目单显示可点击的实际缩略图');


      await viewer.load('/?role=audience', '#room-code', 12, false);
      await viewer.eval(input('#room-code', fixture.show.id));
      await viewer.eval('document.querySelector(".room-entry-form").requestSubmit()');
      await viewer.until('document.querySelector(".audience-assets") || document.querySelector(".audience-meter")', 24);
      await viewer.until('document.querySelector(".audience-meter")', 210);
      if (!(await viewer.eval('(()=>{const node=document.querySelector(".audience-landscape");const frame=node.querySelector(".stage-frame").getBoundingClientRect();return Math.abs(frame.width/frame.height-16/9)<.01 && frame.width<=innerWidth+1 && getComputedStyle(node).transform==="none"})()'))) throw new Error('手机竖放时观众画面未保持横向 16:9');
      await viewer.offline(true);
      const audienceFilms = await viewer.eval('Promise.all(["genshin-campus.mp4","liyunculture-club.mp4","ai-wiring-lab.mp4"].map(name=>fetch("assets/video/"+name,{headers:{Range:"bytes=0-1023"}}).then(async response=>[response.status,(await response.arrayBuffer()).byteLength])))');
      if (audienceFilms.some(([status,size])=>status!==206||size!==1024)) throw new Error('观众独立预下载未缓存全部三段影片');
      await viewer.offline(false);
      flow.push('观众空缓存初始化完成全部资源预下载，断网可读取三段视频的缓存分段');
      await viewer.scriptOnLoad(`
        const nativePlay = HTMLMediaElement.prototype.play;
        HTMLMediaElement.prototype.play = function (...args) {
          if (window.__blockFilmAutoplay && this.muted && !navigator.userActivation.isActive) {
            return Promise.reject(new DOMException('Test webview gesture policy', 'NotAllowedError'));
          }
          return nativePlay.apply(this, args);
        };
      `);
      await viewer.load('/?role=audience', '.audience-meter');
      await viewer.until('document.querySelector(".audience-meter").textContent.includes("ms")');
      flow.push('输入六位场次号即可进入，刷新恢复同一观众身份，手机竖持时画面保持 16:9 横向');

      await go('P0-08');
      await viewer.until('document.querySelector(".audience-interaction textarea")');
      await viewer.eval(input('textarea', '人工复核·北湖'));
      await viewer.eval('document.querySelector(".audience-interaction form").requestSubmit()');
      await viewer.until('document.querySelector(".audience-submitted")');
      await page.until(readyAt('P0-08'));
      await page.until('document.querySelector(".s0-campus-note")?.textContent.includes("人工复核·北湖") && !document.querySelector(".s0-campus canvas")');
      await go('P0-10');
      await viewer.until(entered('P0-10'));
      await page.until(readyAt('P0-10'));
      if (!(await page.eval('document.querySelectorAll(".s0-impression img").length===3 && [...document.querySelectorAll(".s0-impression img")].every(img=>img.naturalWidth>0)'))) throw new Error('P0-10 缺失独立表情');
      await go('P1-03');
      await viewer.until('document.querySelector(".private-promise")');
      await wait(3050);
      await viewer.eval(input('textarea', '此为私密验收信，不得上屏'));
      await viewer.eval('document.querySelector(".audience-interaction form").requestSubmit()');
      await viewer.until('document.querySelector(".audience-submitted")');
      await page.until(readyAt('P1-03'));
      await page.until('!document.querySelector(".animated-slide")?.textContent.includes("此为私密验收信") && !document.querySelector(".animated-slide .qr-code")');
      const state = await fetch(roomApi + '/state').then(response => response.json());
      if (state.privateCount !== 1) throw new Error('私密信计数未递增');
      flow.push('两处自动弹出互动，公开留言真实上墙，私密信只递增计数');

      for (const id of ['P1-07', 'P2-13', 'P5-16']) {
        await go(id);
        await page.until(readyAt(id));
        await viewer.until(entered(id));
        if (id === 'P2-13') await viewer.eval('window.__blockFilmAutoplay=true');
        await page.key('v', 'KeyV');
        await page.until('(()=>{const v=document.querySelector("video");return v.currentTime>.2 && v.videoWidth>0 && v.getVideoPlaybackQuality().totalVideoFrames>0})()', 20);
        if (id === 'P2-13') {
          await viewer.until('document.querySelector(".audience-film-play") && document.querySelector("video").paused');
          await viewer.click('.audience-film-play');
          await viewer.until('!document.querySelector(".audience-film-play")');
          await viewer.eval('window.__blockFilmAutoplay=false');
        }
        await viewer.until('(()=>{const v=document.querySelector("video");return v.muted && !v.paused && v.currentTime>.2 && v.getVideoPlaybackQuality().totalVideoFrames>0 && v.hasAttribute("playsinline") && v.hasAttribute("webkit-playsinline") && v.getAttribute("x5-video-player-type")==="h5-page"})()', 20);
        await page.key('v', 'KeyV');
        await viewer.until('document.querySelector("video")?.paused===true');
      }


      flow.push('三段视频动效后实测解码并播放／暂停；观众端静音跟随，模拟 WebView 拒绝自动播放后可点按恢复');
      await page.key('m', 'KeyM');
      await page.key('m', 'KeyM');
      const playedTrack = track => 'performance.getEntriesByType("resource").some(entry=>entry.initiatorType==="xmlhttprequest" && entry.name.endsWith(' + JSON.stringify('/audio/bgm/' + track + '.' + audioFormat) + '))';
      await page.eval('window.__probeFi=true; performance.clearResourceTimings()');
      await go('P4-01');
      await page.until(readyAt('P4-01'));
      await page.until(playedTrack('p4') + ' && window.__fiMusic.includes("start")');
      await go('P5-16');
      await page.until(readyAt('P5-16'));
      await page.eval('window.__fiMusic=[]; performance.clearResourceTimings()');
      await go('P8-04');
      await page.until(readyAt('P8-04'));
      await page.until(playedTrack('p8') + ' && window.__fiMusic.includes("start")');
      flow.push('Te 与 Fi 新音轨均实际解码播放（' + audioFormat + '）');
      const fiBefore = await page.eval('window.__fiMusic.slice()');
      await go('P8-05');
      await page.until(readyAt('P8-05'));
      await go('P8-06');
      await page.until(readyAt('P8-06'));
      const fiAfter = await page.eval('window.__fiMusic.slice()');
      if (JSON.stringify(fiBefore) !== JSON.stringify(fiAfter)) throw new Error('P8-05 途中 BGM 被停止或重启：' + fiAfter.join(','));
      flow.push('P8-04 → P8-05 → P8-06 同一 Fi BGM 播放源连续，停顿间无停止或重启');
      await go('P8-19');
      await page.until(readyAt('P8-19'));
      if ((await page.eval('document.querySelector(".s678-farewell-title").textContent')).match(/[0-9]{10}/)) throw new Error('谢幕仍显示学号');
      await control('control', {action:'next'});
      await page.until(readyAt('P8-20'));
      await viewer.until('Boolean(document.querySelector(".audience-letter-lanyan")?.naturalWidth && document.querySelector("textarea"))');
      await viewer.eval(input('textarea', '给学长的离场私信。'));
      await viewer.eval('document.querySelector(".audience-interaction form").requestSubmit()');
      await viewer.until('document.querySelector(".audience-submitted")');
      await page.until('document.querySelector(".s678-postshow-count")?.textContent.includes("1")');
      if ((await page.eval('document.body.innerText')).includes('给学长的离场私信')) throw new Error('私信出现在舞台');

      flow.push('谢幕无学号，下一页自动邀请私信，手机投递、大屏只显示数量');
      if (process.argv.includes('--extras')) {
        const fixtures = [];
        try {
          for (let i = 0; i < 3; i++) {
            const entry = await fetch(roomApi + '/entry', {
              method:'POST', headers:{'Content-Type':'application/json'},
              body:JSON.stringify({name:'抽签测试 '+i,studentNumber:String(99999130+i)}),
            });
            const cookie = entry.headers.get('set-cookie')?.split(';')[0];
            if (!entry.ok || !cookie) throw new Error('抽签测试观众入场失败');
            const peer = io(namespace, {path:basePath+'/socket.io',transports:['websocket'],reconnection:false,extraHeaders:{Cookie:cookie}});
            fixtures.push(peer);
            await once(peer,'connect');
            const joined = await peer.timeout(6000).emitWithAck('join',{role:'audience'});
            if (!joined.admitted) throw new Error('抽签测试未获得观众权限');
            const sent = await peer.timeout(6000).emitWithAck('submit',{interactionId:'postshow-letter',text:'临时测试信'});
            if (!sent.ok) throw new Error('抽签测试投递失败');
          }
          await page.until('!document.querySelector(".show-raffle-stage")');
          await control('control',{action:'raffle:open'});
          await page.until('document.querySelectorAll(".raffle-lantern").length===4');
          await control('control',{action:'raffle:draw'});
          await page.until('document.querySelector(".show-raffle-stage footer")?.textContent.includes("进行中")');
          await page.shot('抽奖-灯签入池.png');
          await page.until('document.querySelectorAll(".raffle-code").length===4');
          await viewer.until('Boolean(document.querySelector(".raffle-ticket strong"))');
          await wait(620);
          await page.shot('抽奖-四签揭晓.png');
          await control('control',{action:'raffle:close'});
          await page.until('!document.querySelector(".show-raffle-stage")');
          flow.push('抽奖默认关闭，点开后灯签动效逐签揭晓，中奖手机显示领奖码');
        } finally { fixtures.forEach(peer=>peer.disconnect()); }
      }
      await go('P2-13');
      await page.until(readyAt('P2-13'));
      await page.offline(true);
      const cachedFilms = await page.eval('Promise.all(["assets/video/genshin-campus.mp4","assets/video/liyunculture-club.mp4","assets/video/ai-wiring-lab.mp4"].map(url=>fetch(url,{headers:{Range:"bytes=0-2047"}}).then(async res=>[res.status,(await res.arrayBuffer()).byteLength])))');
      if (cachedFilms.some(([status, size])=>status!==206||size!==2048)) throw new Error('离线影片未返回有效分段 ' + JSON.stringify(cachedFilms));
      await page.navigate('prev');
      await page.until(readyAt('P2-12'));
      await page.navigate('next');
      await page.until(readyAt('P2-13'));
      await page.key('v','KeyV');
      await page.until('document.querySelector("video")?.currentTime > .12');
      flow.push('正式授权舞台切断网络后仍能前后翻页，并播放已缓存影片');
      await page.load('/?preview=P2-13&motion=off&clean=1','video');
      await page.until('document.querySelector("video")?.readyState>=1');
      await page.key('v','KeyV');
      await page.until('document.querySelector("video")?.currentTime>.12');
      await page.offline(false);
      flow.push('断网后三段视频缓存可分段读取，P2-13 重载后可播放');

      await manager.load('/?role=presenter&manage=1', '#host-pin');
      await manager.eval(input('#host-pin', pin));
      await manager.eval('document.querySelector(".room-manager-login").requestSubmit()');
      await manager.until('document.querySelector("#show-name")');
      await manager.eval(input('#show-name', '现场操作验收'));
      await manager.eval('document.querySelector(".room-create-form").requestSubmit()');
      await manager.until('Boolean(document.querySelector(".room-invite img")?.naturalWidth)');
      if (!(await manager.eval('document.querySelector(".room-show-list").textContent.includes("现场操作验收")'))) throw new Error('场次管理器未显示新场次');
      const selected = '[...document.querySelectorAll(".room-show")].find(row=>row.querySelector(".room-show-number").textContent===' + JSON.stringify(fixture.show.id) + ')';
      const openEnd = selected + '.querySelector(".room-end-button").click()';
      await manager.eval(openEnd);
      await manager.until('document.querySelector(".room-confirm[open]")');
      await manager.eval('document.querySelector(".room-confirm[open] button[type=button]").click()');
      if ((await fetch(roomApi).then(response => response.json())).show.endedAt) throw new Error('取消后场次提前结束');
      await manager.eval(openEnd);
      await manager.eval('document.querySelector(".room-confirm[open] button[type=submit]").click()');
      await manager.until(selected + '.querySelector(".room-show-state").textContent === "已结束"');
      await viewer.until('document.querySelector(".audience-session-status")?.textContent.includes("本场已结束")');
      await manager.load('/?role=presenter&manage=1&archive=' + fixture.show.id, '.room-archive');
      await manager.until('document.querySelector(".room-archive").textContent.includes("给学长的离场私信")');
      flow.push('提词器可建场并生成带场次的二维码，结束可取消，二次确认后观众收到通知且私信留档');
    } finally {
      controller.disconnect();
      await viewer.close();
      await manager.close();
      await send('Target.disposeBrowserContext', {browserContextId});
    }
  }
  await page.close();
  const report = {sheetPages:sheets.reduce((n,s)=>n+s.ids.length,0),sheets,samples,individuals,flow,errors};
  const save = async (name, data) => writeFile(join(output,name),`${JSON.stringify({...data,errors},null,2)}\n`);
  if (sheets.length) await save('联系表核验.json', {sheetPages:report.sheetPages,sheets});
  if (samples.length) await save(process.argv.includes('--live')?'动效抽验.json':'单页核验.json', {samples});
  if (process.argv.includes('--review-flow')) await save('人工复核三端核验.json', {flow});
  if (flow.length && (process.argv.includes('--flow') || process.argv.includes('--offline'))) await save('演出流程核验.json', {flow});
  let artMismatches = [];
  if (individuals.length) {
    const ledger = JSON.parse(await readFile(join(output,'逐页制作清单.json'),'utf8'));
    const expected = new Map(ledger.chapters.flatMap(({pages})=>pages.map(page=>[page.id,page.art])));
    artMismatches = individuals.flatMap(({ids,art,scenes})=>ids.filter((id)=>sceneBeats.has(id)?!scenes.some(scene=>scene.id===id&&scene.scene===sceneBeats.get(id)):art[id] !== (expected.get(id) ? basePath + (deliveryImages[expected.get(id)] ?? expected.get(id)) : null)));
    await save('逐页渲染核验.json', {count:individuals.length,individuals,artMismatches});
  }
  const broken = [...sheets,...samples,...individuals].flatMap((item)=>item.missing);
  const overflows = [...sheets,...samples,...individuals].flatMap((item)=>item.overflow);
  console.log(`联系表 ${report.sheetPages} 页；单页 ${samples.length+individuals.length}；流程 ${flow.length}；素材缺失 ${broken.length}；安全区提示 ${overflows.length}；异常 ${errors.length}`);
  if (artMismatches.length) console.error(`渲染与制作清单的图像路径不一致：${artMismatches.join('、')}`);
  if (broken.length || errors.length || artMismatches.length || overflows.length) process.exitCode = 1;
} finally {
  if (browser.pid && browser.exitCode === null) {
    const closed = once(browser, 'close');
    browser.kill();
    await closed;
  }
  if (dirname(resolve(profile)) === temp) {
    await rm(profile, {recursive: true, force: true, maxRetries: 4, retryDelay: 200});
  }
}
