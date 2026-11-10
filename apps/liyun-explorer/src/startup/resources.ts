import { photoURL } from '../../shared/published.mjs';
export type Asset={url:string;bytes:number;sha256:string};
export type Manifest={format:1;version:string;assets:Asset[]};
export function validateManifest(value:unknown,version:string):value is Manifest {
 const m=value as Manifest;
 return !!m&&m.format===1&&m.version===version&&Array.isArray(m.assets)&&m.assets.length<1000&&m.assets.every(a=>typeof a.url==='string'&&a.url.startsWith('/assets/releases/'+version+'/')&&!a.url.includes('..')&&Number.isFinite(a.bytes)&&a.bytes>=0&&/^[a-f0-9]{64}$/.test(a.sha256))&&new Set(m.assets.map(a=>a.url)).size===m.assets.length;
}
export async function prepareResources(progress:(fraction:number,label:string)=>void){
 const version=document.querySelector<HTMLMetaElement>('meta[name=liyun-release]')?.content;
 if(!version){progress(1,'校园地图已就绪');return {warm:false};}
 let persistent=true;
 const registration='serviceWorker'in navigator?await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).catch(()=>null):null;
 if(registration)await Promise.race([navigator.serviceWorker.ready,new Promise(resolve=>setTimeout(resolve,3000))]);
 const manifestURL='/assets/releases/'+version+'/precache.json';
 let cache:Cache|null=null,meta:Cache|null=null;
 try{cache=await caches.open('liyun-assets-'+version);meta=await caches.open('liyun-manifests-v1');}catch{persistent=false;}
 let response:Response|undefined;
 try{response=await fetch(manifestURL,{cache:'no-cache',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('资源清单暂不可用');}
 catch(error){response=await meta?.match(manifestURL);if(!response)throw error;}
 const manifest:unknown=await response.json();if(!validateManifest(manifest,version))throw Error('资源版本不一致，请重新载入');
 const reusable=new Map<string,{url:string;cache:string}>();
 if(meta)for(const request of await meta.keys()){
  try{const previous=await(await meta.match(request))!.json() as Manifest;
   if(previous.version===version)continue;
   for(const asset of previous.assets)if(/\.(?:webp|png|jpg|jpeg|svg|avif|woff2?|ttf|otf|mp3|opus|ogg|wav)$/.test(asset.url))reusable.set(asset.sha256,{url:asset.url,cache:'liyun-assets-'+previous.version});
  }catch{}
 }
 const total=Math.max(1,manifest.assets.reduce((n,a)=>n+a.bytes,0));let completed=0,index=0,downloaded=0;
 const load=async(asset:Asset)=>{
  let saved=await cache?.match(asset.url);
  if(!saved){const prior=reusable.get(asset.sha256);if(prior)saved=await(await caches.open(prior.cache)).match(prior.url);}
  if(!saved)downloaded++;
  let result=saved??await fetch(asset.url,{cache:'force-cache',signal:AbortSignal.timeout(60000)});
  if(!result.ok)throw Error('资源加载失败，请检查网络后重试');
  // Fully consume and verify bytes before announcing that an asset is ready.
  let bytes=await result.clone().arrayBuffer();
  let hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
  if(hash!==asset.sha256){
   await cache?.delete(asset.url);result=await fetch(asset.url,{cache:'reload',signal:AbortSignal.timeout(60000)});bytes=await result.clone().arrayBuffer();hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
   if(!result.ok||hash!==asset.sha256)throw Error('资源校验失败，请重试');
  }
  if(cache)try{const headers=new Headers(result.headers);headers.delete('Content-Encoding');headers.set('Content-Length',String(bytes.byteLength));await cache.put(asset.url,new Response(bytes,{status:200,headers}));}catch{persistent=false;}
  completed+=asset.bytes;progress(completed/total,saved?'正在展开已珍藏的山水':'正在收集校园的色彩与声音');
 };
 await Promise.all(Array.from({length:4},async()=>{while(index<manifest.assets.length){const asset=manifest.assets[index++];await load(asset);}}));
 const publication=window.__LIYUN_CONTENT__;
 if(publication) {
  const photos=[...new Set(publication.document.sites.flatMap(site=>site.photos.map(p=>photoURL(p.id))))];
  const mediaCache='caches'in window?await caches.open('liyun-public-media-v1').catch(()=>null):null;
  for(const url of photos){const immutable=/\/media\/[a-f0-9]{64}\.webp$/.test(url);const saved=immutable?await mediaCache?.match(url):undefined;const r=saved??await fetch(url,{cache:immutable?'force-cache':'no-cache',signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('地标照片加载失败，请重试');await r.clone().arrayBuffer();if(immutable&&mediaCache)try{await mediaCache.put(url,r.clone());}catch{persistent=false;}}
 }
 await document.fonts.ready;
 try{const shell=await fetch('/',{cache:'no-cache',signal:AbortSignal.timeout(10000)});if(shell.ok&&(await shell.clone().text()).includes('content="'+version+'"'))await(await caches.open('liyun-shell-v1')).put('/',shell);}catch{}

 if(meta)try{await meta.put(manifestURL,new Response(JSON.stringify(manifest),{headers:{'Content-Type':'application/json'}}));}catch{persistent=false;}
 // Keep three complete releases. Shared server resources also preserve old online tabs.
 if(meta)try{const keys=await meta.keys();const keep=keys.slice(-2).map(r=>r.url);keep.push(new URL(manifestURL,location.origin).href);for(const key of keys)if(!keep.includes(key.url)){const old=await(await meta.match(key))!.json() as Manifest;await caches.delete('liyun-assets-'+old.version);await meta.delete(key);}}catch{}
 progress(1,persistent?'山水已备齐，下次从本机展开':'山水已备齐，本次使用浏览器缓存');
 return {warm:downloaded===0};
}
