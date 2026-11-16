/** Owned QA desktop: synthetic gate/account data; --live uses only real guest music APIs. */
import http from 'node:http';import fs from 'node:fs';import fsp from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {randomBytes} from 'node:crypto';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';
import {createDesktopAuth,makeConfig,savePrivate} from '../../tools/desktop-auth.mjs';
import {createMusicProxy} from '../../tools/music-proxy.mjs';import {publicPath,within} from '../../tools/dev-workspace.mjs';import {createMusicServer} from '../../apps/aidenos-music/server/app.mjs';
const require=createRequire(import.meta.url),{listenBrowserSafe}=require('../ports.cjs');
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
function syntheticSdk(events=[]){
 const pic='https://p1.music.126.net/tingchao-fixture/cover.jpg';let scanned=0;const liked=new Set(['1']);let nextId=900;
 const titles=['潮生 · 隔离测试音轨','月色经过海面','青绿之间','风从水岸来','回声在远处','给时间一封信','山色入梦','向着晨光'];
 const song=(id)=>({id:Number(id),name:titles[(Number(id)-1)%titles.length],ar:[{id:20,name:'听潮测试乐团'}],al:{id:30,name:'水岸声音 · 测试专辑',picUrl:pic},dt:120000});
 const list=(id,name,extra={})=>({id,name,coverImgUrl:pic,creator:{userId:11,nickname:'隔离测试账号',avatarUrl:pic},trackCount:80,playCount:25000+id,tags:['纯音乐','新国风'],description:'本地隔离验收数据，不连接真实个人音乐库。',...extra});
 const lists=[list(101,'潮汐来信'),list(102,'青绿山川'),list(103,'月落之前'),list(104,'风过水岸'),list(105,'我喜欢的音乐',{specialType:5}),list(106,'给夜晚的回声'),list(107,'山海有声'),list(108,'沿着晨光')];
 lists.push(list(109,'只给自己的私密歌单',{privacy:10}));
 for(let i=110;i<131;i++)lists.push(list(i,'水岸收藏 '+i));
 const commentRows=Array.from({length:47},(_,i)=>({commentId:400+i,user:{userId:71+i,nickname:'听潮听众 '+(i+1),avatarUrl:pic},content:i===0?'潮水经过的地方，留下安静的回声。':'这是第 '+(i+1)+' 条隔离测试评论。',time:1794790800000-i*1000,liked:false,likedCount:12+i,beReplied:i===1?[{beRepliedCommentId:400,user:{userId:71,nickname:'听潮听众 1',avatarUrl:pic},content:'潮水经过的地方，留下安静的回声。'}]:[]}));
 const tracks=new Map(lists.map(item=>[String(item.id),Array.from({length:80},(_,i)=>i+1)]));
 const result=(body,cookie=[])=>({status:200,body:{code:200,...body},cookie});
 return {
  login_qr_key:()=>result({data:{unikey:'synthetic-qr'}}),login_qr_create:async()=>{const qr=createRequire(path.join(ROOT,'apps/aidenos-music/package.json'))('qrcode');return result({data:{qrimg:await qr.toDataURL('https://music.163.com/#/fixture-only')}});},
  login_qr_check:()=>++scanned<2?{status:200,body:{code:801},cookie:[]}:{status:200,body:{code:803},cookie:['MUSIC_U=synthetic-local-account; Path=/','__csrf=synthetic; Path=/']},
  user_account:()=>result({account:{id:11},profile:{userId:11,nickname:'隔离测试账号',avatarUrl:pic}}),
  top_playlist:()=>result({playlists:lists}),personalized:()=>result({result:lists.slice(0,6)}),recommend_resource:()=>result({recommend:lists.slice(0,6)}),recommend_songs:()=>result({data:{dailySongs:titles.map((_,i)=>song(i+1))}}),personalized_newsong:()=>result({result:titles.map((_,i)=>({song:song(i+1)}))}),
  cloudsearch:p=>{const total=p.keywords==='长列表'?230:80;return result({result:p.type===1?{songs:Array.from({length:Math.min(50,total-p.offset)},(_,i)=>song(i+p.offset+1)),songCount:total}:p.type===1000?{playlists:lists,playlistCount:lists.length}:p.type===10?{albums:[{id:30,name:'水岸声音 · 测试专辑',picUrl:pic}],albumCount:1}:{artists:[{id:20,name:'听潮测试乐团',picUrl:pic}],artistCount:1}});},
  playlist_detail:p=>result({playlist:lists.find(x=>String(x.id)===String(p.id))||list(Number(p.id),'新建测试歌单')}),playlist_track_all:p=>result({songs:(tracks.get(String(p.id))||[]).slice(p.offset,p.offset+50).map(song)}),
  album:()=>result({album:{id:30,name:'水岸声音 · 测试专辑',picUrl:pic,description:'独立测试曲目集'},songs:titles.map((_,i)=>song(i+1))}),artists:()=>result({artist:{id:20,name:'听潮测试乐团',picUrl:pic,briefDesc:'仅用于自动验收'},hotSongs:titles.map((_,i)=>song(i+1))}),
  user_playlist:()=>result({playlist:lists}),likelist:()=>result({ids:[...liked].map(Number)}),like:p=>{p.like?liked.add(String(p.id)):liked.delete(String(p.id));events.push({method:'like',id:String(p.id),liked:p.like});return result({});},
  user_playlist_create:()=>result({playlist:lists.filter(item=>item.creator.userId===11),more:false}),
  user_cloud:p=>{const offset=Number(p.offset)||0,limit=Number(p.limit)||50;return result({count:73,hasMore:offset+limit<73,data:Array.from({length:Math.min(limit,73-offset)},(_,i)=>({songId:offset+i+1,songName:'云盘 '+(offset+i+1),simpleSong:{...song(offset+i+1),name:'云盘 · '+song(offset+i+1).name}}))});},
  comment_music:p=>{const offset=Number(p.offset)||0,limit=Number(p.limit)||20;return result({total:commentRows.length,more:offset+limit<commentRows.length,comments:commentRows.slice(offset,offset+limit),hotComments:offset===0?commentRows.slice(0,2):[]});},
  comment_like:p=>{const item=commentRows.find(x=>String(x.commentId)===String(p.cid));if(item){const next=Number(p.t)===1;if(next!==item.liked)item.likedCount+=next?1:-1;item.liked=next;}events.push({method:'comment_like',id:String(p.cid),liked:Number(p.t)===1});return result({});},
  comment:p=>{const quote=commentRows.find(x=>String(x.commentId)===String(p.commentId));commentRows.unshift({commentId:9000+commentRows.length,user:{userId:11,nickname:'隔离测试账号',avatarUrl:pic},content:p.content,time:Date.now(),liked:false,likedCount:0,beReplied:quote?[{beRepliedCommentId:quote.commentId,user:quote.user,content:quote.content}]:[]});events.push({method:'comment',type:Number(p.t),content:p.content,replyTo:p.commentId});return result({});},
  playmode_intelligence_list:p=>{events.push({method:'playmode_intelligence_list',id:String(p.id),pid:String(p.pid)});return result({data:titles.map((_,i)=>({songInfo:song(i+1)}))});},
  playlist_create:p=>{const item=list(++nextId,p.name,{privacy:p.privacy,trackCount:0});lists.push(item);tracks.set(String(item.id),[]);events.push({method:'playlist_create',id:String(item.id),name:p.name,privacy:p.privacy});return result({playlist:item});},playlist_tracks:p=>{const ids=String(p.tracks).split(',').map(Number),old=tracks.get(String(p.pid))||[];const next=p.op==='del'?old.filter(id=>!ids.includes(id)):[...new Set([...old,...ids])];tracks.set(String(p.pid),next);const item=lists.find(x=>String(x.id)===String(p.pid));if(item)item.trackCount=next.length;events.push({method:'playlist_tracks',id:String(p.pid),op:p.op,tracks:ids});return result({});},
  lyric_new:()=>result({lrc:{lyric:'[00:00.00]潮声慢慢走来\n[00:04.00]月色落进心海\n[00:08.00]风从水岸经过\n[00:12.00]把回声交给未来'},yrc:{lyric:'[0,4000](0,1000,0)潮声(1000,1000,0)慢慢(2000,2000,0)走来\n[4000,4000](4000,1000,0)月色(5000,1000,0)落进(6000,2000,0)心海\n[8000,4000](8000,1000,0)风从(9000,1000,0)水岸(10000,2000,0)经过\n[12000,4000](12000,1000,0)把回声(13000,1000,0)交给(14000,2000,0)未来'},tlyric:{lyric:'[00:00.00]The tide comes quietly\n[00:04.00]Moonlight falls into the sea'},romalrc:{lyric:''}}),
  song_url_v1:p=>result({data:[{id:Number(p.id),url:'https://m801.music.126.net/tingchao-fixture.wav',expi:1200,level:'standard',br:128000,freeTrialInfo:null}]}),
 };
}
function wave(){const rate=8000,n=rate*120,b=Buffer.alloc(44+n*2);b.write('RIFF');b.writeUInt32LE(36+n*2,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);for(let i=0;i<n;i++)b.writeInt16LE(Math.round(Math.sin(i/rate*Math.PI*2*220)*100),44+i*2);return b;}
// The production Adapter keeps its HTTPS-only contract. This fixture alone maps
// one synthetic CDN source onto a real local audio element, retaining the public
// source identity seen by the runtime and exposing counts for lifecycle checks.
function audioHarness(live=false){return `<script>(()=>{const NativeAudio=window.Audio;const source='https://m801.music.126.net/tingchao-fixture.wav';const local=location.origin+'/__qa/audio.wav';window.__tingchaoQa={audio:[],errors:[]};addEventListener('error',e=>__tingchaoQa.errors.push(e.message));addEventListener('unhandledrejection',e=>__tingchaoQa.errors.push(String(e.reason)));window.Audio=new Proxy(NativeAudio,{construct(target,args){const real=Reflect.construct(target,args);__tingchaoQa.audio.push(real);if(${live})return real;return new Proxy(real,{get(t,k){if((k==='src'||k==='currentSrc')&&Reflect.get(t,k,t)===local)return source;const v=Reflect.get(t,k,t);return typeof v==='function'?v.bind(t):v;},set(t,k,v){return Reflect.set(t,k,k==='src'&&v===source?local:v,t);}});}});})();</script>`;}
export async function startFixture({live=false,siteRoot=path.join(ROOT,'site'),port}={}){
 const dir=await fsp.mkdtemp(path.join(os.tmpdir(),'tingchao-browser-'));const configFile=path.join(dir,'auth.json');const answer='Synthetic Tingchao visitor 72';await savePrivate(configFile,await makeConfig(answer));
 let auth,music,gateway,origin;const audio=wave(),events=[];
 const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.woff2':'font/woff2','.mp4':'video/mp4'};
 const server=http.createServer((req,res)=>void(async()=>{
  if(req.headers.host!==new URL(origin).host){res.writeHead(403).end();return;}
  if(req.url==='/__qa/audio.wav'){const range=req.headers.range?.match(/bytes=(\d+)-(\d*)/);const start=range?Number(range[1]):0,end=range&&range[2]?Math.min(Number(range[2]),audio.length-1):audio.length-1;res.writeHead(range?206:200,{'Content-Type':'audio/wav','Accept-Ranges':'bytes','Content-Length':end-start+1,...(range?{'Content-Range':`bytes ${start}-${end}/${audio.length}`}:{})});res.end(audio.subarray(start,end+1));return;}
  if(req.url==='/__qa/info'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({mode:live?'live-guest':'synthetic',answer}));return;}
  if(!live&&req.url==='/__qa/events'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(events));return;}
  if(await auth.handle(req,res))return;
  if(!live&&req.url.startsWith('/__desktop/music/')){const originalEnd=res.end.bind(res);res.end=function(chunk,...args){if(chunk){let text=chunk.toString();text=text.replaceAll('https://p1.music.126.net/tingchao-fixture/cover.jpg','/assets/img/music/cover-fallback.webp');chunk=Buffer.from(text);}return originalEnd(chunk,...args);};}
  if(await gateway.handle(req,res))return;
  if(req.url==='/version.json'){res.writeHead(200,{'Content-Type':'application/json'});res.end(fs.existsSync(path.join(siteRoot,'version.json'))?await fsp.readFile(path.join(siteRoot,'version.json')):'{"id":"aaaaaaaaaaaaaaaaaaaaaaaa"}');return;}
  let name=publicPath(req.url);const release=req.url.match(/^\/assets\/releases\/([a-f0-9]{24})\/(.+)$/);if(!name&&release){const asset=publicPath('/assets/'+release[2]);if(asset)name='assets/releases/'+release[1]+'/'+asset.slice(7);}if(!name){res.writeHead(404).end();return;}const file=await fsp.realpath(path.join(siteRoot,name));if(!within(siteRoot,file)){res.writeHead(403).end();return;}
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','Referrer-Policy':'no-referrer'});if(path.basename(file)==='index.html'){res.end((await fsp.readFile(file,'utf8')).replace('<head>','<head>'+audioHarness(live)));return;}fs.createReadStream(file).pipe(res);
 })().catch(()=>{if(!res.headersSent)res.writeHead(500);res.end();}));
 await listenBrowserSafe(server,port?()=>port:undefined);origin='http://127.0.0.1:'+server.address().port;
 auth=await createDesktopAuth({root:ROOT,configFile,stateFile:path.join(dir,'rate-state.json'),origin});
 const key=randomBytes(32).toString('hex');music=createMusicServer({dataDir:path.join(dir,'music'),cookieKey:randomBytes(32).toString('hex'),gatewayKey:key,publicOrigin:origin,secureCookies:false,...(!live?{sdk:syntheticSdk(events)}:{})});await listenBrowserSafe(music.server);
 gateway=createMusicProxy({auth,origin,gatewayKey:key,port:music.server.address().port});
 return {origin,answer,async close(){await gateway.drain();server.closeAllConnections();await new Promise(r=>server.close(r));await auth.drain();await music.close();await fsp.rm(dir,{recursive:true,force:true});}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const at=process.argv.indexOf('--port');const fixture=await startFixture({live:process.argv.includes('--live'),...(process.argv.includes('--built')?{siteRoot:path.join(ROOT,'dist-site')}:{}) ,...(at>=0?{port:Number(process.argv[at+1])}:{})});console.log(JSON.stringify({ready:true,origin:fixture.origin,answer:fixture.answer,mode:process.argv.includes('--live')?'live-guest':'synthetic'}));process.once('SIGINT',()=>void fixture.close());process.once('SIGTERM',()=>void fixture.close());
}
