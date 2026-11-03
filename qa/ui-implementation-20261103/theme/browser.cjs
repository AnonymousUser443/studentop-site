'use strict';
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { newSession, until, sleep } = require('../../lib.js');
const phase = process.argv[2] || 'after';
if (!['before', 'after'].includes(phase)) throw Error('phase must be before or after');
const out = path.join(__dirname, phase);
fs.mkdirSync(out, { recursive: true });
const selectors = [
  '.hud-brand-sub', '.hud-brand-season', '.hud-pill strong', '.hud-pill-name', '.hud-progress-caption', '.hud-progress-count', '.hud-progress-save', '.location-controls p', '.location-primary', '.hud-dock-label',
  '.map-marker-name strong', '.map-marker-name small',
  '.eyebrow', '.modal-heading h2', '.collection-intro', '.collection-item strong', '.collection-item small', '.landmark-description', '.landmark-verse', '.landmark-reward>span', '.panel-footnote', '.hud-modal .parchment-button',
  '.activity-page-header p', '.activity-page-header h2', '.activity-scroll-caption', '.activity-tab strong', '.activity-tab small', '.activity-category', '.activity-subtitle', '.activity-summary', '.activity-rewards h4', '.activity-rewards h4 small', '.activity-availability', '.activity-primary', '.activity-map-preview', '.activity-page-hint span',
  '.entry-flourish', '.entry-content>small', '.entry-login label>span', '.entry-login-help', '.entry-alt',
];
const browserSnapshot = `(() => {
  const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);let a=1;for(let p=e;p;p=p.parentElement)a*=Number(getComputedStyle(p).opacity);return r.width>1&&r.height>1&&r.right>0&&r.left<innerWidth&&r.bottom>0&&r.top<innerHeight&&s.visibility==='visible'&&s.display!=='none'&&a>.02&&!e.closest('[aria-hidden="true"],[inert]');};
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const c=canvas.getContext('2d',{willReadFrequently:true});
  const rgba=v=>{c.clearRect(0,0,1,1);c.fillStyle=v;c.fillRect(0,0,1,1);return [...c.getImageData(0,0,1,1).data];};
  const props=['color','background-color','border-top-color','border-right-color','border-bottom-color','border-left-color','outline-color','fill','stroke'];
  const colors=new Set(),solidElements=[...document.querySelectorAll('body *')].filter(visible);
  for(const el of solidElements)for(const p of props){const v=getComputedStyle(el).getPropertyValue(p);if(!v||['none','currentcolor'].includes(v)||!CSS.supports('color',v))continue;const a=rgba(v);if(a[3])colors.add(a.join(','));}
  const texts=[];
  for(const selector of ${JSON.stringify(selectors)})for(const e of document.querySelectorAll(selector)){
    if(!visible(e)||e.closest('button:disabled,[aria-disabled="true"]'))continue;
    const s=getComputedStyle(e),rects=[];let text='';
    for(const node of e.childNodes)if(node.nodeType===Node.TEXT_NODE&&node.textContent.trim()){
      text+=node.textContent.trim();const r=document.createRange();r.selectNodeContents(node);for(const b of r.getClientRects())if(b.width>2&&b.height>2)rects.push({x:b.x,y:b.y,width:b.width,height:b.height});
    }
    if(!text||!rects.length)continue;
    let opacity=1;for(let p=e;p;p=p.parentElement)opacity*=Number(getComputedStyle(p).opacity);
    const fontSize=parseFloat(s.fontSize),weight=parseInt(s.fontWeight)||400;
    texts.push({selector,text,fontSize,weight,foreground:rgba(s.color),opacity,threshold:fontSize>=24||(fontSize>=18.66&&weight>=700)?3:4.5,rects});
  }
  const boxes={};for(const selector of ['.hud-frame','.hud-modal','.collection-grid','.hud-context-card','.activity-strip','.activity-scroll','.activity-paper','.activity-event-heading','.activity-information','.activity-footer']){const e=document.querySelector(selector);if(e&&visible(e)){const r=e.getBoundingClientRect();boxes[selector]={x:r.x,y:r.y,width:r.width,height:r.height};}}
  const boundaries=[];
  for(const selector of ['.hud-pill','.hud-icon-button','.hud-context-toggle','.location-primary','.collection-item','.map-marker-gem','.activity-close','.activity-reward'])for(const e of document.querySelectorAll(selector)){
    if(!(selector==='.map-marker-gem'?visible(e.parentElement):visible(e))||e.closest('button:disabled'))continue;
    const s=getComputedStyle(e);let outside=[25,60,55,255];for(let p=e.parentElement;p;p=p.parentElement){const b=rgba(getComputedStyle(p).backgroundColor);if(b[3]>0){outside=b;break;}}
    boundaries.push({selector,kind:selector==='.location-primary'||selector==='.activity-close'?'filled-control':'border',border:rgba(s.borderTopColor),background:rgba(s.backgroundColor),outside});
  }
  return {viewport:[innerWidth,innerHeight],computedMetric:'Distinct nontransparent resolved solid colors (RGBA bytes) across nine computed color properties on visible, non-inert DOM elements, including resolved SVG fill/stroke. Excludes raster pixels, gradient expansion, pseudo-elements and hidden states.',computedColorCount:colors.size,computedColors:[...colors].sort(),texts,boundaries,boxes};
})()`;
function decodePng(buffer) {
  const blocks=[];let offset=8,width,height,type;
  while(offset<buffer.length){const n=buffer.readUInt32BE(offset),tag=buffer.toString('ascii',offset+4,offset+8),body=buffer.subarray(offset+8,offset+8+n);if(tag==='IHDR'){width=body.readUInt32BE(0);height=body.readUInt32BE(4);if(body[8]!==8||body[12]!==0)throw Error('Unsupported PNG');type=body[9];}if(tag==='IDAT')blocks.push(body);offset+=n+12;}
  const channels=type===2?3:type===6?4:0;if(!channels)throw Error('Unsupported PNG color type '+type);
  const packed=zlib.inflateSync(Buffer.concat(blocks)),stride=width*channels,data=Buffer.alloc(stride*height);let at=0;
  const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
  for(let y=0;y<height;y++){const filter=packed[at++];for(let x=0;x<stride;x++){const a=x>=channels?data[y*stride+x-channels]:0,b=y?data[(y-1)*stride+x]:0,c=y&&x>=channels?data[(y-1)*stride+x-channels]:0;const predictor=[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter];data[y*stride+x]=(packed[at++]+predictor)&255;}}
  return {width,height,pixel:(x,y)=>[...data.subarray((y*width+x)*channels,(y*width+x)*channels+3)]};
}
const luminance=rgb=>rgb.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
const mix=(fg,bg,opacity=1)=>fg.slice(0,3).map((v,i)=>v*(fg[3]/255)*opacity+bg[i]*(1-(fg[3]/255)*opacity));
function contrastSamples(snapshot, background) {
  for(const text of snapshot.texts){const samples=[];for(const r of text.rects){const x0=Math.max(0,Math.ceil(r.x+2)),x1=Math.min(background.width,Math.floor(r.x+r.width-2)),y0=Math.max(0,Math.ceil(r.y+r.height*.22)),y1=Math.min(background.height,Math.floor(r.y+r.height*.78));for(let y=y0;y<y1;y+=2)for(let x=x0;x<x1;x+=2){const bg=background.pixel(x,y);samples.push(contrast(mix(text.foreground,bg,text.opacity),bg));}}samples.sort((a,b)=>a-b);text.sampleCount=samples.length;text.minimum=samples[0]??null;text.p05=samples[Math.floor(samples.length*.05)]??null;text.pass=text.p05!==null&&text.p05>=text.threshold;}
  for(const border of snapshot.boundaries){const outside=mix(border.outside,[255,255,255]),inside=mix(border.background,outside);border.ratio=border.kind==='filled-control'?contrast(inside,outside):contrast(mix(border.border,inside),inside);border.pass=border.ratio>=3;}
}
if(require.main===module)(async()=>{
  let s;const evidence={phase,frames:[],errors:[]};
  try{
    s=await newSession({size:'1440x900',hardwareRendering:true});await s.call('Emulation.setFocusEmulationEnabled',{enabled:true});await s.call('Page.bringToFront');
    await s.navigate('http://127.0.0.1:5176/?qa=1&preset=explored');await until(()=>s.evaluate('Boolean(window.__LIYUN__)'),15000,'QA ready');
    await s.evaluate('window.__LIYUN__.setSettings({music:false,uiSound:false,autoDegrade:false});window.__LIYUN__.freeze(1000);true');
    const capture=async(name)=>{
      await sleep(1300);
      await s.evaluate('window.__themePause=document.createElement("style");window.__themePause.textContent="*,*::before,*::after{animation-play-state:paused!important}";document.head.appendChild(window.__themePause);true');
      const data=await s.evaluate(browserSnapshot);data.name=name;
      await s.screenshot(path.join(out,name+'.png'));
      await s.evaluate(`window.__themeHidden=[...new Set(${JSON.stringify(selectors)}.flatMap(s=>[...document.querySelectorAll(s)]))].map(e=>({e,style:e.getAttribute('style')}));for(const {e} of window.__themeHidden){e.style.setProperty('color','transparent','important');e.style.setProperty('-webkit-text-fill-color','transparent','important');e.style.setProperty('text-shadow','none','important')}true`);
      await s.screenshot(path.join(out,name+'-background.png'));
      await s.evaluate('for(const {e,style} of window.__themeHidden){if(style===null)e.removeAttribute("style");else e.setAttribute("style",style)}window.__themePause.remove();true');
      contrastSamples(data,decodePng(fs.readFileSync(path.join(out,name+'-background.png'))));evidence.frames.push(data);
      console.log(JSON.stringify({frame:name,computedColorCount:data.computedColorCount,textChecks:data.texts.length,failed:data.texts.filter(t=>!t.pass).map(({selector,text,p05,threshold})=>({selector,text,p05,threshold}))}));
    };
    for(const [width,height] of [[1440,900],[844,390]]){
      await s.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
      await s.evaluate('window.__LIYUN__.showPanel(null);window.__LIYUN__.setRoute("map");true');
      if(await s.evaluate('document.querySelector(".hud-context-toggle").getAttribute("aria-expanded")==="false"'))await s.click('.hud-context-toggle');
      await capture('map-'+width+'x'+height);
      if(phase==='after'){
        await s.evaluate('window.__LIYUN__.setPreset("fog");window.__LIYUN__.setSettings({music:false,uiSound:false,autoDegrade:false});window.__LIYUN__.freeze(1000);true');
        await capture('map-fog-'+width+'x'+height);
        await s.evaluate('window.__LIYUN__.setPreset("explored");window.__LIYUN__.setSettings({music:false,uiSound:false,autoDegrade:false});window.__LIYUN__.freeze(1000);true');await sleep(300);
      }
      await s.click('[data-testid="dock-collection"]');await until(()=>s.evaluate('Boolean(document.querySelector(".collection-grid"))'),5000,'collection body');await capture('collection-'+width+'x'+height);
      await s.evaluate('window.__LIYUN__.select("beihu");true');await until(()=>s.evaluate('Boolean(document.querySelector(".landmark-description"))'),5000,'landmark body');await capture('landmark-'+width+'x'+height);
      await s.evaluate('window.__LIYUN__.showPanel("activities");true');await until(()=>s.evaluate('Boolean(document.querySelector("[data-testid=activity-screen]"))'),5000,'activity');await capture('activity-'+width+'x'+height);
    }
    await s.evaluate('window.__LIYUN__.showPanel(null);window.__LIYUN__.setEntered(false);true');await s.call('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});await capture('entry-1440x900');
    evidence.errors=s.errors; evidence.captureOk=!s.errors.length; evidence.contrastOk=evidence.frames.every(f=>f.texts.every(t=>t.pass));evidence.boundaryOk=evidence.frames.every(f=>f.boundaries.every(t=>t.pass));evidence.ok=evidence.captureOk&&evidence.contrastOk&&evidence.boundaryOk;
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(evidence,null,2));
    console.log(JSON.stringify({ok:evidence.ok,frames:evidence.frames.length,textChecks:evidence.frames.reduce((n,f)=>n+f.texts.length,0),failedText:evidence.frames.flatMap(f=>f.texts.filter(t=>!t.pass).map(t=>({frame:f.name,...t}))),errors:s.errors}));
  }catch(error){evidence.error=String(error.stack||error);evidence.errors=s?.errors;const result=path.join(out,'results.json'),previous=fs.existsSync(result)?JSON.parse(fs.readFileSync(result,'utf8')):null;fs.writeFileSync(previous?.ok?path.join(out,'capture-error-'+Date.now()+'.json'):result,JSON.stringify(evidence,null,2));console.error(evidence.error);process.exitCode=1;}
  finally{await s?.close();}
})();
else module.exports={decodePng,contrastSamples,contrast,mix};
