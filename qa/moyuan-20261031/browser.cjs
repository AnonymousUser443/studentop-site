'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {newSession,until,sleep}=require('../lib.js');
const args=process.argv.slice(2);
if(args.length!==2||args[0]!=='--out')throw Error('Use --out <new-report.json>. Run the owned dev app on 5181 first.');
const out=path.resolve(args[1]),prefix=path.basename(out,'.json'),dir=path.dirname(out);
if(fs.existsSync(out))throw Error('Existing report cannot be overwritten.');
const report={ok:false,checkedAt:new Date().toISOString(),browser:'Owned isolated Edge / SwiftShader; OpenCLI extension disconnected',checks:[],screenshots:[],sourceHashes:{}};
for(const name of ['room.js','decor.js','render.js','main.js','style.css'])report.sourceHashes[name]=crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'../../apps/liyun-moyuan/src',name))).digest('hex');
let browser;
async function check(name,expr){const pass=!!(await browser.evaluate(expr));report.checks.push({name,pass});if(!pass)throw Error(name);}
async function shot(name){const file=prefix+'-'+name+'.png',target=path.join(dir,file);if(fs.existsSync(target))throw Error('Existing screenshot');fs.mkdirSync(dir,{recursive:true});const result=await browser.call('Page.captureScreenshot',{format:'png'},120000);fs.writeFileSync(target,Buffer.from(result.data,'base64'));report.screenshots.push(file);}
(async()=>{try{
  const size=process.env.MOYUAN_QA_SIZE||'1440x1000';report.viewport=size;browser=await newSession({size});report.browserVersion=(await browser.call('Browser.getVersion')).product;
  await browser.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await browser.navigate('http://127.0.0.1:5181/');
  await until(()=>browser.evaluate('!!window.__MOYUAN__?.ready'),45000,'WebGL scene ready');
  await sleep(2200);
  await check('real-WebGL-canvas','!!document.querySelector("canvas")&&window.__MOYUAN__.triangles>10000');
  await check('six-photo-model','__MOYUAN__.referencePages===6&&__MOYUAN__.stats.room.desks===16&&__MOYUAN__.stats.room.windows===4');
  await check('detailed-decor','__MOYUAN__.stats.decor.shelves===2&&__MOYUAN__.stats.decor.porcelainPieces>=20&&__MOYUAN__.stats.decor.baskets===1');
  await check('loading-clears','document.querySelector("#loading").hidden&&!document.querySelector("#error").hidden===false');
  await shot('interior');
  for(const view of ['overview','tea','desk','stage']){await browser.click('button[data-view="'+view+'"]');await sleep(1100);const selector=JSON.stringify('button[data-view="'+view+'"]');await check('view:'+view,'__MOYUAN__.view==='+JSON.stringify(view)+'&&document.querySelector('+selector+')?.getAttribute("aria-pressed")==="true"');await shot(view);}
  await browser.click('[data-view="tea"]');await browser.click('#light-toggle');await sleep(1100);await check('night-lighting-control','__MOYUAN__.night&&document.querySelector("#light-toggle").getAttribute("aria-pressed")==="true"');await shot('night');
  await browser.click('#light-toggle');await browser.click('#detail-toggle');await check('detail-toggle-off','!__MOYUAN__.detail');await browser.click('#detail-toggle');await check('detail-toggle-on','__MOYUAN__.detail');
  await browser.click('#tour-toggle');await check('orbit-tour-on','document.querySelector("#tour-toggle").getAttribute("aria-pressed")==="true"');await browser.click('#tour-toggle');
  await browser.click('#about-toggle');await check('reference-notes-open','!document.querySelector("#about-panel").hidden&&document.activeElement.id==="about-close"');
  await browser.call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await check('reference-notes-Escape','document.querySelector("#about-panel").hidden&&document.activeElement.id==="about-toggle"');
  await browser.call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await sleep(1600);
  await check('mobile-no-horizontal-overflow','document.documentElement.scrollWidth<=innerWidth');
  await check('mobile-navigation-visible','Array.from(document.querySelectorAll("button[data-view]")).every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;})');
  await browser.click('button[data-view="overview"]');await sleep(1100);await check('mobile-view-control','__MOYUAN__.view==="overview"');await shot('mobile');
  await browser.call('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:1,mobile:true});await sleep(900);
  await check('landscape-tools-above-nav','(()=>{const tools=document.querySelector(".right-tools").getBoundingClientRect(),bar=document.querySelector(".bottom-bar").getBoundingClientRect();return tools.left>=0&&tools.right<=innerWidth&&tools.top>=0&&tools.bottom<=bar.top+1;})()');
  await check('no-runtime-errors','true');report.errors=[...browser.errors];if(report.errors.length)throw Error('Browser errors: '+report.errors.join('\n'));
  report.state=await browser.evaluate('JSON.parse(JSON.stringify(__MOYUAN__))');report.ok=true;
}catch(error){report.error=String(error.stack||error);report.errors=browser?[...browser.errors]:[];if(browser)await shot('failure').catch(()=>{});process.exitCode=1;
}finally{if(browser)await browser.close();fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,out,error:report.error}));}})();
