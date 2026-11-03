'use strict';
// Index distinct evidence scopes without adding overlapping assertions into a fake full-site count.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),app=path.join(root,'apps/liyun-explorer');
const read=file=>JSON.parse(fs.readFileSync(path.resolve(__dirname,file),'utf8'));
const write=(file,value)=>fs.writeFileSync(path.join(__dirname,file),JSON.stringify(value,null,2));
const files={
  cleanup:'pure-cleanup/results.json',
  menu:'menu-settings/verified-focus-fullscreen-2/results.json',press:'menu-settings/press-hitareas/results.json',
  hudLayouts:'hud-layouts/results.json',
  panels:'hud-panels/results.json',runtime:'app-runtime/results.json',world:'world-cinematic/final/results.json',
  pixels:'world-cinematic/final/region-pixels/repaired/results.json',
  calibration:'../../apps/liyun-explorer/src/calibration/qa/final/browser-results.json',
  controls:'control-states/final/results.json',theme:'theme/after/results.json',pages:'theme/pages/after/results.json',
  audio:'audio/results.json',keyboard:'keyboard-production/results.json',degrade:'auto-degrade/results.json',
  build:'checks.json',invariants:'invariants.json',font:'font-coverage.json',poc:'world-cinematic/poc/results.json',
};
const data=Object.fromEntries(Object.entries(files).map(([key,file])=>[key,read(file)]));
for(const[key,value]of Object.entries(data))if(value.ok!==true)throw Error('Not passing: '+key+' '+files[key]);
const index=Object.entries(files).map(([scope,file])=>({scope,file,ok:true,checks:data[scope].total??data[scope].checks?.length??null,frames:data[scope].frames?.length??null}));
write('evidence-index.json',{ok:true,at:new Date().toISOString(),scopes:index,method:'Each row is a distinct test scope. Counts overlap and must not be added as an exhaustive whole-product assertion count.'});
const world=data.world,comparison=read('theme/comparison.json');
const perfGates=world.evidence.performance.map(row=>({quality:row.requestedQuality,elapsedMs:row.elapsedMs,rafFps:row.rafFps,threshold:row.requestedQuality==='low'?28:30,pass:row.elapsedMs>=5000&&row.rafFps>=(row.requestedQuality==='low'?28:30)}));
if(perfGates.length!==3||perfGates.some(row=>!row.pass))throw Error('Desktop three-preset FPS gates not met; preserve failures and investigate');
write('measure.json',{ok:true,views:[[1920,1080],[1440,900],[1280,720],[1024,600],[844,390],[667,375]],states:['map','menu','settings','cinematic'],
  menuAndSettings:{file:files.menu,method:'six viewports, all eight setting categories, scrolling, hit areas and focus'},worldLayouts:world.evidence.layouts,
  hudAndLabelCollisions:{file:files.hudLayouts,layouts:data.hudLayouts.layouts},
  press:{file:files.press,checks:data.press.total},controls:{file:files.controls},
  limits:'Desktop CSS viewport / CDP input. No phone physical touch, OS safe area, or arbitrary map camera/long-content permutation claim.'});
write('perf.json',{ok:true,renderer:world.evidence.renderer,windows:world.evidence.performance,
  gates:perfGates,
  autoDegrade:{file:files.degrade,checks:data.degrade.total,clock:'real5s/30s; rAF throttling and visibility getter are explicitly fault fixtures'},
  firstScreen:data.invariants.evidence.initialJS,dist:data.invariants.evidence.dist,
  limits:'Visible desktop hardware Edge at844x390 andDPR1, not phone performance. Actual Canvas draws differ from rAF; raw counts are retained.'});
const contrastSummary=(value)=>({frames:value.frames.length,textChecks:value.frames.reduce((n,f)=>n+f.texts.length,0),textFailures:value.frames.reduce((n,f)=>n+f.texts.filter(v=>!v.pass).length,0),controls:value.frames.reduce((n,f)=>n+(f.controls?.length??f.boundaries?.length??0),0)});
write('contrast.json',{ok:true,oldPages:contrastSummary(data.theme),newPages:contrastSummary(data.pages),comparison,
  method:'Actual screenshots with text hidden to sample rendered background. P05 contrast: normal4.5/large3; control identifiers3. Disabled/inert/aria-hidden/offscreen/tiny clipped fragments excluded. SVG halo checked independently; native controls checked in screenshot pixels.',
  limits:'The listed frames and sample regions, not exhaustive every-pixel/all-state/all-device compliance.'});
const motion=`# 动效验收与口径\n\nFramer负责HUD/抽屉/设置/Modal进入退场，GSAP负责区域墨散与Cinematic内部，p5负责Canvas；没有两引擎写同一对象transform。\n\n| 行为 | 已验实现 | 证据 |\n| --- | --- | --- |\n| 抽屉与设置 | 受控退场、实际触发焦点、Select/确认Esc层级、hover/press/selected扫光 | menu-settings/README.md、control-states/README.md |\n| 区域墨散 | low0.32s淡出，high0.9s/ultra1.4s径向位移墨散；减少动态立即收敛 | world-cinematic/final/results.json、poc/ |\n| 演出 | normal5.2s/quick2.4s/reduced1s，最后视觉状态等继续，点击/Esc/Space跳过不改存档 | world-cinematic/final/results.json |\n| 系统与游戏偏好 | 两者取或，不将系统投影反写个人配置；减少闪光收敛环光/环境/扫光 | 单测、world-cinematic和menu-settings记录 |\n| 性能降级 | 连续双有效窗(5s/30s)，暂停清空，关闭零采样，只播报一次 | auto-degrade/results.json |\n\nPoC视频来自真实Page.screencast绘制帧与原始时间戳，VFR编码，无生成插帧、不含声音；它不是手机FPS测量。视频在world-cinematic/poc/，纹理与SVG对照见world-cinematic/final/region-pixels/README.md。\n`;
fs.writeFileSync(path.join(__dirname,'motion.md'),motion);
const todo=fs.readFileSync(path.join(app,'TODO.md'),'utf8'),items=[...todo.matchAll(/^- \[([ x])\] (.+)$/gm)].map(m=>({done:m[1]==='x',item:m[2]}));
write('requirements.json',{at:new Date().toISOString(),source:'apps/liyun-explorer/TODO.md',total:items.length,done:items.filter(v=>v.done).length,remaining:items.filter(v=>!v.done),
  deferredByUser:{date:'2026-11-03',answer:'稍后由队员按验收表实测',scope:'physical phone GPS/compass/touch/safe area, speaker listening and phone FPS; no passing claim'},
  allLocalEvidencePassing:true,fieldAndPhysicalDeviceStatus:'Not executed; see FIELD-ACCEPTANCE.md. Do not promote to completion based on desktop fixtures.',
  stages:[
    {id:'P0',state:'isolated unused CSS restore/remove verified: six viewports by four states, all24 paired PNGs exactly equal; full redesign screenshots are separate intentional differences',evidence:['pure-cleanup/results.json','hud-panels/css-prune.json','theme/pixel-differences.json']},
    {id:'P1',state:'implemented/local verified',evidence:['invariants.json','checks.json','hud-panels/results.json']},
    {id:'P2',state:'implemented/local verified',evidence:['vitest-final.json','logs/server-store.log','logs/server-http.log','app-runtime/results.json']},
    {id:'P3',state:'implemented/local verified; physical safe area pending',evidence:['measure.json','contrast.json','FIELD-ACCEPTANCE.md']},
    {id:'P4a',state:'local PoC complete; phone FPS pending',evidence:['world-cinematic/poc/results.json','world-cinematic/final/region-pixels/README.md','perf.json']},
    {id:'P4b',state:'implemented/local verified; field content confirmation pending',evidence:[files.pixels,files.calibration,'regions-check.json','FIELD-ACCEPTANCE.md']},
    {id:'P5',state:'implemented/local verified, latest user left drawer override',evidence:[files.menu,files.controls,files.pages]},
    {id:'P6',state:'implemented/local verified; physical audio pending',evidence:[files.menu,files.audio,files.runtime,'FIELD-ACCEPTANCE.md']},
    {id:'P7',state:'implemented/local verified',evidence:[files.world,files.keyboard]},
    {id:'P8',state:'local checks/documentation complete; physical device acceptance pending',evidence:[files.degrade,files.keyboard,files.controls,files.build,'FIELD-ACCEPTANCE.md']},
  ]});
console.log(JSON.stringify({ok:true,scopes:index.length,checkboxes:items.length,remaining:items.filter(v=>!v.done).length}));
