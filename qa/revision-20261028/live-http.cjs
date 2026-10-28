'use strict';
const fs=require('node:fs');const path=require('node:path');
(async()=>{
 const base='http://127.0.0.1:8899',checks=[];
 const check=(name,pass)=>{checks.push({name,pass:!!pass});if(!pass)throw new Error(name);};
 let r=await fetch(base+'/__workspace/health');let data=await r.json();check('workspace_three_services_ready',r.status===200&&data.ok&&data.services.length===3&&data.services.every(x=>x.status==='ready'));
 r=await fetch(base+'/__desktop/auth');data=await r.json();const cookie=r.headers.get('set-cookie').split(';')[0];
 check('real_verifier_configured_without_signin',r.status===200&&data.configured&&data.authenticated===false);
 check('no_verifier_or_identity_in_status',!['hash','salt','rateKey','answer','address','ip','configPath'].some(k=>Object.hasOwn(data,k)));
 check('http_only_same_site_cookie',/HttpOnly; SameSite=Strict/.test(r.headers.get('set-cookie')));
 check('status_never_cached',r.headers.get('cache-control').includes('no-store'));
 const before=data.attemptsRemaining;
 r=await fetch(base+'/__desktop/auth',{method:'POST',headers:{Origin:base,Cookie:cookie,'Content-Type':'application/json','X-Desktop-CSRF':'invalid-test-token'},body:JSON.stringify({answer:'synthetic rejected request'})});
 check('csrf_rejected_before_answer_verification',r.status===403);
 r=await fetch(base+'/__desktop/auth',{headers:{Cookie:cookie}});data=await r.json();check('invalid_request_does_not_use_real_attempts',data.attemptsRemaining===before&&data.authenticated===false);
 for(const url of ['/.env','/.private/auth.json','/tools/desktop-auth.mjs','/../auth.json','/assets/js/../../auth.json','/assets/js/auth.local.json']){r=await fetch(base+url);check('private_path_rejected_'+url,r.status===403);}
 r=await fetch(base+'/',{method:'POST'});check('non_api_post_still_denied',r.status===405);
 r=await fetch(base+'/?skipLock=1');const html=await r.text();check('desktop_initially_inert',/id="desktop"[^>]*inert|inert[^>]*id="desktop"/.test(html));
 check('gate_script_is_loaded',html.includes('boot-lock.js'));
 check('input_has_no_embedded_answer',!/<input[^>]*(?:value="[^"]+")/.test(html));
 r=await fetch(base+'/version.json',{cache:'no-store'});data=await r.json();const built=JSON.parse(fs.readFileSync(path.resolve('dist-site/version.json'),'utf8')).id;
 check('version_metadata_is_public_and_minimal',r.status===200&&Object.keys(data).join()==='id'&&/^[a-f0-9]{24}$/.test(data.id));
 check('live_version_matches_verified_build',data.id===built);
 check('version_metadata_never_cached',r.headers.get('cache-control').includes('no-store'));
 r=await fetch(base+'/version.json',{method:'HEAD'});check('version_head_has_no_body',r.status===200&&(await r.text())==='');
 r=await fetch(base+'/version.json',{method:'POST'});check('version_write_methods_denied',r.status===405);
 const report={ok:true,checks,checked:checks.length,realAnswerUsed:false};fs.writeFileSync(path.join(__dirname,'live-http.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:true,checks:checks.length,realAnswerUsed:false}));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
