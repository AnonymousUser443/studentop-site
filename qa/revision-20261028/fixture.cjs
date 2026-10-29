'use strict';
// Isolated test server with a synthetic answer. Never reads or changes the user's real verifier.
const fs=require('node:fs');const fsp=require('node:fs/promises');const path=require('node:path');const os=require('node:os');const http=require('node:http');
exports.startFixture=async function({siteRoot,versionId="aaaaaaaaaaaaaaaaaaaaaaaa",cacheAssets=false}={}){
 const root=path.resolve(__dirname,'../..');
 const {createDesktopAuth,makeConfig,savePrivate}=await import('../../tools/desktop-auth.mjs');
 const {publicPath,within}=await import('../../tools/dev-workspace.mjs');
 const dir=await fsp.mkdtemp(path.join(os.tmpdir(),'desktop-ui-fixture-'));
 const configFile=path.join(dir,'auth.json'),stateFile=path.join(dir,'rate-state.json');
 const answer='Synthetic browser visitor 72';await savePrivate(configFile,await makeConfig(answer));
 let site=await fsp.realpath(siteRoot || path.join(root,'site'));let auth,origin,offset=0,version=versionId;
 const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8'};
 const server=http.createServer((req,res)=>void(async()=>{
  if(req.headers.host!==new URL(origin).host){res.writeHead(403);res.end();return;}
  if(await auth.handle(req,res))return;
  if(req.url.split("?")[0]==="/version.json"){res.writeHead(200,{"Content-Type":"application/json","Cache-Control":"no-store"});res.end(JSON.stringify({id:version}));return;}
  const release=req.url.match(/^\/assets\/releases\/([a-f0-9]{24})\/(.+)$/);
  const name=release && publicPath("/assets/"+release[2]) ? "assets/releases/"+release[1]+"/"+publicPath("/assets/"+release[2]).slice(7) : publicPath(req.url);if(!name){res.writeHead(403);res.end();return;}
  const file=await fsp.realpath(path.join(site,name));if(!within(site,file)){res.writeHead(403);res.end();return;}
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':cacheAssets && release ? 'public, max-age=31536000, immutable' : 'no-store'});fs.createReadStream(file).pipe(res);
 })().catch(()=>{if(!res.headersSent)res.writeHead(404);res.end();}));
 await require('../ports.cjs').listenBrowserSafe(server);origin='http://127.0.0.1:'+server.address().port;
 auth=await createDesktopAuth({root,configFile,stateFile,origin,now:()=>Date.now()+offset});
 return {origin,answer,async switchSite(folder,id){site=await fsp.realpath(folder);this.setVersion(id);},setVersion(id){if(!/^[a-f0-9]{24}$/.test(id))throw new Error("Invalid test version");version=id;},advance(ms){offset+=ms;},async close(){server.closeAllConnections();await new Promise(r=>server.close(r));await fsp.rm(dir,{recursive:true,force:true});}};
};
exports.login=async function(s,f){
 const {until,sleep}=require('../lib.js');await s.navigate(f.origin+'/');
 await until(()=>s.evaluate('!!window.DesktopGate && ["boot","clock"].includes(lockScreen.dataset.gateView)'),6000,'gate initialized');
 if(await s.evaluate('lockScreen.dataset.gateView==="boot"'))await s.click('#gateSkip');
 await until(()=>s.evaluate('lockScreen.dataset.gatePhase==="clock" && lockScreen.dataset.gateStatus==="ready"'),6000,'gate ready');
 await s.click('#gateLogin');await s.click('#gateAnswer');await s.call('Input.insertText',{text:f.answer});await s.click('#gateSubmit');
 await until(()=>s.evaluate('!Win.isLocked() && !document.querySelector("#desktop").inert'),6000,'server-authenticated desktop');await sleep(250);
};
