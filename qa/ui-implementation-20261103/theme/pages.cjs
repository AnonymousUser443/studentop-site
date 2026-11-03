'use strict';
const fs=require('node:fs'),path=require('node:path');
const {newSession,until,sleep}=require('../../lib.js');
const {decodePng,contrastSamples,contrast,mix}=require('./browser.cjs');
const pass=process.env.LIYUN_THEME_PASS||'before';if(!['before','after'].includes(pass))throw Error('Invalid LIYUN_THEME_PASS');
const out=path.join(__dirname,'pages',pass);fs.mkdirSync(out,{recursive:true});

function collectPage(scopeSelector){
  const root=document.querySelector(scopeSelector);if(!root)throw Error('Missing scope '+scopeSelector);
  const c=document.createElement('canvas').getContext('2d',{willReadFrequently:true});c.canvas.width=c.canvas.height=1;
  const rgba=value=>{c.clearRect(0,0,1,1);c.fillStyle=value;c.fillRect(0,0,1,1);return [...c.getImageData(0,0,1,1).data];};
  const excluded=e=>e.closest('[aria-hidden="true"],[inert],:disabled,[aria-disabled="true"],[data-disabled],.sr-only,.menu-sr-only,.settings-sr-only');
  const opacity=e=>{let a=1;for(let p=e;p;p=p.parentElement)a*=Number(getComputedStyle(p).opacity);return a;};
  const clip=(rect,e)=>{let r={x:Math.max(0,rect.x),y:Math.max(0,rect.y),right:Math.min(innerWidth,rect.right),bottom:Math.min(innerHeight,rect.bottom)};
    for(let p=e.parentElement;p;p=p.parentElement){const s=getComputedStyle(p),b=p.getBoundingClientRect();if(s.overflowX!=='visible'){r.x=Math.max(r.x,b.left);r.right=Math.min(r.right,b.right);}if(s.overflowY!=='visible'){r.y=Math.max(r.y,b.top);r.bottom=Math.min(r.bottom,b.bottom);}}
    r.width=r.right-r.x;r.height=r.bottom-r.y;return r.width>2&&r.height>2?r:null;};
  const visible=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return !excluded(e)&&s.visibility==='visible'&&s.display!=='none'&&opacity(e)>.02&&clip(r,e);};
  const texts=[],mask=[],controls=[],vectors=[];const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
  const describe=e=>e.id?'#'+e.id:e.tagName.toLowerCase()+(typeof e.className==='string'&&e.className?'.'+e.className.trim().replaceAll(' ','.'):'');
  while(node=walker.nextNode()){
    const text=node.textContent.trim(),e=node.parentElement;if(!text||!visible(e))continue;
    const s=getComputedStyle(e),range=document.createRange();range.selectNodeContents(node);
    let rects=[...range.getClientRects()].map(r=>clip(r,e)).filter(Boolean);
    if(!rects.length)continue;
    if(s.pointerEvents!=='none'&&!(e instanceof SVGElement))rects=rects.filter(r=>{const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit&&(e.contains(hit)||hit.contains(e));});
    if(!rects.length)continue;
    let fontSize=parseFloat(s.fontSize),weight=parseInt(s.fontWeight)||400;const isSvg=e instanceof SVGElement;
    if(isSvg){const m=e.getScreenCTM();if(m)fontSize*=Math.hypot(m.a,m.b);}
    rects=rects.filter(r=>r.height>=Math.max(5,fontSize*.6));if(!rects.length)continue;
    const foreground=rgba(isSvg?s.fill:s.color),threshold=fontSize>=24||(fontSize>=18.66&&weight>=700)?3:4.5;
    const item={selector:describe(e),text,fontSize,weight,foreground,opacity:opacity(e),threshold,rects};
    if(isSvg&&s.stroke!=='none'&&parseFloat(s.strokeWidth)>0){const m=e.getScreenCTM(),scale=m?Math.hypot(m.a,m.b):1;item.stroke=rgba(s.stroke);item.strokePixels=parseFloat(s.strokeWidth)*(s.vectorEffect==='non-scaling-stroke'?1:scale);vectors.push(item);}
    else texts.push(item);
    if(!mask.includes(e))mask.push(e);
  }
  for(const e of root.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=password]):not([type=file]),textarea,select')){
    if(!visible(e))continue;const s=getComputedStyle(e),r=e.getBoundingClientRect(),text=e.tagName==='SELECT'?e.selectedOptions[0]?.textContent:e.value||e.getAttribute('placeholder');if(!text)continue;
    const isPlaceholder=!e.value&&e.tagName!=='SELECT',ps=isPlaceholder?getComputedStyle(e,'::placeholder'):s;
    c.font=s.font;const measured=Math.min(c.measureText(text.split('\n')[0]).width,r.width-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight)-8),h=parseFloat(s.lineHeight)||parseFloat(s.fontSize)*1.5;
    const left=r.x+parseFloat(s.paddingLeft)+parseFloat(s.borderLeftWidth),x=s.textAlign==='right'?r.right-parseFloat(s.paddingRight)-measured-3:s.textAlign==='center'?r.x+(r.width-measured)/2:left;
    const q=clip({x,y:r.y+(r.height-h)/2,right:x+measured,bottom:r.y+(r.height+h)/2},e);if(!q)continue;
    texts.push({selector:describe(e),text:text.slice(0,220),formValue:true,placeholder:isPlaceholder,fontSize:parseFloat(s.fontSize),weight:parseInt(s.fontWeight)||400,foreground:rgba(ps.color),opacity:opacity(e)*(Number(ps.opacity)||1),threshold:4.5,rects:[q]});if(!mask.includes(e))mask.push(e);
  }
  for(const e of root.querySelectorAll('button,input,select,textarea,[role="switch"],[role="slider"],[role="combobox"]')){
    const clipped=visible(e);if(!clipped)continue;const s=getComputedStyle(e),r=e.getBoundingClientRect();
    if(clipped.width<r.width-.5||clipped.height<r.height-.5)continue;
    const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);if(!hit||!(e.contains(hit)||hit.contains(e)))continue;
    let outside=[25,60,55,255];for(let p=e.parentElement;p;p=p.parentElement){const bg=rgba(getComputedStyle(p).backgroundColor);if(bg[3]){outside=bg;break;}}
    const pseudo=getComputedStyle(e,'::before');
    controls.push({selector:describe(e),label:e.getAttribute('aria-label')||e.textContent.trim().slice(0,60)||e.getAttribute('type'),background:rgba(s.backgroundColor),border:rgba(s.borderTopColor),borderWidth:parseFloat(s.borderTopWidth),borderStyle:s.borderTopStyle,color:rgba(s.color),outside,pseudo: {background:rgba(pseudo.backgroundColor),border:rgba(pseudo.borderTopColor),borderWidth:parseFloat(pseudo.borderTopWidth),content:pseudo.content},role:e.getAttribute('role'),tag:e.tagName,type:e.getAttribute('type'),hasIcon:!!e.querySelector('svg'),rect:{x:r.x,y:r.y,width:r.width,height:r.height}});
  }
  const colors=new Set();for(const e of [root,...root.querySelectorAll('*')]){
    if(e.closest('[aria-hidden="true"],[inert],.sr-only,.menu-sr-only,.settings-sr-only'))continue;const s=getComputedStyle(e);if(s.visibility!=='visible'||s.display==='none'||opacity(e)<.02||!clip(e.getBoundingClientRect(),e))continue;
    for(const prop of ['color','background-color','border-top-color','border-right-color','border-bottom-color','border-left-color','outline-color','fill','stroke']){const value=s.getPropertyValue(prop);if(!value||!CSS.supports('color',value))continue;const a=rgba(value);if(a[3])colors.add(a.join(','));}
  }
  window.__themePageMask=mask.map(e=>({e,style:e.getAttribute('style')}));
  return {scope:scopeSelector,viewport:[innerWidth,innerHeight],computedColors:[...colors].sort(),computedColorCount:colors.size,texts,vectors,controls,boundaries:[],maskCount:mask.length};
}
function score(data,image){
  contrastSamples(data,image);
  for(const v of data.vectors){v.haloRatio=contrast(v.foreground,v.stroke);v.pass=v.strokePixels>=1&&v.haloRatio>=v.threshold;}
  for(const b of data.controls){
    const r=b.rect,at=(x,y)=>image.pixel(Math.max(0,Math.min(image.width-1,Math.round(x))),Math.max(0,Math.min(image.height-1,Math.round(y)))),median=items=>[0,1,2].map(i=>items.map(p=>p[i]).sort((a,b)=>a-b)[Math.floor(items.length/2)]);
    const outside=median([at(r.x-3,r.y+r.height/2),at(r.x+r.width+3,r.y+r.height/2),at(r.x+r.width/2,r.y-3),at(r.x+r.width/2,r.y+r.height+3)]);
    const inside=median([at(r.x+r.width*.2,r.y+r.height*.2),at(r.x+r.width*.8,r.y+r.height*.2),at(r.x+r.width*.2,r.y+r.height*.8),at(r.x+r.width*.8,r.y+r.height*.8)]);
    b.screenshotBackground={inside,outside};
    b.pairs={fill:contrast(inside,outside),border:b.borderWidth>=1&&b.borderStyle!=='none'?contrast(mix(b.border,outside),outside):0};
    if(b.pseudo.content!=='none'&&b.pseudo.content!=='normal'){b.pairs.pseudoFill=contrast(mix(b.pseudo.background,outside),outside);b.pairs.pseudoBorder=b.pseudo.borderWidth>=1?contrast(mix(b.pseudo.border,outside),outside):0;}
    if(b.hasIcon||b.tag==='SELECT'||b.role==='combobox'||((b.borderWidth===0||b.border[3]===0)&&b.role!=='switch'&&b.role!=='slider'&&b.type!=='range'))b.pairs.identifier=contrast(mix(b.color,inside),inside);
    if(b.role==='slider')b.pairs.sliderIndicator=contrast(mix(b.pseudo.background,outside),outside);
    b.ratio=Math.max(...Object.values(b.pairs));b.pass=b.ratio>=3;
    if(['checkbox','radio','range'].includes(b.type)){
      const r=b.rect,x0=Math.max(1,Math.floor(r.x)),y0=Math.max(1,Math.floor(r.y)),x1=Math.min(image.width-2,Math.ceil(r.x+r.width)),y1=Math.min(image.height-2,Math.ceil(r.y+r.height));
      const bg=image.pixel(x0-1,Math.floor((y0+y1)/2));let maximum=1,strongPixels=0;
      for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const ratio=contrast(image.pixel(x,y),bg);maximum=Math.max(maximum,ratio);if(ratio>=3)strongPixels++;}
      b.nativePixel={adjacentBackground:bg,maximumRatio:maximum,strongPixels,criterion:'At least four native indicator pixels contrast >=3 with the adjacent screenshot background; no computed native border assumption.'};b.pass=strongPixels>=4;b.ratio=maximum;
    }
  }
}
(async()=>{let s;const evidence={pass,scope:'Menu, eight settings categories, dialogs/selects, cinematic and calibration; isolated QA or author tool only',frames:[],errors:[]};
try{
  s=await newSession({size:'1440x900',hardwareRendering:true});await s.call('Emulation.setFocusEmulationEnabled',{enabled:true});await s.call('Page.bringToFront');
  const evaluate=code=>s.evaluate(code);
  const click=async selector=>{await evaluate(`document.querySelector(${JSON.stringify(selector)})?.click();true`);await sleep(350);};
  const prepare=async()=>{await s.navigate('http://127.0.0.1:5176/?qa=1&preset=explored');await until(()=>evaluate('Boolean(window.__LIYUN__)'),10000,'QA');await evaluate('window.__LIYUN__.setSettings({music:false,uiSound:false,autoDegrade:false,reducedMotion:true});window.__LIYUN__.freeze(1000);true');};
  const fixture=async kind=>{
    await evaluate('window.__LIYUN__.setRoute("map");true');await sleep(200);
    await evaluate(`(async()=>{const load=p=>import(performance.getEntriesByType('resource').map(e=>e.name).find(n=>new URL(n).pathname===p)??p);const React=await load('/node_modules/.vite/deps/react.js'),DOM=await load('/node_modules/.vite/deps/react-dom_client.js'),Page=await load(${JSON.stringify(kind==='menu'?'/src/menu/MenuScreen.tsx':'/src/settings/SettingsScreen.tsx')});const slot=document.createElement('div');slot.id='theme-owned-fixture';document.body.append(slot);window.__themeFixtureRoot=(DOM.createRoot??DOM.default.createRoot)(slot);const noop=()=>{},account={id:1,uid:'LY202611031234567890',nickname:'在良乡校园把每一段风景写进旅途的特别长昵称',studentId:'qa-long-account-20261103'};window.__themeFixtureRoot.render((React.createElement??React.default.createElement)(Page.default,{open:true,account,onClose:noop,onNavigate:noop,progress:37,collected:7,total:8,initialCategory:'account',onLoginPrompt:noop,onLogout:noop,onResetProgress:noop,onClearLocalSave:noop,onExportSave:noop,isFullscreen:false,onFullscreen:noop,onOpenCalibration:noop}));return true})()`);
  };
  const removeFixture=async()=>{await evaluate('window.__themeFixtureRoot?.unmount();document.querySelector("#theme-owned-fixture")?.remove();true');await sleep(150);};
  const capture=async(name,scope)=>{
    await sleep(750);await evaluate('document.fonts.ready.then(()=>true)');
    const data=await evaluate(`(${collectPage.toString()})(${JSON.stringify(scope)})`);data.name=name;
    await s.screenshot(path.join(out,name+'.png'));
    await evaluate('for(const {e} of window.__themePageMask){e.style.setProperty("color","transparent","important");e.style.setProperty("-webkit-text-fill-color","transparent","important");e.style.setProperty("text-shadow","none","important");if(e instanceof SVGElement){e.style.setProperty("fill","transparent","important");e.style.setProperty("stroke","transparent","important")}}true');
    await s.screenshot(path.join(out,name+'-background.png'));
    await evaluate('for(const {e,style} of window.__themePageMask){if(style===null)e.removeAttribute("style");else e.setAttribute("style",style)}true');
    score(data,decodePng(fs.readFileSync(path.join(out,name+'-background.png'))));evidence.frames.push(data);
    console.log(JSON.stringify({frame:name,texts:data.texts.length,vectors:data.vectors.length,controls:data.controls.length,failed:data.texts.filter(t=>!t.pass).map(t=>({selector:t.selector,text:t.text,p05:t.p05,threshold:t.threshold})),controlFailures:data.controls.filter(t=>t.pass===false).map(t=>({selector:t.selector,label:t.label,ratio:t.ratio})),vectorFailures:data.vectors.filter(t=>!t.pass).map(t=>({text:t.text,strokePixels:t.strokePixels,ratio:t.haloRatio}))}));
  };
  const scroll=async(selector,where)=>{await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(e)e.scrollTop=${where==='bottom'?'e.scrollHeight':'0'};return true})()`);await sleep(80);};
  for(const [width,height] of [[1440,900],[844,390]]){
    await s.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await prepare();
    await evaluate('window.__LIYUN__.setRoute("menu");true');await until(()=>evaluate('Boolean(document.querySelector(".menu-screen"))'),5000,'menu');
    await capture('menu-'+width,' .menu-screen'.trim());await scroll('.menu-scroll','bottom');await capture('menu-scroll-'+width,'.menu-screen');
    await fixture('menu');await capture('menu-long-account-'+width,'.menu-screen');await scroll('.menu-scroll','bottom');await capture('menu-long-account-scroll-'+width,'.menu-screen');await removeFixture();
    await evaluate('window.__LIYUN__.setRoute("settings");true');await until(()=>evaluate('Boolean(document.querySelector(".settings-screen"))'),5000,'settings');
    for(const tab of ['control','keys','image','sound','message','account','data','other']){
      await click('#settings-tab-'+tab);await scroll('.settings-panel','top');
      await capture('settings-'+tab+'-'+width,'.settings-screen');
      const over=await evaluate('(()=>{const e=document.querySelector(".settings-panel");return e.scrollHeight>e.clientHeight+2})()');
      if(over){await scroll('.settings-panel','bottom');await capture('settings-'+tab+'-scroll-'+width,'.settings-screen');}
    }
    await fixture('settings');await capture('settings-long-account-'+width,'.settings-screen');await scroll('.settings-panel','bottom');await capture('settings-long-account-scroll-'+width,'.settings-screen');await removeFixture();
    await evaluate('window.__LIYUN__.setRoute("settings");true');await sleep(200);
    await click('#settings-tab-image');await scroll('.settings-panel','top');
    await evaluate('window.__LIYUN__.setSettings({qualityPreset:"custom",baseQualityPreset:"ultra",qualityOverrides:{glowLayers:1}});true');await sleep(100);
    await evaluate('document.querySelector(".settings-row.is-customized")?.scrollIntoView({block:"center"});true');
    await capture('settings-custom-'+width,'.settings-screen');await scroll('.settings-panel','top');
    await evaluate('window.__LIYUN__.setQualityPreset("ultra");true');
    await click('[role="combobox"][aria-label="光晕层数"]');await until(()=>evaluate('Boolean(document.querySelector("[role=listbox]"))'),3000,'quality select');
    await capture('settings-select-'+width,'.settings-select-content');await s.call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await s.call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await sleep(100);
    await click('.settings-footer .settings-btn--secondary');await capture('settings-confirm-'+width,'.settings-confirm');await click('.settings-confirm .settings-btn--secondary');
    await evaluate('window.__LIYUN__.setRoute("map");window.__LIYUN__.previewCinematic("beihu");true');await until(()=>evaluate('Boolean(document.querySelector("[data-testid=cinematic-screen]"))'),5000,'cinematic');await sleep(1300);
    await capture('cinematic-'+width,'[data-testid=cinematic-screen]');await s.call('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});await s.call('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});await sleep(250);
    await s.navigate('http://127.0.0.1:5176/?tool=calibration');await until(()=>evaluate('Boolean(document.querySelector(".cal-screen"))'),10000,'calibration');
    await capture('calibration-'+width,'.cal-screen');
    await scroll('.cal-inspector','bottom');await capture('calibration-review-'+width,'.cal-screen');
    await evaluate('(()=>{const s=document.querySelector(".cal-mobile-selector select");if(s){s.value="point:beihu";s.dispatchEvent(new Event("change",{bubbles:true}))}return true})()');
    await scroll('.cal-inspector','top');await capture('calibration-point-'+width,'.cal-screen');
    await evaluate('document.querySelector(".cal-manual-geo")?.setAttribute("open","");true');await scroll('.cal-inspector','bottom');await capture('calibration-point-scroll-'+width,'.cal-screen');
  }
  evidence.errors=s.errors;evidence.ok=!s.errors.length&&evidence.frames.every(f=>f.texts.every(t=>t.pass)&&f.vectors.every(t=>t.pass)&&f.controls.every(c=>c.pass!==false));
  evidence.fixture='Long-account frames render the unchanged production MenuScreen/SettingsScreen components in an owned temporary React root with synthetic AccountUser props; callbacks are inert. No account/token/API is used.';
  evidence.metadata={textMethod:'P05 over screenshot background after hiding text/shadow. Foreground color and cumulative opacity included. 4.5 normal / 3 large (>=24px or >=18.66px and weight>=700). Range rectangles clip to viewport and overflow ancestors; fragments below 60% line height are excluded.',excluded:'Disabled, aria-disabled, data-disabled, inert, aria-hidden, screen-reader-only, offscreen, occluded and tiny clipped text fragments. Partially clipped controls are excluded from contour scoring and are covered only when fully visible in the corresponding scrolled capture. Not exhaustive over antialiasing pixels or arbitrary UI states.',vectorMethod:'SVG fill versus its stroke halo, requiring >=1 CSS pixel effective stroke and text contrast threshold. Does not guess the bare map background behind outlined letters.',controlMethod:'Fully visible controls only; screenshot inside/outside neighborhood medians plus actual border/fill/icon/pseudo-element colors; threshold 3. Native checkbox/radio/range also require >=4 actual painted pixels at >=3 against adjacent screenshot background.'};
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify({ok:evidence.ok,frames:evidence.frames.length,errors:s.errors}));
}catch(error){evidence.error=String(error.stack||error);evidence.errors=s?.errors;fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(evidence,null,2));console.error(evidence.error);process.exitCode=1;}
finally{await s?.close();}})();
