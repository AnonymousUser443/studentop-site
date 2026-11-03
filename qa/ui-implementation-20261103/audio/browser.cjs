'use strict';
// Production preview, native Audio/AudioContext and CDP user input in an owned empty profile.
// Graph instrumentation forwards all calls to browser implementations; --mute-audio prevents audible output.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { newSession, until, sleep } = require('../../lib.js');
const out = __dirname, checks = [], evidence = {};
const base = process.env.LIYUN_QA_URL || 'http://127.0.0.1:4174';
const check = (name, pass, detail) => { checks.push({ name, pass: !!pass, detail }); if (!pass) throw Error(name + ': ' + JSON.stringify(detail)); };
const instrumentation = `(() => {
  const AudioNative = window.Audio, ContextNative = window.AudioContext;
  window.__audioQA = { elements: [], contexts: [], starts: [], peaks: [], rms: [] };
  window.Audio = new Proxy(AudioNative, { construct(Target, args) { const el = Reflect.construct(Target, args); window.__audioQA.elements.push(el); return el; } });
  window.AudioContext = new Proxy(ContextNative, { construct(Target, args) {
    const context = Reflect.construct(Target, args); window.__audioQA.contexts.push(context);
    const analyser = context.createAnalyser(); analyser.fftSize = 256; context.__qaAnalyser = analyser;
    const createOscillator = context.createOscillator.bind(context), createGain = context.createGain.bind(context);
    context.createOscillator = () => { const node = createOscillator(), start = node.start.bind(node); node.start = (...args) => { window.__audioQA.starts.push({ frequency: node.frequency.value, at: performance.now(), contextState: context.state }); return start(...args); }; return node; };
    context.createGain = () => { const gain = createGain(), connect = gain.connect.bind(gain), ramp = gain.gain.linearRampToValueAtTime.bind(gain.gain); gain.connect = (...args) => { if (args[0] === context.destination) connect(analyser); return connect(...args); }; gain.gain.linearRampToValueAtTime = (...args) => { window.__audioQA.peaks.push(args[0]); return ramp(...args); }; return gain; };
    return context;
  } });
  setInterval(() => { for (const c of window.__audioQA.contexts) { if (c.state !== 'running') continue; const data = new Float32Array(256); c.__qaAnalyser.getFloatTimeDomainData(data); const rms = Math.sqrt(data.reduce((a,v)=>a+v*v,0)/data.length); if (rms > .00001) window.__audioQA.rms.push({at:performance.now(),rms}); } }, 10);
  if (!sessionStorage.getItem('audio-qa-seeded')) {
    localStorage.setItem('liyun.exploration.v2', JSON.stringify({version:3,discoveredIds:[],unlockedRegionIds:[],settings:{music:false,uiSound:true,volume:.6,autoDegrade:false,qualityPreset:'low',baseQualityPreset:'low',reducedMotion:true}}));
    sessionStorage.setItem('audio-qa-seeded','1');
  }
})();`;
(async () => {
  let s;
  try {
    fs.mkdirSync(out, {recursive:true});
    s = await newSession({size:'1440x900',hardwareRendering:true});
    await s.call('Emulation.setFocusEmulationEnabled',{enabled:true});
    await s.call('Page.addScriptToEvaluateOnNewDocument',{source:instrumentation});
    await s.navigate(base + '/');
    await until(()=>s.evaluate('Boolean(document.querySelector(".entry-alt"))'),15000,'production entry');
    check('production has no development bridge', await s.evaluate('typeof window.__LIYUN__ === "undefined"'));
    await s.click('.entry-alt'); await sleep(550);
    check('native AudioContext unlocked on guest gesture while music is off', await s.evaluate('window.__audioQA.contexts.some(c=>c.state==="running")'));
    check('one music element is owned and remains paused with music off', await s.evaluate('window.__audioQA.elements.length===1&&window.__audioQA.elements[0].paused'));
    const snapshot = () => s.evaluate('({starts:window.__audioQA.starts.length,rms:window.__audioQA.rms.length,peaks:window.__audioQA.peaks.slice(),elements:window.__audioQA.elements.map(e=>({paused:e.paused,volume:e.volume,currentTime:e.currentTime,readyState:e.readyState,src:e.currentSrc,duration:e.duration})),contexts:window.__audioQA.contexts.map(c=>c.state)})');
    let before = await snapshot();
    await s.click('.hud-brand-badge'); await sleep(350);
    let after = await snapshot();
    check('real menu click emits an oscillator and a nonzero native analyser waveform with music off', after.starts>before.starts&&after.rms>before.rms,{before,after});
    await s.click('.menu-grid [aria-label="设置"]'); await sleep(350);
    await s.click('#settings-tab-sound'); await sleep(250);
    await s.screenshot(path.join(out,'sound-production.png'));
    const switchSound = '[role=switch][aria-label="界面音效"]';
    await s.click(switchSound); await sleep(200); before = await snapshot();
    await s.evaluate('window.dispatchEvent(new CustomEvent("liyun:ui-sfx",{detail:"confirm"}));true');
    await sleep(200); after = await snapshot();
    check('uiSound off prevents a new native oscillator', after.starts===before.starts,{before:before.starts,after:after.starts});
    await s.click(switchSound); await sleep(100); before = await snapshot();
    await s.evaluate('window.dispatchEvent(new CustomEvent("liyun:ui-sfx",{detail:"cancel"}));true'); await sleep(180); after = await snapshot();
    check('uiSound on restores feedback independently of music',after.starts>before.starts&&after.elements[0].paused,{before:before.starts,after});
    const slider = '[role=slider][aria-label="声音音量"]';
    await s.click(slider);
    await s.call('Input.dispatchKeyEvent',{type:'keyDown',key:'Home',code:'Home',windowsVirtualKeyCode:36});
    await s.call('Input.dispatchKeyEvent',{type:'keyUp',key:'Home',code:'Home',windowsVirtualKeyCode:36}); await sleep(200);
    check('volume keyboard Home reaches zero', await s.evaluate(`document.querySelector('${slider}').getAttribute('aria-valuenow')==='0'`));
    before = await snapshot(); await s.evaluate('window.dispatchEvent(new CustomEvent("liyun:ui-sfx",{detail:"confirm"}));true'); await sleep(200); after = await snapshot();
    check('zero master volume gates UI oscillators',after.starts===before.starts);
    for(let i=0;i<8;i++) { await s.call('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39}); await s.call('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39}); }
    await sleep(150);
    await s.click('[role=switch][aria-label="校园配乐"]');
    await until(()=>s.evaluate('window.__audioQA.elements[0].currentTime>.15&&!window.__audioQA.elements[0].paused'),6000,'native decoded music playback');
    await sleep(350); before = await snapshot();
    check('music really decodes and advances at selected nonzero volume',before.elements[0].readyState>=3&&before.elements[0].currentTime>.15&&Math.abs(before.elements[0].volume-.4)<.015,before);
    await s.click(switchSound); await sleep(250); after=await snapshot();
    check('turning off UI sound keeps music advancing',!after.elements[0].paused&&after.elements[0].currentTime>before.elements[0].currentTime,{before:before.elements,after:after.elements});
    evidence.tracks=[];
    for(let track=0;track<3;track++) {
      await s.click('[role=combobox][aria-label="当前曲目"]');await until(()=>s.evaluate('Boolean(document.querySelector("[role=listbox]"))'),4000,'track options');await sleep(180);
      const key=async(name,vk,text)=>{await s.call('Input.dispatchKeyEvent',{type:'keyDown',key:name,code:name,windowsVirtualKeyCode:vk,...(text?{text}:{})});await s.call('Input.dispatchKeyEvent',{type:'keyUp',key:name,code:name,windowsVirtualKeyCode:vk});await sleep(100);};
      await key('Home',36);for(let i=0;i<track;i++)await key('ArrowDown',40);await key('Enter',13,'\r');
      await until(()=>s.evaluate(`(()=>{const e=window.__audioQA.elements[0];return /bgm${track+1}\\.(opus|mp3)$/.test(e.currentSrc)&&e.currentTime>.15&&!e.paused})()`),7000,'track '+(track+1)+' decoded');
      const current=await snapshot();evidence.tracks.push(current.elements[0]);
      check('selected music track '+(track+1)+' actually decodes and plays',current.elements[0].readyState>=3&&current.elements[0].duration>100,current.elements[0]);
    }
    await s.click('[role=switch][aria-label="校园配乐"]'); await sleep(350); after=await snapshot();
    check('turning off music fades to zero and pauses its native element',after.elements[0].paused&&after.elements[0].volume===0,after);

    // Real production discovery paths, with explicitly simulated browser GPS.
    await s.click(switchSound);await sleep(150);
    const escape=async()=>{await s.call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await s.call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await sleep(350);};
    await escape();await escape();
    const app=path.resolve(__dirname,'../../../apps/liyun-explorer');
    const {createCampusMap}=await import(pathToFileURL(path.join(app,'src/location/vendor/coordinates.mjs')));
    const model=createCampusMap(JSON.parse(fs.readFileSync(path.join(app,'src/location/data/map.json'),'utf8')),JSON.parse(fs.readFileSync(path.join(app,'src/location/data/selected_model.json'),'utf8')));
    const data=fs.readFileSync(path.join(app,'src/data.ts'),'utf8');
    const gps=async id=>{const m=data.match(new RegExp("id:\\s*'"+id+"'[\\s\\S]*?uv:\\s*uv\\(([\\d.]+),\\s*([\\d.]+)\\)"));if(!m)throw Error('public anchor missing');const p=model.uvToGeo(Number(m[1])/1000.56,Number(m[2])/1240.28003);await s.call('Emulation.setGeolocationOverride',{latitude:p.latitude,longitude:p.longitude,accuracy:5});};
    await s.call('Browser.grantPermissions',{permissions:['geolocation'],origin:base});await gps('beihu');await s.click('.location-primary');await until(()=>s.evaluate('document.querySelector(".location-controls")?.dataset.status==="tracking"'),7000,'synthetic GPS tracking');
    await s.click('[data-testid=poi-beihu]');await until(()=>s.evaluate('document.querySelector("[data-testid=check-in-button]")?.disabled===false'),5000,'eligible first landmark');
    before=await snapshot();await s.click('[data-testid=check-in-button]');await sleep(160);
    const newTones=await s.evaluate(`window.__audioQA.starts.slice(${before.starts})`);after=await snapshot();
    check('valid discovery reaches real polyphonic unlock graph with music off',newTones.length>=8&&newTones.some(t=>t.frequency<200)&&newTones.some(t=>t.frequency>1000)&&after.rms>before.rms&&after.elements[0].paused,newTones);
    await until(()=>s.evaluate('Boolean(document.querySelector("[data-testid=cinematic-screen]"))'),6000,'discovery cinematic');await sleep(1200);before=await snapshot();await escape();after=await snapshot();
    check('cinematic exit dispatches a real feedback tone',after.starts>before.starts,{before:before.starts,after:after.starts});
    await s.click('.hud-brand-badge');await sleep(350);await s.click('.menu-grid [aria-label="设置"]');await sleep(350);await s.click('#settings-tab-sound');await sleep(200);await s.click(switchSound);await sleep(200);await escape();await escape();
    await gps('teaching');await sleep(500);await s.click('[data-testid=poi-teaching]');await until(()=>s.evaluate('document.querySelector("[data-testid=check-in-button]")?.disabled===false'),5000,'eligible second landmark');
    before=await snapshot();await s.click('[data-testid=check-in-button]');await sleep(350);after=await snapshot();
    check('uiSound off gates the complete second discovery unlock path',after.starts===before.starts,{before:before.starts,after:after.starts});
    const saved=await s.evaluate('JSON.parse(localStorage.getItem("liyun.exploration.v2"))');
    check('audio gates do not prevent valid discoveries or independent regions being saved',saved.discoveredIds.includes('beihu')&&saved.discoveredIds.includes('teaching')&&saved.unlockedRegionIds.includes('beihu')&&saved.unlockedRegionIds.includes('teaching'));
    evidence.discoveries={tones:newTones,savedIds:saved.discoveredIds,gps:'Explicit CDP geolocation at public model-derived anchors, not field measurement.'};
    check('no production browser errors or failed assets',s.errors.length===0,s.errors);
    evidence.final=after; evidence.base=base; evidence.method='Owned temporary profile; native muted Edge Audio/AudioContext with forwarding constructor and analyser tap; native CDP click/keyboard. Verifies graph/data/playback, not human hearing or device loudspeaker.';
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({ok:true,total:checks.length,checks,evidence,errors:s.errors},null,2));
    console.log(JSON.stringify({ok:true,total:checks.length,errors:s.errors}));
  } catch(error) { await s?.screenshot(path.join(out,'failure.png')).catch(()=>{}); fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({ok:false,error:String(error.stack||error),checks,evidence,errors:s?.errors},null,2)); console.error(error);process.exitCode=1; }
  finally { await s?.close(); }
})();
