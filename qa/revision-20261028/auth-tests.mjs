import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {Readable,PassThrough} from 'node:stream';
import {mkdtemp,rm,readFile,writeFile,mkdir,symlink} from 'node:fs/promises';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {scryptSync} from 'node:crypto';
import path from 'node:path';
import ports from '../ports.cjs';
import {createDesktopAuth,makeConfig,savePrivate,clientAddress,normalizeAnswer,COOLDOWN,acquireAuthLease,privatePaths} from '../../tools/desktop-auth.mjs';
const SYNTHETIC = 'QA-only random visitor answer';
async function fixture(t,{missing=false,secure=false,answer=SYNTHETIC}={}) {
  const dir=await mkdtemp(path.join(os.tmpdir(),'desktop-gate-test-'));
  const configFile=path.join(dir,'auth.json'), stateFile=path.join(dir,'state.json');
  if(!missing) await savePrivate(configFile,await makeConfig(answer));
  let clock=1_800_000_000_000, auth, origin;
  const server=http.createServer((req,res)=>{auth.handle(req,res).then(ok=>{if(!ok){res.writeHead(404);res.end();}}).catch(()=>{res.writeHead(500);res.end();});});
  await ports.listenBrowserSafe(server);
  origin='http://127.0.0.1:'+server.address().port;
  const reload=async()=>{auth=await createDesktopAuth({root:process.cwd(),configFile,stateFile,origin,secure,now:()=>clock});};
  await reload();
  t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});});
  async function client(){
    let cookie='',csrf='';
    return {get cookie(){return cookie;},
      async request(method='GET',answer,extra={}) {
        const res=await fetch(origin+'/__desktop/auth',{method,headers:{...(cookie?{Cookie:cookie}:{}),...(method!=='GET'?{Origin:origin,'Content-Type':'application/json','X-Desktop-CSRF':csrf}:{}),...extra},body:answer===undefined?undefined:JSON.stringify({answer})});
        if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];
        const body=await res.json();if(body.csrfToken)csrf=body.csrfToken;
        return {code:res.status,body,headers:res.headers};
      }};
  }
  return {client,reload,dir,configFile,stateFile,getAuth:()=>auth,advance:ms=>{clock+=ms;},origin};
}
test('private verifier has no answer; answer normalization is bounded',async t=>{
  const f=await fixture(t); const data=await readFile(f.configFile,'utf8');
  assert(!data.includes(SYNTHETIC));assert.equal(normalizeAnswer('  Ａ  '),'A');
  assert.equal(normalizeAnswer('x'.repeat(129)),'');assert.equal(normalizeAnswer('x\n'),'');
});
test('correct answer rotates HttpOnly SameSite session; DELETE revokes it',async t=>{
  const f=await fixture(t),c=await f.client();const a=await c.request();const before=c.cookie;
  assert.equal(a.body.authenticated,false);assert.match(a.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
  assert.equal(a.headers.get('cache-control'),'no-store, private');
  const b=await c.request('POST',SYNTHETIC);assert.equal(b.code,200);assert.equal(b.body.authenticated,true);assert.notEqual(c.cookie,before);
  assert.equal((await c.request()).body.authenticated,true);
  assert.equal((await c.request('DELETE')).body.authenticated,false);
  assert.equal((await c.request()).body.authenticated,false);
});
test('three errors lock for exactly 300 seconds across cookie reset and process reload',async t=>{
  const f=await fixture(t),c=await f.client();await c.request();
  for(let i=1;i<=3;i++){const r=await c.request('POST','wrong');assert.equal(r.code,i===3?429:401);assert.equal(r.body.attemptsRemaining,3-i);}
  const blocked=await c.request('POST',SYNTHETIC);assert.equal(blocked.code,429);assert.equal(blocked.body.retryAfterSeconds,300);
  assert.equal(blocked.headers.get('retry-after'),'300');
  const fresh=await f.client();assert.equal((await fresh.request()).body.retryAfterSeconds,300);
  await f.reload();const next=await f.client();assert.equal((await next.request()).body.retryAfterSeconds,300);
  f.advance(COOLDOWN-1);assert.equal((await next.request('POST',SYNTHETIC)).code,429);
  f.advance(1);assert.equal((await next.request('POST',SYNTHETIC)).code,200);
});
test('parallel errors cannot race the third failure or extend cooldown',async t=>{
  const f=await fixture(t),c=await f.client();await c.request();
  const results=await Promise.all(Array.from({length:10},()=>c.request('POST','wrong')));
  assert.equal(results.filter(r=>r.code===401).length,2);assert.equal(results.filter(r=>r.code===429).length,8);
  const r=await c.request();assert.equal(r.body.attemptsRemaining,0);assert.equal(r.body.retryAfterSeconds,300);
});
test('foreign or missing origin and CSRF rejected without consuming an attempt',async t=>{
  const f=await fixture(t),c=await f.client();await c.request();
  for(const headers of [{Origin:'https://evil.invalid'},{Origin:''},{'X-Desktop-CSRF':'bad'},{'Sec-Fetch-Site':'cross-site'}]) assert.equal((await c.request('POST','wrong',headers)).code,403);
  assert.equal((await c.request()).body.attemptsRemaining,3);
});
test('invalid or oversized input rejected; private state has no raw IP or answer',async t=>{
  const f=await fixture(t),c=await f.client();await c.request();
  assert.equal((await c.request('POST','')).code,400);
  assert.equal((await c.request('POST','x'.repeat(2048))).code,413);
  assert.equal((await c.request('POST','wrong',{'Content-Type':'text/plain'})).code,415);
  await c.request('POST','wrong');const state=await readFile(f.stateFile,'utf8');assert(!state.includes(SYNTHETIC));assert(!state.includes('127.0.0.1'));assert(!state.includes('wrong'));
});
test('missing or corrupt private configuration/state fail closed',async t=>{
  const f=await fixture(t,{missing:true}),c=await f.client();assert.equal((await c.request()).code,503);
  await writeFile(f.configFile,'{}');await f.reload();assert.equal((await c.request()).body.configured,false);
  await savePrivate(f.configFile,await makeConfig(SYNTHETIC));await writeFile(f.stateFile,'broken');await f.reload();assert.equal((await c.request()).code,503);
});
test('proxy headers ignored by default; trusted proxy requires one valid address',()=>{
  const req={socket:{remoteAddress:'::ffff:127.0.0.1'},headers:{'x-real-ip':'203.0.113.12','x-forwarded-for':'198.51.100.2'}};
  assert.equal(clientAddress(req),'127.0.0.1');assert.equal(clientAddress(req,['127.0.0.1']),'203.0.113.12');
  req.headers['x-real-ip']='203.0.113.1,203.0.113.2';assert.throws(()=>clientAddress(req,['127.0.0.1']));
});
test('production cookie is Secure and unsupported methods cannot verify answers',async t=>{
  const f=await fixture(t,{secure:true}),c=await f.client();assert.match((await c.request()).headers.get('set-cookie'),/; Secure/);
  assert.equal((await c.request('PUT')).code,405);
});

test('UTF-8 answers split between every byte are verified without corrupting Chinese input',async t=>{
 const answer='测试专用访客';const f=await fixture(t,{answer}),c=await f.client();const first=await c.request();
 const bytes=Buffer.from(JSON.stringify({answer}));const req=Readable.from(Array.from(bytes,b=>Buffer.from([b])));
 req.url='/__desktop/auth';req.method='POST';req.headers={cookie:c.cookie,origin:f.origin,'content-type':'application/json','x-desktop-csrf':first.body.csrfToken};req.socket={remoteAddress:'127.0.0.1'};
 let code,body;const res={writeHead(n){code=n;},end(x){body=JSON.parse(x);}};
 await f.getAuth().handle(req,res);assert.equal(code,200);assert.equal(body.authenticated,true);
});
test('anonymous session spray is bounded, and existing sessions remain usable',async t=>{
 const f=await fixture(t),legitimate=await f.client();await legitimate.request();let limited=0;
 for(let i=0;i<70;i++){const c=await f.client();const r=await c.request();if(r.code===503)limited++;}
 assert(limited>0);assert.equal((await legitimate.request()).code,200);
 assert.equal((await legitimate.request('POST',SYNTHETIC)).code,200);
 f.advance(60_001);const next=await f.client();assert.equal((await next.request()).code,200);
});
test('one private state cannot be owned by two services and normal release allows restart',async t=>{
 const f=await fixture(t);const file=path.join(f.dir,'service.lock');
 const release=await acquireAuthLease(process.cwd(),file);
 await assert.rejects(acquireAuthLease(process.cwd(),file),/Another auth service/);
 await release();const next=await acquireAuthLease(process.cwd(),file);await next();
});
test('logout invalidates a correct POST whose body was still in flight',async t=>{
 const f=await fixture(t),c=await f.client();const first=await c.request();
 const req=new PassThrough();req.url='/__desktop/auth';req.method='POST';
 req.headers={cookie:c.cookie,origin:f.origin,'content-type':'application/json','x-desktop-csrf':first.body.csrfToken};req.socket={remoteAddress:'127.0.0.1'};
 let code,body;const res={writeHead(n){code=n;},end(x){body=JSON.parse(x);}};
 const pending=f.getAuth().handle(req,res);
 const logout=await c.request('DELETE');assert.equal(logout.code,200);assert.notEqual(logout.body.csrfToken,first.body.csrfToken);
 req.end(JSON.stringify({answer:SYNTHETIC}));await pending;
 assert.equal(code,403);assert.equal(body.authenticated,false);assert.equal((await c.request()).body.authenticated,false);
});
test('private configuration CLI handles synthetic UTF-8 input without echo or overwrite',async t=>{
 const f=await fixture(t),config=path.join(f.dir,'cli','auth.json'),answer='合成验证用语';
 const cli=path.resolve('tools/configure-desktop-auth.mjs');const env={...process.env,DESKTOP_AUTH_CONFIG:config};
 const run=(input,args=['--stdin'])=>spawnSync(process.execPath,[cli,...args],{input,env,encoding:'utf8',windowsHide:true});
 const first=run(Buffer.from(answer+'\n'));assert.equal(first.status,0);assert(!((first.stdout||'')+(first.stderr||'')).includes(answer));
 const saved=await readFile(config,'utf8'),parsed=JSON.parse(saved);assert(!saved.includes(answer));assert.equal(parsed.hash,scryptSync(answer,parsed.salt,64).toString('hex'));
 assert.equal(run(Buffer.from('replacement')).status,1);assert.equal(await readFile(config,'utf8'),saved);
 const invalid=spawnSync(process.execPath,[cli,'--stdin'],{input:Buffer.from([0xff]),env:{...env,DESKTOP_AUTH_CONFIG:path.join(f.dir,'invalid','auth.json')},encoding:'utf8',windowsHide:true});assert.equal(invalid.status,1);
 await assert.rejects(readFile(path.join(f.dir,'invalid','auth.json')),{code:'ENOENT'});
});
test('outside alias pointing into public source cannot hold private configuration',async t=>{
 const f=await fixture(t),repo=path.join(f.dir,'repo'),publicDir=path.join(repo,'site'),alias=path.join(f.dir,'alias');await mkdir(publicDir,{recursive:true});await symlink(publicDir,alias,process.platform==='win32'?'junction':'dir');
 const old=process.env.DESKTOP_AUTH_CONFIG;process.env.DESKTOP_AUTH_CONFIG=path.join(alias,'auth.json');
 try{assert.throws(()=>privatePaths(repo),/outside the repository/);}finally{if(old===undefined)delete process.env.DESKTOP_AUTH_CONFIG;else process.env.DESKTOP_AUTH_CONFIG=old;}
});
