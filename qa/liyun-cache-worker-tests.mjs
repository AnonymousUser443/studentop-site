import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
const source=fs.readFileSync(new URL('../apps/liyun-explorer/public/sw.js',import.meta.url),'utf8');
function harness(){const stores=new Map(),handlers={},calls=[];const origin='https://liyun.test';const key=r=>new URL(typeof r==='string'?r:r.url,origin).href;
 const caches={async open(name){if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name);return {async match(r){return store.get(key(r))?.clone()},async put(r,response){store.set(key(r),response.clone())}}}};
 const self={location:{origin},addEventListener(name,fn){handlers[name]=fn},clients:{claim:async()=>{}},skipWaiting:async()=>{}};
 const fetch=async r=>{calls.push(r);return new Response('0123456789',{headers:{'Content-Type':'audio/ogg'}})};
 vm.runInNewContext(source,{self,caches,fetch,URL,Request,Response,Headers});
 return {stores,calls,caches,async request(url,options={}){let response;const request=options.mode==='navigate'?{url:origin+url,method:'GET',mode:'navigate'}:new Request(origin+url,options);handlers.fetch({request,respondWith(r){response=r}});return response?await response:undefined;}};
}
const asset='/assets/releases/1234567890abcdef12345678/test.opus';
test('immutable assets reuse full cached bytes and honor audio ranges',async()=>{const h=harness();assert.equal(await(await h.request(asset)).text(),'0123456789');assert.equal(await(await h.request(asset)).text(),'0123456789');assert.equal(h.calls.length,1);const r=await h.request(asset,{headers:{Range:'bytes=2-5'}});assert.equal(r.status,206);assert.equal(r.headers.get('Content-Range'),'bytes 2-5/10');assert.equal(await r.text(),'2345');assert.equal(h.calls.length,1);assert.equal((await h.request(asset,{headers:{Range:'bytes=99-'}})).status,416);});
test('reload can recover a corrupt cached response',async()=>{const h=harness();await h.request(asset);await h.request(asset,{cache:'reload'});assert.equal(h.calls.length,2);});
test('account/editor/publication and other origins are never intercepted',async()=>{const h=harness();for(const path of ['/api/progress','/api/session','/api/editor/snapshot','/api/content/published','/version.json','/studio/'])assert.equal(await h.request(path),undefined);assert.equal(h.calls.length,0);});
test('new immutable versions never reuse a different version URL',async()=>{const h=harness();await h.request(asset);await h.request(asset.replace('1234567890abcdef12345678','abcdef1234567890abcdef12'));assert.equal(h.calls.length,2);assert.equal(h.stores.size,2);});
