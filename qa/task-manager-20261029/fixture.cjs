'use strict';
// Synthetic UI-only sampler. It never connects to the Pi or reads host metrics.
const http=require('node:http'),fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {listenBrowserSafe}=require('../ports.cjs');
exports.startFixture=async function(){
  const root=path.resolve(__dirname,'../..');
  const {createDesktopAuth,makeConfig,savePrivate}=await import('../../tools/desktop-auth.mjs');
  const {createTaskManagerProxy}=await import('../../tools/task-manager-proxy.mjs');
  const {publicPath,within}=await import('../../tools/dev-workspace.mjs');
  const privateDir=await fsp.mkdtemp(path.join(os.tmpdir(),'monitor-ui-fixture-'));
  const configFile=path.join(privateDir,'auth.json'),stateFile=path.join(privateDir,'rate-state.json');
  const answer='Synthetic monitor visitor 72';await savePrivate(configFile,await makeConfig(answer));
  let streams=0,totalStreams=0,seq=0,origin,auth,proxy,failed=false;
  const streamResponses=new Set();
  const snapshot=()=>({
    version:1,seq:++seq,sampled_at:new Date().toISOString(),timestamp_ms:Date.now(),uptime_seconds:3600,
    host:{hostname:'synthetic-qa-monitor',model:'Synthetic 4-core test board',os:'Fixture OS',kernel:'fixture',architecture:'test',cpu_model:'Synthetic CPU',cpu_physical_cores:4,cpu_logical_cores:4,cpu_sockets:1,cpu_max_mhz:1500,cache:{l1_bytes:null,l2_bytes:null,l3_bytes:null},gpu_name:null},
    cpu:{percent:37.5,per_core_percent:[12,28,38,72],current_mhz:1200,load_average:[.5,.4,.3],processes:2,threads:4,open_files:null},
    memory:{total_bytes:8589934592,available_bytes:6442450944,used_bytes:2147483648,free_bytes:4294967296,cached_bytes:1073741824,buffers_bytes:134217728,percent:25,swap_total_bytes:0,swap_used_bytes:0,swap_percent:0},
    disks:[{name:'qa-disk',label:'Synthetic storage',kind:'SD',mountpoint:'/',filesystem:'fixture',total_bytes:34359738368,used_bytes:8589934592,free_bytes:25769803776,percent:25,active_percent:15,read_bytes_per_sec:1048576,write_bytes_per_sec:524288,avg_response_ms:2}],
    networks:[{name:'qa-eth',is_up:true,addresses:['192.0.2.10'],speed_mbps:1000,bytes_sent_total:1000000,bytes_received_total:2000000,send_bytes_per_sec:1000,receive_bytes_per_sec:2000}],
    temperature:{celsius:44,high_celsius:null,critical_celsius:null},
    power:{flags_hex:null,current_under_voltage:null,current_throttled:null,current_frequency_capped:null,current_soft_temp_limit:null,under_voltage_occurred:null,throttling_occurred:null,updated_at:null},
    sampling:{interval_seconds:1,process_interval_seconds:3,last_error:null}
  });
  const processes=()=>({sampled_at:new Date().toISOString(),total_count:2,threads_total:4,processes:[
    {pid:42,name:'qa-sampler',user:'fixture',status:'running',cpu_percent:12.5,memory_bytes:33554432,memory_percent:.4,threads:2},
    {pid:73,name:'qa-worker',user:'fixture',status:'sleeping',cpu_percent:2,memory_bytes:16777216,memory_percent:.2,threads:2}
  ]});
  const upstream=http.createServer((req,res)=>{
    if(failed){res.writeHead(503,{'Content-Type':'application/json'});res.end('{"error":"fixture_offline"}');return;}
    if(req.url==='/api/events'){
      res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store'});streams++;totalStreams++;streamResponses.add(res);
      const send=()=>res.write('data: '+JSON.stringify(snapshot())+'\n\n');send();const timer=setInterval(send,500);
      res.on('close',()=>{clearInterval(timer);streams--;streamResponses.delete(res);});return;
    }
    const data=req.url==='/api/health'?{app:'rpi-task-manager',ok:true,ready:true,version:'1.0.0',readonly:true}:req.url==='/api/processes'?processes():req.url==='/api/snapshot'?snapshot():null;
    res.writeHead(data?200:404,{'Content-Type':'application/json'});res.end(JSON.stringify(data||{error:'not_found'}));
  });
  await listenBrowserSafe(upstream);
  const site=await fsp.realpath(path.join(root,'site'));
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8'};
  const server=http.createServer((req,res)=>void(async()=>{
    if(req.headers.host!==new URL(origin).host){res.writeHead(403);res.end();return;}
    if(await auth.handle(req,res))return;if(await proxy.handle(req,res))return;
    if(req.url==='/version.json'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end('{"id":"aaaaaaaaaaaaaaaaaaaaaaaa"}');return;}
    const name=publicPath(req.url);if(!name){res.writeHead(403);res.end();return;}
    const full=await fsp.realpath(path.join(site,name));if(!within(site,full)){res.writeHead(403);res.end();return;}
    res.writeHead(200,{'Content-Type':types[path.extname(full)]||'application/octet-stream','Cache-Control':'no-store','X-Frame-Options':'SAMEORIGIN'});fs.createReadStream(full).pipe(res);
  })().catch(()=>{if(!res.headersSent)res.writeHead(404);res.end();}));
  await listenBrowserSafe(server);origin='http://127.0.0.1:'+server.address().port;
  auth=await createDesktopAuth({root,configFile,stateFile,origin});proxy=createTaskManagerProxy({auth,port:upstream.address().port});
  return {origin,answer,streams:()=>streams,totalStreams:()=>totalStreams,fail(){failed=true;for(const res of streamResponses)res.destroy();},restore(){failed=false;},async close(){await proxy.drain();await auth.drain();server.closeAllConnections();upstream.closeAllConnections();await Promise.all([new Promise(r=>server.close(r)),new Promise(r=>upstream.close(r))]);await fsp.rm(privateDir,{recursive:true,force:true});}};
};
