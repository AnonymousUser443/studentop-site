import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,readFile,writeFile,stat,symlink,mkdir} from 'node:fs/promises';
import {ROOT,MUSIC_APP,preflight,ensureMusicDevConfig,musicApiHealthy} from '../tools/dev-workspace.mjs';
import {makeConfig,savePrivate} from '../tools/desktop-auth.mjs';

async function temporary(t) {
  const directory=await mkdtemp(path.join(os.tmpdir(),'tingchao-workspace-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));return directory;
}
async function freePort() {
  const server=net.createServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen({host:'127.0.0.1',port:0,exclusive:true},resolve);});
  const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port;
}
async function bounded(promise,label,ms=25000) {
  let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label)),ms);})]);}finally{clearTimeout(timer);}
}
async function fixture(t) {
  const directory=await mkdtemp(path.join(os.tmpdir(),'tingchao-workspace-')),site=await freePort();let music=await freePort();while(music===site)music=await freePort();
  const config=path.join(directory,'auth.json');await savePrivate(config,await makeConfig('Synthetic musical visitor 2026'));
  const bootstrap=path.join(directory,'run.mjs'),musicDevRoot=path.join(directory,'private/music-dev');
  await writeFile(bootstrap,`import {run} from ${JSON.stringify(new URL('../tools/dev-workspace.mjs',import.meta.url).href)};\nrun(['--site-only','--music'],{ports:${JSON.stringify({site,music})},musicDevRoot:${JSON.stringify(musicDevRoot)},cacheRoot:${JSON.stringify(path.join(directory,'cache'))}}).catch(()=>{process.exitCode=1;});\n`);
  const owned={directory,site,music,config,bootstrap,musicDevRoot,base:'http://127.0.0.1:'+site};
  t.after(async()=>{await owned.shutdown?.();await rm(directory,{recursive:true,force:true});});
  return owned;
}
function launch(t,f) {
  const child=spawn(process.execPath,[f.bootstrap],{cwd:ROOT,env:{...process.env,DESKTOP_AUTH_CONFIG:f.config},windowsHide:true,stdio:['ignore','pipe','pipe','ipc']});
  let output='',done=false;
  for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{output=(output+chunk).slice(-20000);});
  const exited=new Promise(resolve=>child.once('exit',(code,signal)=>{done=true;resolve({code,signal});}));
  const ready=new Promise((resolve,reject)=>{child.once('error',reject);child.on('message',message=>{if(message?.event==='ready')resolve(message);});child.once('exit',code=>reject(Error('Runner exited '+code+': '+output)));});ready.catch(()=>{});
  async function stop() {if(!done && child.connected)child.send({type:'shutdown'});try{return await bounded(exited,'Shutdown timeout: '+output,9000);}catch(error){child.kill();await bounded(exited,'Forced shutdown timeout',5000);throw error;}}
  f.shutdown=stop;return {child,stop,ready:()=>bounded(ready,'Readiness timeout: '+output,45000),exited:()=>bounded(exited,'Exit timeout: '+output),output:()=>output};
}
async function canListen(port) {
  const server=net.createServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen({host:'127.0.0.1',port,exclusive:true},resolve);});await new Promise(resolve=>server.close(resolve));
}

test('--music preflight checks installed files without creating config/database or probing ports',async()=>{
  const config=path.join(ROOT,'.private/music-dev/config.json');
  const before=await readFile(config).catch(error=>error.code==='ENOENT'?null:Promise.reject(error));
  const plain=await preflight(true);assert.equal(Object.hasOwn(plain,'music'),false);assert.equal(plain.apps.length,0);
  const checked=await preflight(true,{music:true});assert.equal(checked.music.id,'music');assert.equal(checked.music.port,MUSIC_APP.port);
  const after=await readFile(config).catch(error=>error.code==='ENOENT'?null:Promise.reject(error));assert.deepEqual(after,before);
});

test('development music credentials persist privately and invalid or linked files fail closed',async t=>{
  const directory=await temporary(t),privateDir=path.join(directory,'private/music-dev');
  const first=await ensureMusicDevConfig(privateDir),second=await ensureMusicDevConfig(privateDir);assert.deepEqual(first,second);
  assert.match(first.gatewayKey,/^[a-f0-9]{64}$/);assert.match(first.cookieKey,/^[a-f0-9]{64}$/);
  assert((await stat(first.dataDir)).isDirectory());
  if(process.platform!=='win32')assert.equal((await stat(path.join(privateDir,'config.json'))).mode&0o777,0o600);
  await writeFile(path.join(privateDir,'config.json'),'not-json');await assert.rejects(ensureMusicDevConfig(privateDir),/private configuration is invalid/);
  const linked=path.join(directory,'linked'),target=path.join(directory,'target');await mkdir(target);
  await symlink(target,linked,process.platform==='win32'?'junction':'dir');
  await assert.rejects(ensureMusicDevConfig(path.join(linked,'music-dev')),/real directory/);
});

test('music health checks actual bounded app identity and rejects wrong apps, redirects, bodies and timeouts',async t=>{
  let mode='ok';const server=http.createServer((req,res)=>{
    assert.equal(req.url,'/health');assert.equal(req.headers.cookie,undefined);
    if(mode==='hang')return;
    if(mode==='redirect'){res.writeHead(302,{Location:'/other'});res.end();return;}
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(mode==='ok'?'{"ok":true,"app":"aidenos-music","version":1}':mode==='wrong'?'{"ok":true,"app":"wrong","version":1}':mode==='oversize'?'x'.repeat(2048):'not-json');
  });
  await new Promise(resolve=>server.listen({host:'127.0.0.1',port:0},resolve));t.after(()=>{server.closeAllConnections();return new Promise(resolve=>server.close(resolve));});
  assert.equal(await musicApiHealthy(server.address().port),true);
  for(mode of ['wrong','redirect','oversize','bad','hang'])assert.equal(await musicApiHealthy(server.address().port,60),false,mode);
});

test('opt-in launcher owns SDK and module watcher, gates API, retains locked playback lease and releases listeners',async t=>{
  const f=await fixture(t),runner=launch(t,f),ready=await runner.ready();
  assert.deepEqual(ready.services.map(service=>service.id),['site','music']);assert.equal(ready.services[1].build,'ready');
  assert.equal(await musicApiHealthy(f.music),true);
  assert.equal((await fetch(f.base+'/__workspace/health')).status,200);
  assert.equal((await fetch(f.base+'/__desktop/music/v1/session')).status,401);
  const jar=new Map();
  async function request(route,{method='GET',body,headers={}}={}) {
    const response=await fetch(f.base+route,{method,headers:{...(jar.size?{Cookie:[...jar].map(([key,value])=>key+'='+value).join('; ')}:{}),...(method!=='GET'?{Origin:f.base,'Content-Type':'application/json'}:{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
    for(const cookie of response.headers.getSetCookie()){const pair=cookie.split(';')[0],index=pair.indexOf('=');if(pair.slice(index+1))jar.set(pair.slice(0,index),pair.slice(index+1));else jar.delete(pair.slice(0,index));}
    return {status:response.status,body:await response.json()};
  }
  let auth=await request('/__desktop/auth');auth=await request('/__desktop/auth',{method:'POST',body:{answer:'Synthetic musical visitor 2026'},headers:{'X-Desktop-CSRF':auth.body.csrfToken}});assert.equal(auth.body.authenticated,true);
  assert.equal((await request('/__desktop/music/v1/session')).body.data.authenticated,false);
  const lease=await request('/__desktop/music/v1/playback/lease',{method:'POST',body:{},headers:{'X-Desktop-CSRF':auth.body.csrfToken}});assert.equal(lease.status,200);
  const locked=await request('/__desktop/auth',{method:'DELETE',body:{},headers:{'X-Desktop-CSRF':auth.body.csrfToken}});assert.equal(locked.body.authenticated,false);
  assert.equal((await request('/__desktop/music/v1/session')).status,401);
  const resolve=await request('/__desktop/music/v1/playback/resolve',{method:'POST',body:{id:'invalid',quality:'standard'},headers:{'X-Music-Playback-CSRF':lease.body.data.csrfToken}});
  assert.equal(resolve.status,400);assert.equal(resolve.body.error.code,'invalid_request');
  assert.match(runner.output(),/Staged native music assets/);
  const privateConfig=JSON.parse(await readFile(path.join(f.musicDevRoot,'config.json'),'utf8'));
  assert.equal(runner.output().includes(privateConfig.gatewayKey),false);assert.equal(runner.output().includes(privateConfig.cookieKey),false);
  assert.deepEqual(await runner.stop(),{code:0,signal:null});await canListen(f.site);await canListen(f.music);
});

test('a conflicting music port rolls back only owned startup and preserves the existing listener',async t=>{
  const f=await fixture(t),sentinel=http.createServer((req,res)=>res.end('owned-by-someone-else'));
  await new Promise(resolve=>sentinel.listen({host:'127.0.0.1',port:f.music,exclusive:true},resolve));
  t.after(()=>{sentinel.closeAllConnections();return new Promise(resolve=>sentinel.close(resolve));});
  const runner=launch(t,f);assert.deepEqual(await runner.exited(),{code:1,signal:null});
  assert.equal(await fetch('http://127.0.0.1:'+f.music).then(response=>response.text()),'owned-by-someone-else');await canListen(f.site);
});
