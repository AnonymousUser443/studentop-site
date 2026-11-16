#!/usr/bin/env node
/** Owned local worker: native module watch + one SDK child; never opens a standalone UI. */
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawn,spawnSync} from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const app=path.join(root,'apps/aidenos-music');
const port=Number(process.argv[2]);
if(!process.send || !Number.isSafeInteger(port) || port<1024 || port>65535)throw Error('Music watcher requires parent IPC and an exact loopback port.');
let watcher,child,stopping=false,ready=false,stopPromise;
let rejectSdk=()=>{},rejectBuild=()=>{};
function notify(message) {if(process.connected)process.send(message);}
function shutdown(code=0) {
  if(stopPromise)return stopPromise;
  stopping=true;process.exitCode=code;
  rejectSdk(Error('Music startup interrupted.'));rejectBuild(Error('Music build interrupted.'));
  stopPromise=(async()=>{
    try {await watcher?.close();}catch {process.exitCode=1;}
    if(child && child.exitCode===null && child.signalCode===null && child.pid)await new Promise(resolve=>{
      const timer=setTimeout(()=>child.kill(),4000);
      child.once('exit',()=>{clearTimeout(timer);resolve();});
      if(child.connected)child.send({type:'shutdown'},error=>{if(error)child.kill();});else child.kill();
    });
    if(process.connected)process.disconnect();
  })();
  return stopPromise;
}
process.on('message',message=>{if(message?.type==='shutdown')void shutdown(0);});
process.once('disconnect',()=>void shutdown(0));
process.once('SIGINT',()=>void shutdown(0));process.once('SIGTERM',()=>void shutdown(0));

try {
  const sdkReady=new Promise((resolve,reject)=>{
    rejectSdk=reject;
    const timer=setTimeout(()=>reject(Error('Music SDK startup timed out.')),8000);
    child=spawn(process.execPath,[path.join(app,'server/index.mjs')],{
      cwd:app,env:{...process.env,MUSIC_PORT:String(port)},windowsHide:true,
      stdio:['ignore','inherit','inherit','ipc'],
    });
    child.once('error',error=>{clearTimeout(timer);reject(error);});
    child.on('message',message=>{if(message?.type==='ready' && message.id==='music' && message.port===port){clearTimeout(timer);resolve();}});
    child.once('exit',(code,signal)=>{
      clearTimeout(timer);
      if(stopping)return;
      reject(Error('Music SDK exited before readiness.'));
      console.error('Music SDK child exited ('+(code??signal)+').');
      void shutdown(1);
    });
  });
  await sdkReady;
  if(stopping)throw Error('Music startup interrupted.');
  const initialBuild=new Promise((resolve,reject)=>{
    rejectBuild=reject;
    const start=async()=>{
      const {build}=await import(pathToFileURL(path.join(app,'node_modules/vite/dist/node/index.js')).href);
      watcher=await build({root:app,configFile:path.join(app,'vite.config.ts'),
        ...(process.argv[3]?{cacheDir:path.resolve(process.argv[3])}:{}),
        build:{watch:{exclude:['**/node_modules/**','**/*.tmpdir/**','**/.tmp/**']}}});
      if(!watcher || typeof watcher.on!=='function')throw Error('Music build watcher did not start.');
      if(stopping){await watcher.close();reject(Error('Music build interrupted.'));return;}
      watcher.on('event',event=>{
        if(stopping)return;
        if(event.code==='ERROR') {
          notify({type:'music-build',ok:false});
          console.error('Music module build failed: '+String(event.error?.message??'unknown build error').slice(0,500));
          if(!ready)reject(Error('Initial music module build failed.'));
        }
        if(event.code==='BUNDLE_END') {
          const staged=spawnSync(process.execPath,[path.join(root,'tools/build-music.mjs'),'--stage-only'],{cwd:root,stdio:'inherit',windowsHide:true});
          void event.result?.close().catch(()=>{});
          if(staged.status!==0) {
            notify({type:'music-build',ok:false});
            if(!ready)reject(Error('Initial music module staging failed.'));
          } else {notify({type:'music-build',ok:true});resolve();}
        }
      });
    };
    void start().catch(reject);
  });
  await initialBuild;
  if(stopping)throw Error('Music startup interrupted.');
  ready=true;notify({type:'ready',id:'music',port});
} catch(error) {
  if(!stopping)console.error('Music development worker failed: '+String(error.message).slice(0,500));
  await shutdown(stopping?(process.exitCode||0):1);
}
