import {createHash} from 'node:crypto';
import {afterEach,describe,it,expect,vi} from 'vitest';
import {prepareResources,validateManifest,type Manifest} from './resources';
describe('precache publication boundary',()=>{
 const version='1234567890abcdef12345678',asset={url:'/assets/releases/'+version+'/map.webp',bytes:123,sha256:'a'.repeat(64)};
 it('accepts a matching immutable resource manifest',()=>expect(validateManifest({format:1,version,assets:[asset]},version)).toBe(true));
 it('rejects another version, duplicate paths and untrusted resource locations',()=>{
  expect(validateManifest({format:1,version:'old',assets:[asset]},version)).toBe(false);
  expect(validateManifest({format:1,version,assets:[asset,asset]},version)).toBe(false);
  for(const url of ['https://other.test/x','/api/progress','/assets/releases/'+version+'/../private'])expect(validateManifest({format:1,version,assets:[{...asset,url}]},version)).toBe(false);
  expect(validateManifest({format:1,version,assets:[{...asset,sha256:'bad'}]},version)).toBe(false);
  expect(validateManifest({format:1,version,assets:[null]},version)).toBe(false);
 });
});

const origin='https://liyun.test';
const current='a'.repeat(24),previous='b'.repeat(24);
const manifestURL=(version:string)=>'/assets/releases/'+version+'/precache.json';
const assetURL=(version:string)=>'/assets/releases/'+version+'/map.webp';
const sha=(text:string)=>createHash('sha256').update(text).digest('hex');
const artwork='test map with its roads and lake';
const manifest=(version:string):Manifest=>({format:1,version,assets:[{
 url:assetURL(version),bytes:Buffer.byteLength(artwork),sha256:sha(artwork)
}]});
const html=(version:string)=>'<html><head><meta name="liyun-release" content="'+version+'"></head></html>';
function setup(version=current,online=true,search=''){
 const stores=new Map<string,Map<string,Response>>();
 const writes:string[]=[];
 const store=(name:string)=>{
  if(!stores.has(name))stores.set(name,new Map());
  return stores.get(name)!;
 };
 const absolute=(input:RequestInfo)=>typeof input==='string'?new URL(input,origin).href:input.url;
 const routes=new Map<string,string>([
  [manifestURL(version),JSON.stringify(manifest(version))],
  [assetURL(version),artwork],['/',html(version)]
 ]);
 const fetch=vi.fn(async (input:string,_options?:RequestInit)=>{
  if(!online)throw Error('offline');
  const result=routes.get(input);
  return result===undefined?new Response(null,{status:404}):new Response(result);
 });
 vi.stubGlobal('fetch',fetch);
 vi.stubGlobal('location',new URL('/'+search,origin));
 vi.stubGlobal('navigator',{onLine:online});
 vi.stubGlobal('document',{querySelector:()=>({content:version}),fonts:{ready:Promise.resolve()}});
 vi.stubGlobal('window',{});
 vi.stubGlobal('caches',{
  open:async (name:string)=>({
   match:async (input:RequestInfo)=>store(name).get(absolute(input))?.clone(),
   delete:async (input:RequestInfo)=>store(name).delete(absolute(input)),
   put:async (input:RequestInfo,response:Response)=>{
    writes.push(name+new URL(absolute(input)).pathname);
    store(name).set(absolute(input),response.clone());
   },
   keys:async ()=>Array.from(store(name).keys(),url=>new Request(url)),
  }),
  delete:async (name:string)=>stores.delete(name),
 });
 const seed=(name:string,path:string,body:string,headers?:HeadersInit)=>
  store(name).set(absolute(path),new Response(body,{headers}));
 const release=(id:string,contents:string=artwork)=>{
  seed('liyun-manifests-v1',manifestURL(id),JSON.stringify(manifest(id)));
  seed('liyun-assets-'+id,assetURL(id),contents);
 };
 const published=(photos:string[])=>{
  window.__LIYUN_CONTENT__={document:{sites:[{photos:photos.map(id=>({id}))}]}} as typeof window.__LIYUN_CONTENT__;
 };
 return {routes,writes,fetch,seed,release,published,stores,store};
}
afterEach(()=>vi.unstubAllGlobals());

describe('release loading',()=>{
 it('performs a warm offline refresh without another network request or cache write',async ()=>{
  const fixture=setup(current,false);
  fixture.release(current);
  fixture.seed('liyun-shell-v1','/',html(current));
  fixture.published(['seed-beihu']);
  fixture.seed('liyun-public-media-v1','/api/content/seed-media/beihu.webp','lake',{
   'Content-Type':'image/webp','X-Liyun-SHA256':sha('lake')
  });
  const progress=vi.fn();
  expect(await prepareResources(progress)).toEqual({warm:true});
  expect(fixture.fetch).not.toHaveBeenCalled();
  expect(fixture.writes).toEqual([]);
  expect(progress.mock.lastCall?.[0]).toBe(1);
 });

 it('starts precaching while both publication and the first service worker claim are pending',async ()=>{
  const fixture=setup();
  const worker=new (class extends EventTarget {
   controller:object|null=null;
   register=vi.fn(()=>new Promise<ServiceWorkerRegistration>(()=>{}));
  })();
  vi.stubGlobal('navigator',{onLine:true,serviceWorker:worker});
  let finished!:()=>void;
  const publication=new Promise<void>(resolve=>{finished=resolve;});
  const load=prepareResources(()=>{},publication);
  // Release both independent gates even on failure, so a failed test won't leak work.
  try{
   await vi.waitFor(()=>expect(fixture.fetch.mock.calls.map(([url])=>url)).toContain(assetURL(current)));
   expect(worker.register).toHaveBeenCalledOnce();
  }finally{
   worker.controller={};
   worker.dispatchEvent(new Event('controllerchange'));
   finished();
   await load;
  }
 });

 it('repairs a corrupted same-version asset from the network, writing only that asset',async ()=>{
  const fixture=setup();
  fixture.release(current,'corrupt');
  fixture.seed('liyun-shell-v1','/',html(current));
  expect(await prepareResources(()=>{})).toEqual({warm:false});
  expect(fixture.fetch.mock.calls.map(([url,options])=>[url,options?.cache])).toEqual([[assetURL(current),'reload']]);
  expect(fixture.writes).toEqual(['liyun-assets-'+current+assetURL(current)]);
  expect(await fixture.store('liyun-assets-'+current).get(origin+assetURL(current))?.text()).toBe(artwork);
 });

 it('reuses matching bytes across releases and commits the current shell only after verification',async ()=>{
  const fixture=setup();
  fixture.release(previous);
  fixture.seed('liyun-shell-v1','/',html(previous));
  await prepareResources(()=>{});
  expect(fixture.fetch.mock.calls.map(([url])=>url)).toEqual([manifestURL(current),'/']);
  expect(fixture.writes).toEqual([
   'liyun-assets-'+current+assetURL(current),
   'liyun-shell-v1/',
   'liyun-manifests-v1'+manifestURL(current),
  ]);
  expect(await fixture.store('liyun-shell-v1').get(origin+'/')?.text()).toBe(html(current));
 });

 it('does not replace an offline shell with a release that fails integrity checks',async ()=>{
  const fixture=setup();
  fixture.routes.set(assetURL(current),'busted');
  fixture.seed('liyun-shell-v1','/',html(previous));
  await expect(prepareResources(()=>{})).rejects.toThrow('资源校验失败');
  expect(fixture.fetch.mock.calls.map(([url])=>url)).not.toContain('/');
  expect(await fixture.store('liyun-shell-v1').get(origin+'/')?.text()).toBe(html(previous));
 });

 it('bypasses a legacy worker returning a stale manifest and omits credentials on precache requests',async ()=>{
  const fixture=setup();
  const normal=fixture.fetch.getMockImplementation()!;
  fixture.fetch.mockImplementation(async (url,options)=>{
   if(url===manifestURL(current)&&options?.cache!=='reload')return new Response('{"stale":true}');
   return normal(url,options);
  });
  await prepareResources(()=>{});
  const manifestRequests=fixture.fetch.mock.calls.filter(([url])=>url===manifestURL(current));
  expect(manifestRequests.map(([,options])=>options?.cache)).toEqual(['no-cache','reload']);
  expect(manifestRequests.every(([,options])=>options?.credentials==='omit')).toBe(true);
 });

 it('does not store, or even prefetch, authenticated draft photos',async ()=>{
  const fixture=setup(current,true,'?contentPreview=5');
  fixture.release(current);
  fixture.seed('liyun-shell-v1','/',html(current));
  fixture.published([sha('unpublished photo')]);
  await prepareResources(()=>{});
  expect(fixture.fetch).not.toHaveBeenCalled();
  expect(fixture.writes).toEqual([]);
 });

 it('verifies published photos in bounded parallel lanes and does not rewrite them next time',async ()=>{
  const fixture=setup();
  fixture.release(current);
  fixture.seed('liyun-shell-v1','/',html(current));
  const photos=['lake','library','tower','gate'];
  fixture.published(photos.map(sha));
  const redirects=new Map(photos.map(photo=>['/api/content/media/'+sha(photo)+'.webp',photo]));
  let inFlight=0,peak=0;
  fixture.fetch.mockImplementation(async url=>{
   inFlight++;
   peak=Math.max(inFlight,peak);
   await new Promise(resolve=>setTimeout(resolve,5));
   inFlight--;
   return new Response(redirects.get(url),{headers:{
    'Content-Type':'image/webp','Cache-Control':'public, max-age=31536000, immutable'
   }});
  });
  await prepareResources(()=>{});
  expect(peak).toBe(3);
  expect(fixture.writes).toHaveLength(4);
  fixture.fetch.mockClear();
  fixture.writes.length=0;
  await prepareResources(()=>{});
  expect(fixture.fetch).not.toHaveBeenCalled();
  expect(fixture.writes).toEqual([]);
 });
});
