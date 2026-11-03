'use strict';
// Basic post-release confirmation only. No collaborative login, editing or publishing.
const fs=require('node:fs'),path=require('node:path');const {newSession,until,sleep}=require('../lib.js');
const checks=[],out=__dirname;const check=(name,value)=>{checks.push({name,pass:!!value});if(!value)throw Error(name);};
(async()=>{let s;try{
 s=await newSession({size:'1440x900',hardwareRendering:true,allowPublic:true});
 await s.navigate('https://liyun.studentop.cn:14355/studio/');
 await until(()=>s.evaluate('!!document.querySelector(".studio-login input[type=password]")'),15000,'production studio invite gate');
 check('public studio displays the protected team join page',await s.evaluate('document.title.includes("校园内容工坊")&&!!document.querySelector(".studio-login form")'));
 await s.screenshot(path.join(out,'production-studio-login.png'));
 await s.navigate('https://liyun.studentop.cn:14355/');await until(()=>s.evaluate('!!document.querySelector(".entry-alt")'),20000,'player entry');
 check('expected player release loaded',await s.evaluate('document.querySelector("meta[name=liyun-release]").content==="c832d8ec9dd83e8df4f34da2"'));
 await s.click('.entry-alt');await until(()=>s.evaluate('!document.querySelector(".entry-card")&&!!document.querySelector("[data-testid=map-scene]")'),10000,'guest map');await sleep(500);
 check('existing guest game remains available',true);await s.screenshot(path.join(out,'production-player.png'));
 check('basic load has no browser errors',s.errors.length===0);
 fs.writeFileSync(path.join(out,'production-smoke.json'),JSON.stringify({ok:true,scope:'Unauthenticated team join gate and one guest game load only; multiplayer acceptance delegated to the owner',checks,errors:s.errors,completedAt:new Date().toISOString()},null,2));console.log(JSON.stringify({ok:true,total:checks.length,errors:s.errors}));
}catch(e){fs.writeFileSync(path.join(out,'production-smoke.json'),JSON.stringify({ok:false,error:String(e.stack||e),checks,errors:s?.errors},null,2));console.error(e);process.exitCode=1;}finally{await s?.close();}})();
