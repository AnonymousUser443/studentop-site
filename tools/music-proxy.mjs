/** Narrow same-origin bridge. Upstream SDK and account cookies live in the music service. */
import http from 'node:http';
const PREFIX='/__desktop/music/v1/';
const GET=/^(?:session|home|search|library|cloud|heart-mode|comments\/[0-9]{1,24}|auth\/qr\/[A-Za-z0-9_-]{1,128}|(?:playlists|albums|artists|lyrics)\/[0-9]{1,24})$/;
const POST=/^(?:auth\/qr|likes|playlists|comments\/[0-9]{1,24}(?:\/like)?|playlists\/[0-9]{1,24}\/tracks|playback\/(?:lease|resolve))$/;
export function createMusicProxy({auth,port=Number(process.env.MUSIC_PORT||8901),gatewayKey=process.env.MUSIC_GATEWAY_KEY,origin}={}){
 if(!auth?.authorizeRead||!auth?.authorizeWrite)throw Error('Music requires desktop authorization.');
 if(!Number.isSafeInteger(port)||port<1024||port>65535)throw Error('Invalid music port.');
 const jobs=new Set();let closing=false;
 function fail(res,status,code,message){if(res.destroyed||res.writableEnded||res.headersSent)return;res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify({ok:false,error:{code,message,retryable:status>=500}}));}
 async function handle(req,res){
  if(typeof req.url!=='string'||!req.url.startsWith('/__desktop/music'))return false;
  const rawPath=req.url.split('?')[0],operation=rawPath.startsWith(PREFIX)?rawPath.slice(PREFIX.length):'';
  const allowed=(req.method==='GET'&&GET.test(operation))||(req.method==='POST'&&POST.test(operation))||(req.method==='DELETE'&&operation==='session');
  if(!allowed){fail(res,404,'invalid_request','音乐接口不存在。');return true;}
  if(closing||!gatewayKey){fail(res,503,'upstream_error','音乐服务暂时没有连接。');return true;}
  const expected=typeof origin==='function'?origin(req):origin;
  if(!expected||(req.headers.origin!==undefined&&req.headers.origin!==expected)||(req.headers['sec-fetch-site']!==undefined&&!['same-origin','none'].includes(req.headers['sec-fetch-site']))||(req.method!=='GET'&&req.headers.origin!==expected)){
   fail(res,403,'forbidden','请求来源不匹配。');return true;
  }
  const playback=operation==='playback/resolve';
  const lease=playback?null:(req.method==='GET'?auth.authorizeRead(req):auth.authorizeWrite(req));
  if(lease&&!lease.ok){fail(res,lease.status,lease.status===401?'authentication_required':'forbidden',lease.status===401?'请先解锁桌面。':'桌面授权未通过。');return true;}
  if(jobs.size>=24){fail(res,429,'rate_limited','音乐请求较多，请稍后再试。');return true;}
  let size=0;const chunks=[];
  if(req.method!=='GET'){
   if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||'')){fail(res,415,'invalid_request','请求格式不正确。');return true;}
   for await(const part of req){size+=part.length;if(size>32768){fail(res,413,'invalid_request','请求内容过大。');return true;}chunks.push(part);}
  }
  if(lease&&!lease.isValid()){fail(res,401,'authentication_required','请重新解锁桌面。');return true;}
  const body=Buffer.concat(chunks);
  await new Promise(resolve=>{
   let done=false;const finish=()=>{if(done)return;done=true;jobs.delete(up);resolve();};
   const musicCookies=String(req.headers.cookie||'').split(';').map(c=>c.trim()).filter(c=>/^(?:AidenMusicSession|AidenMusicPlayback)=/.test(c)).join('; ');
   const up=http.request({host:'127.0.0.1',port,path:req.url,method:req.method,headers:{Host:'127.0.0.1:'+port,'X-Music-Gateway':gatewayKey,'X-Music-Access':playback?'playback':'desktop','X-Music-Playback-CSRF':String(req.headers['x-music-playback-csrf']||''),Cookie:musicCookies,'Content-Type':'application/json','Content-Length':String(body.length)}},reply=>{
    // The local service computes before sending headers; a stalled JSON body is never a music stream.
    reply.setTimeout(2000,()=>terminate(new Error('Music response stalled')));
    const parts=[];let bytes=0;
    reply.on('data',chunk=>{bytes+=chunk.length;if(bytes>4*1024*1024){terminate(new Error('Music response limit'));return;}parts.push(chunk);});
    reply.on('end',()=>{
     if(done||res.destroyed||res.writableEnded||res.headersSent){finish();return;}
     if(lease&&!lease.isValid()){fail(res,401,'authentication_required','请重新解锁桌面。');finish();return;}
     let envelope;try{envelope=JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{fail(res,502,'upstream_error','音乐服务返回了无效内容。');finish();return;}
     if(!/^application\/json(?:;|$)/i.test(reply.headers['content-type']||'')||!envelope||typeof envelope!=='object'||Array.isArray(envelope)||typeof envelope.ok!=='boolean'||(envelope.ok?!Object.hasOwn(envelope,'data'):!envelope.error)||reply.statusCode<200||reply.statusCode>=600||(reply.statusCode>=300&&reply.statusCode<400)){fail(res,502,'upstream_error','音乐服务返回了无效内容。');finish();return;}
     const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Vary':'Cookie'};
     const cookies=reply.headers['set-cookie']?.filter(c=>/^(?:AidenMusicSession|AidenMusicPlayback)=/.test(c));if(cookies?.length)headers['Set-Cookie']=cookies;
     res.writeHead(reply.statusCode||502,headers);res.end(Buffer.concat(parts));finish();
    });reply.on('error',()=>terminate(new Error('Music response interrupted')));reply.on('aborted',()=>terminate(new Error('Music response aborted')));
   });
   function terminate(error){if(done)return;if(!res.headersSent&&!res.destroyed)fail(res,503,'upstream_error','音乐服务暂不可用，请稍后重试。');else if(!res.destroyed)res.destroy();finish();up.destroy(error);}
   jobs.add(up);up.setTimeout(42000,()=>terminate(new Error('Music timeout')));
   up.on('error',terminate);
   res.once('close',()=>{if(!done){finish();up.destroy(new Error('Music client closed'));}});up.end(body);
  });return true;
 }
 return {handle,async drain(){closing=true;for(const request of jobs)request.destroy();}};
}
