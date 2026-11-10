import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { io } from 'socket.io-client';
const base=(process.env.SMOKE_BASE||'http://127.0.0.1:8787').replace(/\/$/, '');
const showId=process.env.SMOKE_SHOW;
if (!/^\d{6}$/.test(showId || '')) throw new Error('Set SMOKE_SHOW to a fresh six-digit show code');
const location=new URL(base);
const healthResponse=await fetch(`${base}/api/health`);
assert.equal(healthResponse.status,200);
assert.equal(healthResponse.headers.get('cache-control'),'no-store');
const health=await healthResponse.json();assert.equal(health.ok,true);assert.equal(health.persistence.ok,true);
const state=await fetch(`${base}/api/rooms/${showId}/state`).then(r=>r.json());
assert.equal(state.pageId,'P0-02');assert.equal(state.startedAt,null);assert.equal(state.paused,false);assert.equal(state.blackout,false);assert.equal(state.interaction,null);
const deck=await fetch(`${base}/api/deck`).then(r=>r.json());assert.equal(deck.pages.length,169);assert.equal(deck.pages.some(p=>'speakerNotes' in p||'note' in p),false);
const socket=io(location.origin+'/show-'+showId,{path:location.pathname.replace(/\/$/, '')+'/socket.io',autoConnect:false,transports:['websocket'],reconnection:false,timeout:5000});
try{
 await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);socket.connect()});
 const snapshot=new Promise(resolve=>socket.once('snapshot',resolve));
 const joined=await socket.timeout(5000).emitWithAck('join',{role:'display',visitorId:'final-smoke-readonly-001'});
 assert.equal(joined.ok,true);
 const first=await snapshot;assert.equal(first.authorized,false);assert.deepEqual(first.publicMessages,[]);assert.deepEqual(first.privateMessages,[]);assert.deepEqual(first.results,{});
 const report={ok:true,scope:'Fresh six-digit room',checks:['health 200 and persistence healthy','API responses no-store','show starts on P0-02 with timer and interaction cleared','public deck excludes presenter notes','read-only display snapshot contains no messages or votes'],pages:deck.pages.length};
 await writeFile(new URL('../qa/backend-final-smoke.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{socket.disconnect()}
