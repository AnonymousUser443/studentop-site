import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {timingSafeEqual} from 'node:crypto';
import {openAuthorStore,hash} from './author-store.mjs';
import {seedStudioDocument} from '../shared/authoring.mjs';

const COOKIE='liyun_editor_session';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const json=(res,status,value,headers={})=>{const body=JSON.stringify(value);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(body),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(body);};
const cookie=req=>new RegExp('(?:^|;\\s*)'+COOKIE+'=([A-Za-z0-9_-]{43})(?:;|$)').exec(req.headers.cookie??'')?.[1]??null;
async function body(req,limit,asJSON=true){
 let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size<=limit)chunks.push(chunk);}
 if(size>limit)fail(413,'文件或编辑请求过大');const bytes=Buffer.concat(chunks);
 if(!asJSON)return bytes;
 if((req.headers['content-type']??'').split(';')[0]!=='application/json')fail(415,'请求须使用JSON');
 let result;try{result=JSON.parse(bytes.toString('utf8'));}catch{fail(400,'请求不是有效JSON');}
 if(!result||typeof result!=='object'||Array.isArray(result))fail(400,'请求须为对象');return result;
}
function serveFile(req,res,file,type,{privateFile=false,immutable=false}={}){
 if(!fs.existsSync(file)||!fs.statSync(file).isFile())return json(res,404,{error:'资源不存在'});
 const size=fs.statSync(file).size;res.writeHead(200,{'Content-Type':type,'Content-Length':size,'Cache-Control':privateFile?'private, no-store':immutable?'public, max-age=31536000, immutable':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'});
 if(req.method==='HEAD')res.end();else{const stream=fs.createReadStream(file);stream.on('error',()=>res.destroy());stream.pipe(res);}
}

export function createAuthorServer({store,inviteKey=null,production=false,publicOrigin=null,resources,now=Date.now}){
 if(production&&(!inviteKey||inviteKey.length<16||!publicOrigin?.startsWith('https://')))throw Error('Production author service requires an invite key and exact HTTPS origin');
 const clients=new Set(),throttles=new Map();let serial=0;
 const send=(client,event,value)=>{if(client.res.writableLength>2*1024*1024){client.res.end();return;}client.res.write(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`);};
 const presence=()=>{const people=[...clients].map(c=>({id:c.clientId,name:c.user.name}));for(const client of clients)send(client,'presence',people);};
 const broadcast=()=>{const snapshot=store.snapshot();for(const client of clients)send(client,'snapshot',snapshot);};
 const guard=req=>{
  const origin=req.headers.origin;
  if(req.headers['sec-fetch-site']==='cross-site')fail(403,'只允许同源访问');
  if(origin){let parsed;try{parsed=new URL(origin);}catch{fail(403,'来源无效');}
   if(production?origin!==publicOrigin:!['127.0.0.1','localhost','[::1]'].includes(parsed.hostname))fail(403,'只允许同源访问');
  }
  if(['POST','PUT','DELETE','PATCH'].includes(req.method)&&!origin)fail(403,'修改请求需要正确的来源');
 };
 const server=http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url??'/','http://localhost'),route=url.pathname,method=req.method??'GET',token=cookie(req),user=store.session(token);
   if(['GET','HEAD'].includes(method)&&route==='/api/editor/health')return json(res,200,{ok:true,service:'liyun-editor'});
   if(['GET','HEAD'].includes(method)&&route==='/api/content/published')return json(res,200,{published:store.published()});
   if(['GET','HEAD'].includes(method)&&route==='/api/content/map.webp')return serveFile(req,res,path.join(resources,'map.webp'),'image/webp');
   const seed=/^\/api\/content\/seed-media\/(wencui|beihu|library|teaching|wenbo|sports|tower|park)\.webp$/.exec(route);
   if(['GET','HEAD'].includes(method)&&seed)return serveFile(req,res,path.join(resources,'seed-media',seed[1]+'.webp'),'image/webp');
   const media=/^\/api\/content\/media\/([a-f0-9]{64})\.webp$/.exec(route);
   if(['GET','HEAD'].includes(method)&&media){const published=store.isPublicMedia(media[1]);if(!published&&!user)fail(401,'请先加入协作');return serveFile(req,res,store.mediaPath(media[1]),'image/webp',{privateFile:!published,immutable:published});}
   if(['GET','HEAD'].includes(method)&&(route==='/studio'||route.startsWith('/studio/'))){
    if(route==='/studio'){res.writeHead(302,{Location:'/studio/'});res.end();return;}
    const relative=route.slice(8)||'index.html';
    if(!/^(?:index\.html|assets\/(?:[A-Za-z0-9_.-]+\.(?:js|css|woff2|svg)|NotoSerifSC-OFL\.txt))$/.test(relative)||relative.includes('..'))fail(404,'页面不存在');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'");
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.woff2':'font/woff2','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8'};
    return serveFile(req,res,path.join(resources,'studio',relative),types[path.extname(relative)],{immutable:relative.startsWith('assets/')});
   }
   guard(req);
   if(method==='GET'&&route==='/api/editor/session')return json(res,200,{user:user?{name:user.name}:null,inviteRequired:!!inviteKey,localOnly:!production});
   if(method==='POST'&&route==='/api/editor/session'){
    const peer=req.socket.remoteAddress??'local',bucket=throttles.get(peer)??{count:0,until:now()+300000};
    if(bucket.until<=now()){bucket.count=0;bucket.until=now()+300000;}if(bucket.count>=30)fail(429,'尝试次数过多，请稍后再试');
    const value=await body(req,4096);if(typeof value.name!=='string'||!value.name.trim()||value.name.trim().length>32||/[\u0000-\u001f\u007f]/.test(value.name))fail(400,'请填写1–32字的协作昵称');
    const key=typeof value.inviteCode==='string'?value.inviteCode:'';
    if(inviteKey&&!timingSafeEqual(Buffer.from(hash(key),'hex'),Buffer.from(hash(inviteKey),'hex'))){bucket.count++;throttles.set(peer,bucket);fail(401,'协作口令不正确');}
    const fresh=store.createSession(value.name.trim());
    return json(res,200,{user:{name:value.name.trim()}},{'Set-Cookie':`${COOKIE}=${fresh}; Path=/api/; HttpOnly; SameSite=Strict; Max-Age=43200${production?'; Secure':''}`});
   }
   if(!user)fail(401,'协作会话已过期，请重新加入');
   if(method==='DELETE'&&route==='/api/editor/session'){
    store.deleteSession(token);for(const client of clients)if(client.user.id===user.id)client.res.end();
    return json(res,200,{ok:true},{'Set-Cookie':`${COOKIE}=; Path=/api/; HttpOnly; SameSite=Strict; Max-Age=0${production?'; Secure':''}`});
   }
   if(method==='GET'&&route==='/api/editor/snapshot')return json(res,200,store.snapshot());
   if(method==='GET'&&route==='/api/editor/preview'){
    const revision=Number(url.searchParams.get('revision'));if(!Number.isInteger(revision)||revision<0)fail(400,'预览版本无效');return json(res,200,{published:store.preview(revision)});
   }
   if(method==='GET'&&route==='/api/editor/history')return json(res,200,{versions:store.history()});
   if(method==='POST'&&route==='/api/editor/ops'){
    const result=store.apply(await body(req,1024*1024),user.name);broadcast();return json(res,200,result);
   }
   if(method==='POST'&&route==='/api/editor/publish'){
    const result=store.publish(await body(req,4096),user.name);broadcast();return json(res,200,result);
   }
   if(method==='POST'&&route==='/api/editor/media'){
    if((req.headers['content-type']??'').split(';')[0]!=='image/webp')fail(415,'请使用网页的照片选择器上传');
    return json(res,201,store.addMedia(await body(req,4*1024*1024,false)));
   }
   if(method==='GET'&&route==='/api/editor/events'){
    const clientId=url.searchParams.get('clientId');if(!clientId||!/^[-a-zA-Z0-9_]{8,100}$/.test(clientId))fail(400,'客户端编号无效');
    if(clients.size>=48)fail(429,'当前协作连接较多，请稍后再试');
    res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','Connection':'keep-alive','X-Accel-Buffering':'no','X-Content-Type-Options':'nosniff'});res.flushHeaders();
    const client={id:++serial,res,user,clientId};clients.add(client);send(client,'snapshot',store.snapshot());presence();
    const timer=setInterval(()=>{if(!store.session(token)){res.end();return;}res.write(': heartbeat\n\n');},15000);timer.unref();
    res.on('close',()=>{clearInterval(timer);clients.delete(client);presence();});return;
   }
   return json(res,404,{error:'接口不存在'});
  }catch(error){
   if(res.headersSent){res.end();return;}
   const status=Number.isInteger(error.status)?error.status:500;
   if(status===500)console.error('[liyun-editor] request failed');
   json(res,status,{error:status===500?'协作服务暂时不可用':error.message,...(error.conflicts?{conflicts:error.conflicts}:{}),...(error.snapshot?{snapshot:error.snapshot}:{}),...(error.issues?{issues:error.issues}:{}),...(error.report?{report:error.report}:{})});
  }
 });
 server.requestTimeout=20000;server.headersTimeout=10000;server.maxHeadersCount=50;
 server.closeStreams=()=>{for(const client of clients)client.res.end();};
 return server;
}

const isMain=(()=>{try{return !!process.argv[1]&&fs.realpathSync(process.argv[1])===fs.realpathSync(fileURLToPath(import.meta.url));}catch{return false;}})();
if(isMain){
 const root=fileURLToPath(new URL('../',import.meta.url)),production=process.env.NODE_ENV==='production';
 const resources=process.env.LIYUN_AUTHOR_RESOURCES??path.join(root,'.author-resources');
 const dataDir=process.env.LIYUN_AUTHOR_DATA??path.join(root,'.author-data');
 const seed=JSON.parse(fs.readFileSync(path.join(resources,'seed.json'),'utf8'));
 const inviteKey=process.env.LIYUN_EDITOR_KEY_FILE?fs.readFileSync(process.env.LIYUN_EDITOR_KEY_FILE,'utf8').trim():null;
 const store=openAuthorStore({dataDir,seed:seed.schema===2?seed:seedStudioDocument(seed),publishedFile:process.env.LIYUN_PUBLISHED_FILE??path.join(dataDir,'published.json')});
 const server=createAuthorServer({store,resources,inviteKey,production,publicOrigin:process.env.LIYUN_PUBLIC_ORIGIN});
 const port=Number(process.env.LIYUN_AUTHOR_PORT??8790);server.listen(port,'127.0.0.1',()=>console.log('[liyun-editor] listening on loopback port '+port));
 const stop=()=>{server.closeStreams();server.close(()=>{store.close();process.exit(0);});};process.on('SIGINT',stop);process.on('SIGTERM',stop);
}
