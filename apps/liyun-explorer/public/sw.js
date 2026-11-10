/* Static resources only. Account/editor/GPS APIs always go to the network. */
const SHELL='liyun-shell-v1',PUBLIC='liyun-public-media-v1';
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 if(request.mode==='navigate'){
  if(url.pathname!=='/'&&url.pathname!=='/index.html')return;
  event.respondWith((async()=>{const cache=await caches.open(SHELL);try{const response=await fetch(request);if(response.ok)await cache.put('/',response.clone());return response;}catch(error){const saved=await cache.match('/');if(saved)return saved;throw error;}})());return;
 }
 const release=url.pathname.match(/^\/assets\/releases\/([a-f0-9]{24})\//);
 const media=/^\/api\/content\/media\/[a-f0-9]{64}\.webp$/.test(url.pathname);
 if(!release&&!media)return;
 event.respondWith((async()=>{
  const cache=await caches.open(release?'liyun-assets-'+release[1]:PUBLIC);
  const key=new Request(url.href),saved=await cache.match(key);
  if(saved&&request.cache!=='reload'){
   const range=request.headers.get('Range');
   if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);if(match){const bytes=await saved.arrayBuffer(),length=bytes.byteLength;const start=match[1]?Number(match[1]):Math.max(0,length-Number(match[2])),end=match[1]&&match[2]?Math.min(Number(match[2]),length-1):length-1;if(start>=length||end<start)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+length}});const headers=new Headers(saved.headers);headers.set('Content-Range','bytes '+start+'-'+end+'/'+length);headers.set('Content-Length',String(end-start+1));headers.set('Accept-Ranges','bytes');return new Response(bytes.slice(start,end+1),{status:206,headers});}}
   return saved;
  }
  const response=await fetch(request);
  if(response.ok&&response.status===200&&!request.headers.has('Range'))try{await cache.put(key,response.clone());}catch{}
  return response;
 })());
});
