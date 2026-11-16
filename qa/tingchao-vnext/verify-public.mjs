/** Owner-run, read-only public verification against the reviewed release bytes. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const metadata=JSON.parse(await fs.readFile(process.argv[2],'utf8'));
const manifest=JSON.parse(await fs.readFile(path.join(metadata.out,'manifest.json'),'utf8'));
const origin='https://studentop.cn:14355',checks=[];
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
async function request(route){
 const reply=await fetch(origin+route,{signal:AbortSignal.timeout(30000),redirect:'error'});
 return {status:reply.status,headers:reply.headers,body:Buffer.from(await reply.arrayBuffer())};
}
function check(name,pass,detail={}){checks.push({name,pass:!!pass,...detail});assert(pass,name);}
let completed=false;
try{
 const home=await request('/');
 check('public_home_matches_reviewed_bytes',home.status===200&&sha256(home.body)===manifest.files.find(f=>f.path==='home/index.html').sha256);
 const version=await request('/version.json');
 check('public_version_matches',version.status===200&&JSON.parse(version.body).id===metadata.homeVersion);
 const auth=await request('/__desktop/auth');
 check('desktop_gate_configured',auth.status===200&&JSON.parse(auth.body).configured===true);
 const session=await request('/__desktop/music/v1/session');
 check('music_requires_desktop_and_is_not_cached',session.status===401&&JSON.parse(session.body).error?.code==='authentication_required'&&/no-store/.test(session.headers.get('cache-control')||''));
 const privateIndex=await request('/site-build.json');check('private_build_index_denied',privateIndex.status===403);
 const prefix='home/assets/releases/'+metadata.homeVersion+'/';
 const files=manifest.files.filter(f=>f.path.startsWith(prefix)&&(/\/(?:js\/(?:apps-music|wm)\.js|css\/(?:music-host|shell|paper)\.css)$/.test(f.path)||/\/js\/music\//.test(f.path)||/\/css\/music\//.test(f.path)));
 for(const file of files){
  const reply=await request('/'+file.path.slice(5));
  check('immutable_bytes:'+file.path.slice(prefix.length),reply.status===200&&reply.body.length===file.bytes&&sha256(reply.body)===file.sha256&&/immutable/.test(reply.headers.get('cache-control')||''),{status:reply.status,bytes:reply.body.length,sha256:file.sha256});
 }
 check('renderer_chunks_verified',files.some(f=>/TiltStage-/.test(f.path))&&files.some(f=>/FoliaStage-/.test(f.path)));
 completed=true;
}finally{
 const result={ok:completed&&checks.every(c=>c.pass),at:new Date().toISOString(),release:metadata.id,commit:metadata.commit,homeVersion:metadata.homeVersion,checks};
 await fs.writeFile('docs/tingchao-vnext/public-checks.json',JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({ok:result.ok,checks:checks.length,homeVersion:metadata.homeVersion}));
}
