'use strict';
// One production smoke in an empty owned profile; no account, GPS or check-in writes.
const fs=require('node:fs'),path=require('node:path');
const {newSession,until,sleep}=require('../lib.js');
const out=__dirname,checks=[],session=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../.release-local/liyun-ui-publish-session.json'),'utf8').replace(/^\uFEFF/,''));
const check=(name,pass)=>{checks.push({name,pass:!!pass});if(!pass)throw Error(name);};
(async()=>{let s;try{
 s=await newSession({size:'1440x900',hardwareRendering:true,allowPublic:true});
 await s.call('Emulation.setFocusEmulationEnabled',{enabled:true});
 await s.navigate('https://liyun.studentop.cn:14355/');
 await until(()=>s.evaluate('Boolean(document.querySelector(".entry-alt"))'),15000,'guest entry');
 check('expected release served',await s.evaluate('document.querySelector("meta[name=liyun-release]")?.content==='+JSON.stringify(session.version)));
 await s.click('.entry-alt');
 await until(()=>s.evaluate('!document.querySelector(".entry-card")&&Boolean(document.querySelector(".hud-brand-badge"))'),15000,'guest map');
 await sleep(1200);await s.click('.hud-brand-badge');
 await until(()=>s.evaluate('Boolean(document.querySelector(".menu-screen[data-state=open]"))'),45000,'left menu cold public download');
 await sleep(600);await s.screenshot(path.join(out,'menu-production.png'));
 check('left drawer opens',await s.evaluate('(()=>{const r=document.querySelector(".menu-screen .menu-panel")?.getBoundingClientRect()??document.querySelector(".menu-screen").getBoundingClientRect();return !!document.querySelector(".menu-grid [aria-label=设置]")})()'));
 await s.click('.menu-grid [aria-label="设置"]');
 await until(()=>s.evaluate('Boolean(document.querySelector(".settings-screen[data-state=open]"))'),30000,'settings cold public download');
 await sleep(700);await s.screenshot(path.join(out,'settings-production.png'));
 check('settings categories rendered',await s.evaluate('document.querySelectorAll(".settings-screen [role=tab]").length===8'));
 check('production development bridge absent',await s.evaluate('typeof window.__LIYUN__==="undefined"&&!document.querySelector(".cal-screen")'));
 check('no browser errors',s.errors.length===0);
 fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify({ok:true,scope:'Single public guest/menu/settings smoke; no full acceptance rerun',checks,errors:s.errors,completedAt:new Date().toISOString()},null,2));
 console.log(JSON.stringify({ok:true,checks:checks.length,errors:s.errors}));
}catch(e){await s?.screenshot(path.join(out,'failure.png')).catch(()=>{});fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify({ok:false,error:String(e.stack||e),checks,errors:s?.errors},null,2));console.error(e);process.exitCode=1;}finally{await s?.close();}})();
