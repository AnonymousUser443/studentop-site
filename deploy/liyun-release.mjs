import fs from 'node:fs/promises';
import path from 'node:path';
import https from 'node:https';
import tls from 'node:tls';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const ROOT='/opt/projects/liyun',HOST='liyun.studentop.cn';
const digest=b=>createHash('sha256').update(b).digest('hex');
const fail=s=>{throw new Error(s);};
const safe=p=>typeof p==='string'&&!p.includes('\\')&&/^(index\.html|favicon\.svg|assets\/[A-Za-z0-9_./-]+)$/.test(p)&&p.split('/').every(s=>s&&s!=='.'&&s!=='..'&&!s.startsWith('.'));
async function scan(root){const out=[];async function walk(dir,rel=''){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=rel?rel+'/'+e.name:e.name;if(e.isSymbolicLink())fail('Public symlink rejected');if(e.isDirectory())await walk(path.join(dir,e.name),p);else if(e.isFile()){if(!safe(p))fail('Unexpected public path: '+p);const b=await fs.readFile(path.join(dir,e.name));out.push({path:p,size:b.length,sha256:digest(b)});}else fail('Unsupported public file');if(out.length>500)fail('File count exceeded');}}await walk(root);return out.sort((a,b)=>a.path.localeCompare(b.path));}
async function verify(root,files){for(const f of files){if(!safe(f.path)||!Number.isSafeInteger(f.size)||f.size<0||!/^[a-f0-9]{64}$/.test(f.sha256))fail('Invalid file manifest');const p=path.join(root,f.path);if(!(await fs.lstat(p)).isFile())fail('Expected regular file');const b=await fs.readFile(p);if(b.length!==f.size||digest(b)!==f.sha256)fail('Public checksum mismatch: '+f.path);}}
async function put(src,dest){await fs.mkdir(path.dirname(dest),{recursive:true,mode:0o755});await fs.copyFile(src,dest,fs.constants.COPYFILE_EXCL);await fs.chmod(dest,0o644);}
const [op,arg,phase]=process.argv.slice(2);
if(op==='prepare'){
 const session=JSON.parse(await fs.readFile('.release-local/liyun-deploy-session.json','utf8'));const baseline=JSON.parse(await fs.readFile('.release-local/liyun-deploy-inspection/inventory.json','utf8'));
 if(execFileSync('git',['rev-parse','HEAD:apps/liyun-explorer'],{encoding:'utf8'}).trim()!==execFileSync('git',['rev-parse',session.appCommit+':apps/liyun-explorer'],{encoding:'utf8'}).trim())fail('App source moved since reviewed commit');
 execFileSync('git',['diff','--exit-code','--','apps/liyun-explorer']);
 const dist=path.resolve('apps/liyun-explorer/dist'),files=await scan(dist),old=new Map(baseline.files.map(f=>[f.path,f]));const out=path.resolve('.release-local',session.id);
 await fs.mkdir(out,{recursive:false});await fs.mkdir(path.join(out,'payload'));
 for(const f of files){const prev=old.get(f.path);if(f.path!=='index.html'&&prev&&prev.sha256!==f.sha256)fail('Same resource URL changed bytes: '+f.path);f.source=prev?.sha256===f.sha256?'previous':'payload';if(f.source==='payload')await put(path.join(dist,f.path),path.join(out,'payload',f.path));}
 const m={schema:1,...session,previous:baseline.root,baseline,files};await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(m,null,2)+'\n');
 console.log(JSON.stringify({id:m.id,out,files:files.length,payload:files.filter(f=>f.source==='payload').map(f=>({path:f.path,size:f.size})),reused:files.filter(f=>f.source==='previous').length}));
}else{
 if(process.getuid?.()!==0)fail('Remote operation requires root');
 const m=JSON.parse(await fs.readFile(arg,'utf8'));if(m.schema!==1||!/^liyun-\d{8}T\d{6}Z-[a-f0-9]{10}$/.test(m.id)||!/^d42554f163dec8d6fd98f263d8afe5d6e58ad2a6$/.test(m.appCommit)||m.stage!=='/var/tmp/aiden-'+m.id||m.previous!==ROOT+'/releases/20261027T0656Z')fail('Release scope rejected');
 if(m.files.length<3||m.files.length>200||new Set(m.files.map(f=>f.path)).size!==m.files.length)fail('Invalid public file set');
 const rel=ROOT+'/releases/'+m.id,history='/var/lib/aiden-release-history/'+m.id;const old=m.baseline.files,newMap=new Map(m.files.map(f=>[f.path,f]));
 const union=[...m.files,...old.filter(f=>f.path!=='index.html'&&!newMap.has(f.path))];
 async function neighbors(){for(const [p,target]of Object.entries(m.baseline.neighbors))if(await fs.realpath(p)!==target)fail('Unrelated release pointer changed: '+p);for(const [s,before]of Object.entries(m.baseline.services)){const after=execFileSync('systemctl',['show',s,'--property=ActiveState','--property=MainPID'],{encoding:'utf8'}).trim();if(after!==before)fail('Unrelated service state/PID changed: '+s);}}
 if(op==='install'){
  if(!(await fs.lstat(ROOT+'/current')).isSymbolicLink()||await fs.realpath(ROOT+'/current')!==m.previous)fail('Current moved after inventory');await neighbors();await verify(m.previous,old);
  const payload=path.join(path.dirname(arg),'payload'),payloadFiles=m.files.filter(f=>f.source==='payload');await verify(payload,payloadFiles);const actual=await scan(payload);if(actual.length!==payloadFiles.length)fail('Unexpected payload member');
  for(const f of m.files){if(!['previous','payload'].includes(f.source))fail('Unknown copy source');if(f.path!=='index.html'){const prior=old.find(x=>x.path===f.path);if(prior&&prior.sha256!==f.sha256)fail('Resource byte conflict');}}
  await fs.mkdir('/var/lib/aiden-release-history',{recursive:true,mode:0o700});const historyRoot=await fs.lstat('/var/lib/aiden-release-history');if(!historyRoot.isDirectory()||historyRoot.isSymbolicLink())fail('Unsafe history root');await fs.mkdir(history,{recursive:false,mode:0o700});await fs.writeFile(history+'/baseline.json',JSON.stringify(m,null,2)+'\n',{mode:0o600});await fs.mkdir(rel,{recursive:false,mode:0o755});
  for(const f of m.files)await put(path.join(f.source==='payload'?payload:m.previous,f.path),path.join(rel,f.path));
  for(const f of old)if(f.path!=='index.html'&&!newMap.has(f.path))await put(path.join(m.previous,f.path),path.join(rel,f.path));
  await verify(rel,union);const added=[];
  for(const f of m.files){if(f.path==='index.html')continue;const p=path.join(m.previous,f.path);try{await fs.lstat(p);await verify(m.previous,[f]);}catch(e){if(e.code!=='ENOENT')throw e;await put(path.join(rel,f.path),p);added.push(f.path);}}
  await verify(m.previous,old);await fs.writeFile(history+'/compatibility.json',JSON.stringify({oldToNew:union.filter(f=>!newMap.has(f.path)).map(f=>f.path),newToOld:added},null,2)+'\n',{mode:0o600});console.log(JSON.stringify({installed:true,rel,files:union.length,addedToPrevious:added}));
 }else if(op==='check'){
  const previous=phase==='previous',wanted=previous?m.previous:rel;if(await fs.realpath(ROOT+'/current')!==wanted)fail('Unexpected active release');await neighbors();
  const checks=[];const check=(n,b)=>{checks.push({name:n,pass:!!b});if(!b)fail(n);};
  const get=(host,p)=>new Promise((resolve,reject)=>{const q=https.get({hostname:'127.0.0.1',port:443,servername:host,checkServerIdentity:(_,cert)=>tls.checkServerIdentity(host,cert),path:p,headers:{Host:host+':14355','Cache-Control':'no-cache'},timeout:20000},r=>{let size=0;const chunks=[];r.on('data',b=>{size+=b.length;if(size>64000000)q.destroy(new Error('Body limit'));else chunks.push(b);});r.on('end',()=>resolve({status:r.statusCode,headers:r.headers,body:Buffer.concat(chunks)}));});q.on('timeout',()=>q.destroy(new Error('TLS request timeout')));q.on('error',reject);});
  const live=previous?old.find(f=>f.path==='index.html'):m.files.find(f=>f.path==='index.html');const h=await get(HOST,'/');check('active_html_digest',h.status===200&&digest(h.body)===live.sha256);check('html_revalidates',/no-cache|max-age=0/.test(String(h.headers['cache-control']))&&!/immutable/.test(String(h.headers['cache-control'])));
  for(const f of union.filter(f=>f.path!=='index.html')){const r=await get(HOST,'/'+f.path);check('resource:'+f.path,r.status===200&&r.body.length===f.size&&digest(r.body)===f.sha256);if(/\.js$/.test(f.path))check('js_mime:'+f.path,/javascript/.test(String(r.headers['content-type'])));if(/\.css$/.test(f.path))check('css_mime:'+f.path,/text\/css/.test(String(r.headers['content-type'])));}
  const missing=await get(HOST,'/__liyun_missing_release__.js');check('missing_asset_404',missing.status===404);
  for(const [host,p]of [['studentop.cn','/'],['studentop.cn','/voxel-campus/'],['studentop.cn','/campus-entry/'],['genshin.studentop.cn','/'],['frost.studentop.cn','/']])check('neighbor:'+host+p,(await get(host,p)).status===200);
  const auth=await get('studentop.cn','/__desktop/auth');check('private_gate_configured',auth.status===200&&JSON.parse(auth.body.toString()).configured===true);
  const result={ok:true,phase:previous?'rollback':'new-release',id:m.id,checks:checks.length};await fs.writeFile(history+'/'+(previous?'rollback-check':'check')+'.json',JSON.stringify({...result,details:checks},null,2)+'\n',{mode:0o600});console.log(JSON.stringify(result));
 }else if(op==='record'){
  if(await fs.realpath(ROOT+'/current')!==rel)fail('Not active');const receipt={ok:true,id:m.id,appCommit:m.appCommit,current:rel,previous:m.previous,files:union.length,newDistFiles:m.files.length,uploadedFiles:m.files.filter(f=>f.source==='payload').length,compatibility:JSON.parse(await fs.readFile(history+'/compatibility.json','utf8')),neighborsUnchanged:true,servicesAndPIDsUnchanged:true,nginxConfigChanged:false,privateConfigTransferred:false,completedAt:new Date().toISOString()};await fs.writeFile(history+'/receipt.json',JSON.stringify(receipt,null,2)+'\n',{mode:0o600});console.log(JSON.stringify(receipt));
 }else if(op==='receipt')console.log(await fs.readFile(history+'/receipt.json','utf8'));
 else fail('Unknown operation');
}
