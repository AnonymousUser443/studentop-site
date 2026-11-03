import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {openAuthorStore} from './author-store.mjs';import {createAuthorServer} from './author.mjs';import {ringGeometry} from '../shared/authoring.mjs';
const origin='https://liyun.test:14355',inviteKey='synthetic-editor-fixture-20261103';
const box=(left,right)=>ringGeometry([{u:left,v:0},{u:right,v:0},{u:right,v:1},{u:left,v:1}]);
const seed=()=>({schema:2,mapId:'campus-v04-eaa124716c51375f',boundary:{name:'测试校区',geometry:box(0,1)},notes:'',sites:[['west',.25,0,.5],['east',.75,.5,1]].map(([id,u,left,right])=>({id,name:id,subtitle:'',intro:'测试介绍',verse:'',icon:'gate',physical:true,center:{uv:{u,v:.5}},radiusM:40,geometry:box(left,right),photos:[]}))});
async function setup(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'liyun-author-http-')),store=openAuthorStore({dataDir:dir,seed:seed()}),server=createAuthorServer({store,resources:dir,production:true,inviteKey,publicOrigin:origin});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 const call=async(route,{cookie,body,method='GET',headers={}}={})=>{const response=await fetch(base+route,{method,headers:{Origin:origin,...(cookie?{Cookie:cookie}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)});return{status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};};
 const join=async name=>(await call('/api/editor/session',{method:'POST',body:{name,inviteCode:inviteKey}})).cookie;
 return{dir,store,server,base,call,join,async close(){server.closeStreams();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));store.close();const absolute=path.resolve(dir);assert(absolute.startsWith(path.resolve(os.tmpdir())+path.sep+'liyun-author-http-'));fs.rmSync(absolute,{recursive:true,force:true});}};
}
test('team invite, cookie session, CSRF guard and unauthenticated edit protection',async()=>{
 const f=await setup();try{
 assert.equal((await f.call('/api/editor/snapshot')).status,401);
 assert.equal((await f.call('/api/editor/session',{method:'POST',body:{name:'A',inviteCode:'wrong'}})).status,401);
 const cookie=await f.join('成员A');assert(cookie.startsWith('liyun_editor_session='));assert.equal((await f.call('/api/editor/snapshot',{cookie})).status,200);
 const denied=await fetch(f.base+'/api/editor/ops',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json',Origin:'https://other.test'},body:'{}'});assert.equal(denied.status,403);
 await f.call('/api/editor/session',{cookie,method:'DELETE'});assert.equal((await f.call('/api/editor/snapshot',{cookie})).status,401);
 }finally{await f.close();}
});
test('two authenticated clients receive real SSE updates and preserve independent edits',async()=>{
 const f=await setup(),controller=new AbortController();let reader;try{
 const a=await f.join('成员A'),b=await f.join('成员B');
 const stream=await fetch(f.base+'/api/editor/events?clientId=client-b-fixture',{headers:{Cookie:b,Origin:origin},signal:controller.signal});assert.equal(stream.status,200);reader=stream.body.getReader();let buffer='';const decoder=new TextDecoder();
 const next=async revision=>{const until=Date.now()+4000;while(Date.now()<until){let split;while((split=buffer.indexOf('\n\n'))>=0){const event=buffer.slice(0,split);buffer=buffer.slice(split+2);if(event.startsWith('event: snapshot')){const snapshot=JSON.parse(event.split('\ndata: ')[1]);if(snapshot.revision>=revision)return snapshot;}}const chunk=await reader.read();if(chunk.done)throw Error('SSE ended');buffer+=decoder.decode(chunk.value);}throw Error('No SSE update');};
 assert.equal((await next(0)).revision,0);
 const edit=(requestId,clientId,field,value)=>({requestId,clientId,operations:[{type:'set',target:'site:west',field,value,expected:0}]});
 assert.equal((await f.call('/api/editor/ops',{cookie:a,method:'POST',body:edit('request-alpha-1','client-a-fixture','name','A的景点名')})).status,200);
 assert.equal((await next(1)).document.sites[0].name,'A的景点名');
 const merged=await f.call('/api/editor/ops',{cookie:b,method:'POST',body:edit('request-beta-1','client-b-fixture','intro','B的介绍')});assert.equal(merged.status,200);assert.equal(merged.data.document.sites[0].name,'A的景点名');
 const conflict=await f.call('/api/editor/ops',{cookie:b,method:'POST',body:edit('request-beta-2','client-b-fixture','name','过期的名称')});assert.equal(conflict.status,409);assert.equal(conflict.data.snapshot.document.sites[0].name,'A的景点名');
 reader.cancel();reader=null;const reconnect=await f.call('/api/editor/snapshot',{cookie:b});assert.equal(reconnect.data.revision,2);assert.equal(reconnect.data.document.sites[0].intro,'B的介绍');
 assert.deepEqual(f.store.db.prepare('SELECT actor FROM changes ORDER BY revision').all().map(r=>r.actor),['成员A','成员B']);
 }finally{controller.abort();await reader?.cancel().catch(()=>{});await f.close();}
});
test('photos upload as immutable bytes, independent additions merge, draft photos stay private until publish',async()=>{
 const f=await setup();try{
 const a=await f.join('A'),b=await f.join('B'),app=fileURLToPath(new URL('../',import.meta.url));
 const upload=async(id,cookie)=>{const bytes=fs.readFileSync(path.join(app,'public/assets/landmarks',id,'hero.webp'));const response=await fetch(f.base+'/api/editor/media',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'image/webp'},body:bytes});assert.equal(response.status,201);return response.json();};
 const first=await upload('wencui',a),second=await upload('beihu',b);
 for(const[image,cookie,client]of [[first,a,'client-photo-a'],[second,b,'client-photo-b']]){const result=await f.call('/api/editor/ops',{method:'POST',cookie,body:{requestId:'photo-'+image.id.slice(0,20),clientId:client,operations:[{type:'photo',siteId:'west',action:'add',photo:{id:image.id,alt:'测试照片'},expected:0}]}});assert.equal(result.status,200);}
 assert.equal(f.store.snapshot().document.sites[0].photos.length,2);
 assert.equal((await fetch(f.base+'/api/content/media/'+first.id+'.webp')).status,401);
 assert.equal((await f.call('/api/content/published')).data.published,null);
 const published=await f.call('/api/editor/publish',{method:'POST',cookie:a,body:{baseRevision:2,confirmed:true}});assert.equal(published.status,200);
 const publicPhoto=await fetch(f.base+'/api/content/media/'+first.id+'.webp');assert.equal(publicPhoto.status,200);assert.equal(publicPhoto.headers.get('content-type'),'image/webp');assert.equal((await publicPhoto.arrayBuffer()).byteLength,first.bytes);
 const spoof=await fetch(f.base+'/api/editor/media',{method:'POST',headers:{Cookie:a,Origin:origin,'Content-Type':'image/webp'},body:Buffer.from('<svg onload=alert(1)></svg>')});assert.equal(spoof.status,400);
 }finally{await f.close();}
});
test('publish rejects gaps and stale preview revisions without changing public content',async()=>{
 const f=await setup();try{
 const cookie=await f.join('A');await f.call('/api/editor/ops',{method:'POST',cookie,body:{requestId:'gap-operation-1',clientId:'client-gap-fixture',operations:[{type:'set',target:'site:west',field:'geometry',value:box(0,.4),expected:0}]}});
 assert.equal((await f.call('/api/editor/publish',{method:'POST',cookie,body:{baseRevision:0,confirmed:true}})).status,409);
 assert.equal((await f.call('/api/editor/publish',{method:'POST',cookie,body:{baseRevision:1,confirmed:true}})).status,422);
 assert.equal((await f.call('/api/content/published')).data.published,null);
 }finally{await f.close();}
});
