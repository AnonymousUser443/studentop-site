'use strict';
// Two owned temporary Edge profiles, isolated author DB on localhost:5193/8793.
// OpenCLI handled initial single-page review; its tab leases and middle-button
// API cannot cover this test. Native CDP events are used here, not user profiles.
const fs=require('node:fs'),path=require('node:path');
const {newSession,until,sleep}=require('../lib.js');
const out=__dirname,checks=[],evidence={method:'Two isolated Edge profiles; native pointer, middle-button, keyboard and file-input events. Explicit controlled response-loss and held-request fixtures only in these pages.'};
const check=(name,pass,detail)=>{checks.push({name,pass:!!pass,...(detail===undefined?{}:{detail})});if(!pass)throw Error(name+': '+JSON.stringify(detail));};
const base='http://localhost:5193';
(async()=>{let a,b;try{
 a=await newSession({size:'1440x900',hardwareRendering:true});b=await newSession({size:'1440x900',hardwareRendering:true});
 for(const s of [a,b]){
  await s.call('Emulation.setFocusEmulationEnabled',{enabled:true});
  const original=s.click;s.click=async selector=>{await s.evaluate(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'nearest'});true`);await sleep(50);await original(selector);};
 }
 const fill=async(s,selector,text)=>{await s.click(selector);await s.call('Input.dispatchKeyEvent',{type:'keyDown',key:'Control',code:'ControlLeft',windowsVirtualKeyCode:17,modifiers:2});await s.call('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});await s.call('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});await s.call('Input.dispatchKeyEvent',{type:'keyUp',key:'Control',code:'ControlLeft',windowsVirtualKeyCode:17,modifiers:0});await s.call('Input.insertText',{text:String(text)});await s.call('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await s.call('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await sleep(50);};
 const saved=s=>until(()=>s.evaluate('document.querySelector(".studio-sync")?.dataset.dirty==="false"'),12000,'server draft saved');
 const snapshot=s=>s.evaluate('fetch("/api/editor/snapshot").then(r=>r.json())');
 for(const[s,name]of [[a,'独立成员A'],[b,'独立成员B']]){await s.navigate(base+'/studio/');await until(()=>s.evaluate('!!document.querySelector(".studio-login input")'),10000,'join form');await fill(s,'.studio-login input',name);await s.click('.studio-login button');await until(()=>s.evaluate('!!document.querySelector(".studio-shell")'),10000,'studio ready');}
 check('both members join real collaborative sessions',await a.evaluate('document.querySelector(".studio-people").title.includes("独立成员B")'));
 for(const s of [a,b]){await s.click('.studio-sites > button:nth-of-type(2)');await s.click('.studio-tabs button:first-child');}
 await fill(a,'.studio-fields > label:first-of-type input','协作文萃楼');await saved(a);
 await until(()=>b.evaluate('document.querySelector(".studio-fields > label:first-of-type input").value==="协作文萃楼"'),10000,'peer title broadcast');
 check('a title edit appears in the second members real form',true);
 await fill(b,'.studio-fields textarea','另一位成员实时补充的景点介绍。\n第二段介绍用于验证自动同步。');await saved(b);
 await until(()=>a.evaluate('document.querySelector(".studio-fields textarea").value.includes("另一位成员")'),10000,'peer intro broadcast');
 check('independent title and introduction edits merge without replacement',(await snapshot(a)).document.sites[0].name==='协作文萃楼');
 await a.evaluate(`window.__originalStudioFetch=window.fetch;window.__holdNextStudio=true;window.fetch=async function(input,init){if(String(input).includes('/api/editor/ops')&&window.__holdNextStudio){window.__holdNextStudio=false;await new Promise(resolve=>window.__releaseStudio=resolve);}return window.__originalStudioFetch(input,init)};true`);
 await fill(a,'.studio-fields > label:first-of-type input','A的迟到名称');await until(()=>a.evaluate('typeof window.__releaseStudio==="function"'),5000,'held request');
 await fill(b,'.studio-fields > label:first-of-type input','B先提交的名称');await saved(b);await a.evaluate('window.__releaseStudio();true');
 await until(()=>a.evaluate('!!document.querySelector(".studio-conflict")'),10000,'same-field conflict');
 check('a stale same-field edit opens a conflict choice instead of overwriting',true);
 await a.click('.studio-conflict button:first-of-type');await saved(a);
 check('keeping server content resolves to the other members edit',await a.evaluate('document.querySelector(".studio-fields > label:first-of-type input").value==="B先提交的名称"'));
 await a.evaluate('window.fetch=window.__originalStudioFetch;true');
 const beforeRetry=(await snapshot(a)).revision;
 await a.evaluate(`window.__loseReply=true;window.fetch=async function(input,init){const result=await window.__originalStudioFetch(input,init);if(String(input).includes('/api/editor/ops')&&window.__loseReply){window.__loseReply=false;throw new TypeError('Owned fixture: response lost after server commit');}return result};true`);
 await fill(a,'.studio-fields textarea','断线恢复后的介绍；已提交但响应丢失时不能重复写入。');await saved(a);
 const afterRetry=await snapshot(a);check('lost response retries the same request without a second revision',afterRetry.revision===beforeRetry+1,{before:beforeRetry,after:afterRetry.revision});
 await a.evaluate('window.fetch=window.__originalStudioFetch;true');
 await a.click('.studio-tabs button:nth-child(3)');const oldRange=await b.evaluate('document.querySelector(".studio-radius").getBBox().width');
 await fill(a,'.studio-fields > label.studio-field input[type=number]',63);await saved(a);
 await until(()=>b.evaluate(`document.querySelector('.studio-radius').getBBox().width>${oldRange*1.3}`),10000,'real radius preview');
 check('meter radius changes update the peer projected boundary',(await snapshot(a)).document.sites[0].radiusM===63);
 await a.click('.studio-tabs button:nth-child(2)');await a.click('.studio-toolbar > button[aria-pressed]');
 // Choose the named draw button rather than relying on a transient pressed state.
 await a.evaluate(`(()=>{const e=[...document.querySelectorAll('.studio-toolbar button')].find(e=>e.textContent.trim()==='描绘分区');e.dataset.studioDraw='1';return true})()`);await a.click('[data-studio-draw]');
 const cameraBefore=await a.evaluate('new DOMMatrix(getComputedStyle(document.querySelector(".studio-world")).transform).toString()'),draftBeforeMiddle=(await snapshot(a)).revision;
 const at=await a.evaluate('(()=>{const r=document.querySelector(".studio-canvas").getBoundingClientRect();return{x:r.x+r.width*.3,y:r.y+r.height*.7}})()');
 await a.call('Input.dispatchMouseEvent',{type:'mousePressed',...at,button:'middle',buttons:4,clickCount:1});await a.call('Input.dispatchMouseEvent',{type:'mouseMoved',x:at.x+48,y:at.y+24,button:'middle',buttons:4});await a.call('Input.dispatchMouseEvent',{type:'mouseReleased',x:at.x+48,y:at.y+24,button:'middle',buttons:0,clickCount:1});await sleep(150);
 check('native middle-button pans while drawing without adding vertices',await a.evaluate(`getComputedStyle(document.querySelector('.studio-world')).transform!==${JSON.stringify(cameraBefore)}&&!document.querySelector('.studio-drawing')`));
 check('panning changes neither the server draft nor other members camera',(await snapshot(a)).revision===draftBeforeMiddle);
 const beforeDraw=await snapshot(a),ring=beforeDraw.document.sites[0].geometry[0][0];
 for(const uv of ring.slice(0,3)){const point=await a.evaluate(`(()=>{const r=document.querySelector('.studio-world').getBoundingClientRect();return{x:r.x+${uv.u}*r.width,y:r.y+${uv.v}*r.height}})()`);await a.call('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',buttons:1,clickCount:1});await a.call('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',buttons:0,clickCount:1});}
 await until(()=>a.evaluate('[...document.querySelectorAll(".studio-toolbar button")].some(e=>e.textContent.includes("一键闭合 (3)"))'),5000,'three drawing points');
 await a.evaluate(`(()=>{const e=[...document.querySelectorAll('.studio-toolbar button')].find(e=>e.textContent.includes('一键闭合'));e.dataset.studioClose='1';return true})()`);await a.click('[data-studio-close]');await saved(a);
 check('one-click closure saves an open three-vertex ring with implicit closing edge',(await snapshot(a)).document.sites[0].geometry[0][0].length===3);
 await a.click('[aria-label="撤销我的上次改动"]');await saved(a);check('collaborative undo restores only the author geometry command',(await snapshot(a)).document.sites[0].geometry[0][0].length===ring.length);
 await a.click('.studio-tabs button:first-child');
 const dom=(await a.call('DOM.getDocument',{depth:1})).root.nodeId,node=(await a.call('DOM.querySelector',{nodeId:dom,selector:'input[type=file][accept="image/*"]'})).nodeId;
 await a.call('DOM.setFileInputFiles',{nodeId:node,files:[path.resolve('apps/liyun-explorer/public/assets/landmarks/beihu/hero.webp')]});
 await until(async()=>((await snapshot(a)).document.sites[0].photos.length===2),10000,'photo upload and draft reference');await saved(a);
 await b.click('.studio-tabs button:first-child');await until(()=>b.evaluate('document.querySelectorAll(".studio-photos figure").length===2&&[...document.querySelectorAll(".studio-photos img")].every(i=>i.complete&&i.naturalWidth>0)'),10000,'peer photo attachment');
 check('a real uploaded photo appears and decodes for another member',true);await a.screenshot(path.join(out,'photos-peer.png'));
 await a.evaluate(`(()=>{const e=[...document.querySelectorAll('.studio-toolbar button')].find(e=>e.textContent.includes('新增景点'));e.dataset.studioAdd='1';return true})()`);await a.click('[data-studio-add]');await a.click('.studio-canvas');
 await until(()=>a.evaluate('document.querySelector(".studio-inspector h2").textContent==="新景点"'),5000,'new scenic site');
 await fill(a,'.studio-fields > label:first-of-type input','新增协作花园');await fill(a,'.studio-fields textarea','这是新增景点的介绍，发布后在玩家端显示。');await saved(a);
 let newDoc=await snapshot(a);const added=newDoc.document.sites.find(s=>s.name==='新增协作花园');check('new scenic sites sync with independent IDs and content',!!added&&newDoc.document.sites.length===9);evidence.newSiteId=added.id;
 await a.evaluate(`(()=>{const e=[...document.querySelectorAll('.studio-coverage button')][0];e.dataset.studioRepair='1';return true})()`);await a.click('[data-studio-repair]');await saved(a);
 await until(()=>a.evaluate('document.querySelector(".studio-coverage").textContent.includes("校区覆盖完整")'),10000,'repair complete coverage');
 check('one-click repair removes overlap and covers the entire campus',!await a.evaluate('!!document.querySelector("[data-testid=studio-gap],[data-testid=studio-overlap]")'));
 await a.screenshot(path.join(out,'nine-sites-coverage.png'));
 await a.click('.studio-header > button:first-of-type');await until(()=>a.evaluate('[...document.querySelectorAll(".studio-toolbar button")].some(e=>e.textContent==="全部解锁")'),5000,'preview mode');
 await a.evaluate(`(()=>{const e=[...document.querySelectorAll('.studio-toolbar button')].find(e=>e.textContent==='全部解锁');e.dataset.studioAll='1';return true})()`);await a.click('[data-studio-all]');
 check('all-unlocked preview exposes every partition',await a.evaluate('[...document.querySelectorAll(".studio-pin text")].every(e=>e.textContent.includes("✓"))'));
 await a.click('.studio-header > button:last-of-type');await a.click('.studio-dialog input[type=checkbox]');await a.click('.studio-dialog .studio-primary');
 await until(()=>a.evaluate('!document.querySelector(".studio-dialog")&&document.querySelector(".studio-sync").textContent.includes("线上 #")'),10000,'confirmed publication');
 const published=await a.evaluate('fetch("/api/content/published").then(r=>r.json())');check('explicit publish writes exactly the previewed nine-site snapshot',published.published.document.sites.length===9);evidence.publishedRevision=published.published.revision;
 await a.evaluate(`localStorage.setItem('liyun.exploration.v2','studio-owned-preview-sentinel');localStorage.setItem('liyun.session.v1','studio-owned-token-sentinel');true`);
 await a.navigate(base+'/?contentPreview='+published.published.revision);await until(()=>a.evaluate(`!!document.querySelector('[data-testid="poi-${added.id}"]')`),20000,'dynamic point in player preview');
 check('player preview consumes the new server-published site and advertises isolation',await a.evaluate('!!document.querySelector(".content-preview-banner")'));
 await a.click(`[data-testid="poi-${added.id}"]`);await until(()=>a.evaluate('document.querySelector(".landmark-description")?.textContent.includes("新增景点的介绍")'),10000,'published custom introduction');
 check('new scenic introduction renders in the existing player details panel',true);await a.screenshot(path.join(out,'player-new-site.png'));
 check('preview leaves ordinary exploration and account keys untouched',await a.evaluate('localStorage.getItem("liyun.exploration.v2")==="studio-owned-preview-sentinel"&&localStorage.getItem("liyun.session.v1")==="studio-owned-token-sentinel"'));
 await a.navigate(base+'/?contentPreview='+published.published.revision);await until(()=>a.evaluate('!!document.querySelector("[data-testid=poi-wencui]")'),15000,'existing site');await a.click('[data-testid=poi-wencui]');await until(()=>a.evaluate('document.querySelectorAll(".landmark-gallery img").length===2'),10000,'published photo gallery');
 check('player gallery consumes real uploaded photos and edited introduction',await a.evaluate('document.querySelector(".landmark-description").textContent.includes("断线恢复")&&[...document.querySelectorAll(".landmark-gallery img")].every(i=>i.complete&&i.naturalWidth>0)'));
 // The held-request conflict intentionally generates HTTP409; no other failure is accepted.
 const unexpected=[...a.errors,...b.errors].filter(e=>!e.startsWith('HTTP 409:'));
 check('no unexpected browser errors',unexpected.length===0,unexpected);
 fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify({ok:true,total:checks.length,checks,evidence,errors:{a:a.errors,b:b.errors}},null,2));console.log(JSON.stringify({ok:true,total:checks.length,evidence}));
 }catch(error){await a?.screenshot(path.join(out,'failure.png')).catch(()=>{});fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify({ok:false,error:String(error.stack||error),checks,evidence,errors:{a:a?.errors,b:b?.errors}},null,2));console.error(error);process.exitCode=1;}finally{await a?.close();await b?.close();}})();
