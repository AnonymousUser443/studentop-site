'use strict';
const fs=require('node:fs'),path=require('node:path');const {newSession,until,sleep}=require('../lib.js');const report={checks:[],pages:[],screenshots:[]};
const check=(name,pass,detail)=>{report.checks.push({name,pass:!!pass,detail});if(!pass)throw new Error(name);};
(async()=>{
 for(const item of [{id:'campus',url:'http://127.0.0.1:8082/?qa=1',size:'1440x900'},{id:'liyun',url:'http://127.0.0.1:4174/?qa=1&preset=fog',size:'1440x900'},{id:'projects',url:'http://127.0.0.1:8899/projects/',size:'1440x900'},{id:'projects-mobile',url:'http://127.0.0.1:8899/projects/',size:'390x844'}]){
  const s=await newSession({size:item.size});const requests=[];s.client.on('Network.requestWillBeSent',x=>requests.push(x.request.url));
  try{await s.navigate(item.url);await sleep(1400);await s.evaluate('document.fonts.ready.then(()=>true)');
   check(item.id+'_fits_viewport',await s.evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth+1'));
   if(item.id==='campus'){
    await until(()=>s.evaluate('document.querySelector(".campus")?.dataset.phase==="welcome"'),10000,'production 3D welcome');check('production_campus_no_QA',await s.evaluate('typeof window.__CAMPUS_QA__==="undefined"'));check('production_scene_really_ready',await s.evaluate('!!document.querySelector("canvas.is-ready")&&!document.querySelector(".campus-fallback-art")'));
    await s.screenshot(path.join(__dirname,'campus-production.png'));report.screenshots.push('campus-production.png');
    check('production_local_exit',await s.evaluate('document.querySelector("#campus-skip").href==="http://127.0.0.1:5174/"'));check('no_legacy_game_asset_requests',!requests.some(x=>x.includes('/Genshin/')||x.endsWith('.glb')),requests);
   }else if(item.id==='liyun'){check('production_liyun_no_QA',await s.evaluate('typeof window.__LIYUN__==="undefined"'));check('production_liyun_root_present',await s.evaluate('!!document.querySelector(".game-stage")'));await s.screenshot(path.join(__dirname,'liyun-production.png'));}
   else{check(item.id+'_local_campus_link',await s.evaluate('Array.from(document.links).some(a=>a.href==="http://127.0.0.1:8081/")'));await s.screenshot(path.join(__dirname,item.id+'.png'));report.screenshots.push(item.id+'.png');if(item.id==='projects-mobile'){await s.evaluate('document.querySelector(".campus-entry").scrollIntoView({block:"center"});true');await sleep(250);const bounds=await s.evaluate('({clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,entryRight:document.querySelector(".campus-entry").getBoundingClientRect().right,actionRight:document.querySelector(".campus-entry-action").getBoundingClientRect().right})');check('projects_mobile_footer_in_bounds',bounds.entryRight<=bounds.clientWidth+1&&bounds.actionRight<=bounds.clientWidth+1,bounds);await s.screenshot(path.join(__dirname,'projects-mobile-footer.png'));}}
   check(item.id+'_no_console_or_network_errors',s.errors.length===0,s.errors);report.pages.push({...item,ok:true,requests:requests.length});
  }catch(e){report.pages.push({...item,ok:false,error:String(e.stack||e),errors:[...s.errors]});}finally{await s.close();}
 }
 report.ok=report.pages.every(x=>x.ok);fs.writeFileSync(path.join(__dirname,'production-check.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,pages:report.pages}));if(!report.ok)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
