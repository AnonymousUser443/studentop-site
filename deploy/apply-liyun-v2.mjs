// Owner-authorized Liyun-only transaction; invoke under the shared flock.
// Briefly gates public API writes while snapshotting/upgrading v2 JSON progress to v3.
import fs from 'node:fs';import path from 'node:path';import https from 'node:https';import tls from 'node:tls';
import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';import {pathToFileURL} from 'node:url';import {DatabaseSync} from 'node:sqlite';
const[stage,archiveSHA]=process.argv.slice(2),sha=b=>createHash('sha256').update(b).digest('hex');
const command=(name,args)=>execFileSync(name,args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});
const fail=m=>{throw Error(m)};
if(process.getuid?.()!==0||!/^\/var\/tmp\/aiden-liyun-ui-\d{8}T\d{6}Z-[a-f0-9]{10}$/.test(stage)||!/^[a-f0-9]{64}$/.test(archiveSHA))fail('Invalid invocation');
if(fs.lstatSync(stage).isSymbolicLink()||(fs.statSync(stage).mode&0o777)!==0o700||sha(fs.readFileSync(stage+'/bundle.tar.gz'))!==archiveSHA)fail('Upload directory or archive checksum mismatch');
const work=stage+'/unpacked';fs.mkdirSync(work,{mode:0o700});
execFileSync('python3',['-c',`import sys,tarfile,pathlib
with tarfile.open(sys.argv[1],'r:gz') as t:
 ms=t.getmembers()
 if len(ms)>500 or sum(m.size for m in ms)>50000000: raise RuntimeError('Archive limits')
 for m in ms:
  p=pathlib.PurePosixPath(m.name)
  if p.is_absolute() or '..' in p.parts or chr(92) in m.name or not(m.isfile() or m.isdir()): raise RuntimeError('Unsafe member')
  if not(m.name=='manifest.json' or m.name in ('public','public/','api','api/') or m.name.startswith(('public/','api/'))): raise RuntimeError('Unexpected member')
 t.extractall(sys.argv[2],filter='data')`,stage+'/bundle.tar.gz',work]);
const m=JSON.parse(fs.readFileSync(work+'/manifest.json','utf8'));
if(m.format!==1||!/^liyun-ui-\d{8}T\d{6}Z-[a-f0-9]{10}$/.test(m.id)||!Array.isArray(m.files)||m.files.length>200)fail('Manifest rejected');
const ROOT='/opt/projects/liyun',API='/opt/projects/liyun-api',PROJECTS='/etc/nginx/sites-available/projects',DATA='/var/lib/liyun-account';
const rel=ROOT+'/releases/'+m.id,apiRel=API+'/releases/'+m.id,history='/var/lib/aiden-release-history/'+m.id;
const oldFront=m.baseline.pointers[ROOT],oldApi=m.baseline.pointers[API];
for(const[root,target]of Object.entries(m.baseline.pointers))if(fs.realpathSync(root+'/current')!==target)fail('Baseline pointer moved: '+root);
for(const[file,digest]of Object.entries(m.baseline.configs))if(sha(fs.readFileSync(file))!==digest)fail('Baseline config moved: '+file);
for(const name of ['server.mjs','store.mjs','progress.mjs'])if(sha(fs.readFileSync(oldApi+'/'+name))!==m.baseline.apiFiles[name])fail('API baseline changed');
const listed=new Set();for(const f of m.files){if(!/^(?:public\/(?:index\.html|assets\/[A-Za-z0-9_./-]+)|api\/(?:server\.mjs|store\.mjs|progress\.mjs|shared\/game-settings\.mjs))$/.test(f.path)||f.path.split('/').some(p=>p==='..'||p.startsWith('.'))||listed.has(f.path))fail('Unsafe manifest path');listed.add(f.path);const p=work+'/'+f.path,b=fs.readFileSync(p);if(!fs.lstatSync(p).isFile()||fs.lstatSync(p).isSymbolicLink()||b.length!==f.bytes||sha(b)!==f.sha256)fail('Payload checksum: '+f.path);}
function walk(dir,rel=''){const out=[];for(const e of fs.readdirSync(dir,{withFileTypes:true})){const n=rel?rel+'/'+e.name:e.name;if(e.isSymbolicLink())fail('Unexpected symlink');if(e.isDirectory())out.push(...walk(dir+'/'+e.name,n));else if(e.isFile())out.push(n);else fail('Special file');}return out;}
if(walk(work).some(f=>f!=='manifest.json'&&!listed.has(f)))fail('Unlisted file');
if(sha(fs.readFileSync(work+'/api/store.mjs'))!==m.baseline.apiFiles['store.mjs']||sha(fs.readFileSync(work+'/api/server.mjs'))!==m.baseline.apiFiles['server.mjs'])fail('Unreviewed DB/server migration');
const apiSame=m.files.filter(f=>f.path.startsWith('api/')).every(f=>fs.existsSync(oldApi+'/'+f.path.slice(4))&&sha(fs.readFileSync(oldApi+'/'+f.path.slice(4)))===f.sha256);
command('nginx',['-t']);fs.mkdirSync(history,{recursive:false,mode:0o700});fs.writeFileSync(history+'/manifest.json',JSON.stringify(m,null,2),{mode:0o600});
const originalConfig=fs.readFileSync(PROJECTS);fs.writeFileSync(history+'/projects.before',originalConfig,{mode:0o600});
const checks=[];function check(name,pass){checks.push({name,pass:!!pass});if(!pass)fail(name);}
function copy(src,dst){fs.mkdirSync(path.dirname(dst),{recursive:true,mode:0o755});fs.copyFileSync(src,dst,fs.constants.COPYFILE_EXCL);fs.chmodSync(dst,0o644);}
function keep(src,dst){if(fs.existsSync(dst)){if(fs.lstatSync(dst).isSymbolicLink()||sha(fs.readFileSync(src))!==sha(fs.readFileSync(dst)))fail('Immutable URL conflict');}else copy(src,dst);}
function switchTo(root,target){if(!target.startsWith(root+'/releases/'))fail('Invalid release target');const temp=root+'/.activate-'+m.id;fs.symlinkSync(target,temp);fs.renameSync(temp,root+'/current');}
function get(urlPath,host='liyun.studentop.cn'){return new Promise((resolve,reject)=>{const q=https.get({hostname:'127.0.0.1',port:443,agent:false,servername:host,checkServerIdentity:(_,cert)=>tls.checkServerIdentity(host,cert),path:urlPath,headers:{Host:host+':14355','Accept-Encoding':'identity','Cache-Control':'no-cache'},timeout:15000},r=>{const chunks=[];let size=0;r.on('data',b=>{size+=b.length;if(size>32000000)q.destroy(Error('Body limit'));else chunks.push(b)});r.on('end',()=>resolve({status:r.statusCode,body:Buffer.concat(chunks),headers:r.headers}));r.on('error',reject)});q.on('error',reject);q.on('timeout',()=>q.destroy(Error('TLS timeout')));});}
async function waitStatus(urlPath,status){for(let i=0;i<40;i++){try{if((await get(urlPath)).status===status)return true;}catch{}await new Promise(r=>setTimeout(r,200));}return false;}
function counts(){const db=new DatabaseSync(DATA+'/liyun.sqlite',{readOnly:true});try{return Object.fromEntries(['users','sessions','checkins','progress'].map(t=>[t,db.prepare('SELECT count(*) n FROM '+t).get().n]));}finally{db.close();}}
let gated=false,stopped=false,dbSaved=false,frontSwitched=false,apiSwitched=false,committed=false;
function snapshotDb(dir){fs.mkdirSync(dir,{mode:0o700});for(const name of ['liyun.sqlite','liyun.sqlite-wal','liyun.sqlite-shm'])if(fs.existsSync(DATA+'/'+name)){fs.copyFileSync(DATA+'/'+name,dir+'/'+name);fs.chmodSync(dir+'/'+name,0o600);}}
function restoreDb(){if(!dbSaved)return;snapshotDb(history+'/db-before-rollback');for(const name of ['liyun.sqlite','liyun.sqlite-wal','liyun.sqlite-shm']){const saved=history+'/db-before/'+name,dest=DATA+'/'+name;if(fs.existsSync(saved)){fs.copyFileSync(saved,dest);fs.chmodSync(dest,0o600);command('chown',['liyun-account:liyun-account',dest]);}else if(fs.existsSync(dest))fs.unlinkSync(dest);}}
function restoreConfig(){fs.writeFileSync(PROJECTS,originalConfig,{mode:0o644});command('nginx',['-t']);command('systemctl',['reload','nginx']);gated=false;}
try{
 fs.mkdirSync(rel,{mode:0o755});if(!apiSame)fs.mkdirSync(apiRel,{mode:0o755});for(const f of m.files)if(!apiSame||f.path.startsWith('public/'))copy(work+'/'+f.path,(f.path.startsWith('public/')?rel:apiRel)+'/'+f.path.slice(f.path.indexOf('/')+1));
 for(const file of walk(oldFront))if(file!=='index.html')keep(oldFront+'/'+file,rel+'/'+file);
 // New issued URLs stay usable even if a later pointer rollback is required.
 for(const f of m.files.filter(f=>f.path.startsWith('public/assets/releases/')))keep(work+'/'+f.path,oldFront+'/'+f.path.slice(7));
 const progress=await import(pathToFileURL((apiSame?oldApi:apiRel)+'/progress.mjs'));const probe=progress.sanitizeProgress({version:3,discoveredIds:[],unlockedRegionIds:['park'],settings:{qualityPreset:'ultra',baseQualityPreset:'ultra',dragSensitivity:1.4,zoomLimit:3.5,showCinematic:false}});
 check('v3_independent_region_and_settings_whitelist',probe.version===3&&probe.discoveredIds.length===0&&probe.unlockedRegionIds.join()==='park'&&probe.settings.dragSensitivity===1.4&&probe.settings.zoomLimit===3.5&&probe.settings.showCinematic===false);
 const config=originalConfig.toString(),start=config.indexOf('server_name liyun.studentop.cn;'),end=config.indexOf('\n}',start),block=config.slice(start,end),apiLocation=/location\s+(?:\^~\s+)?\/api\/\s*\{/g;
 if(start<0||end<0||[...block.matchAll(apiLocation)].length!==1)fail('Unexpected Liyun API nginx layout');
 const maintenance=config.slice(0,start)+block.replace(apiLocation,match=>match+'\n        return 503; # transient owner-authorized release maintenance\n')+config.slice(end);
 if(!apiSame){gated=true;fs.writeFileSync(PROJECTS,maintenance,{mode:0o644});command('nginx',['-t']);command('systemctl',['reload','nginx']);check('public_api_write_gate_active',await waitStatus('/api/health',503));
 command('systemctl',['stop','liyun-account']);stopped=true;snapshotDb(history+'/db-before');dbSaved=true;const beforeCounts=counts();
 switchTo(API,apiRel);apiSwitched=true;command('systemctl',['start','liyun-account']);stopped=false;
 let healthy=false;for(let i=0;i<40;i++){try{if(command('curl',['--fail','--silent','--max-time','2','http://127.0.0.1:8787/api/health']).includes('"ok":true')){healthy=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}check('new_account_service_healthy',healthy);
 const afterCounts=counts();check('existing_users_sessions_checkins_progress_counts_preserved',JSON.stringify(beforeCounts)===JSON.stringify(afterCounts));
 fs.writeFileSync(history+'/database-preservation.json',JSON.stringify({beforeCounts,afterCounts,backup:'db-before',publicWritesGated:true},null,2),{mode:0o600});
 }else check('account_runtime_byte_identical_no_restart_or_database_write',true);
 switchTo(ROOT,rel);frontSwitched=true;command('nginx',['-t']);
 for(const f of m.files.filter(f=>f.path.startsWith('public/'))){const r=await get('/'+(f.path==='public/index.html'?'':f.path.slice(7)));check('published_bytes:'+f.path,r.status===200&&r.body.length===f.bytes&&sha(r.body)===f.sha256);}
 // Complete every rollback-capable check before accepting any new public writes.
 check('direct_anonymous_progress_denied',command('curl',['--silent','--output','/dev/null','--write-out','%{http_code}','--max-time','5','http://127.0.0.1:8787/api/progress'])==='401');
 for(const host of ['studentop.cn','frost.studentop.cn','genshin.studentop.cn'])check('neighbor:'+host,(await get('/',host)).status===200);
 for(const[root,target]of Object.entries(m.baseline.pointers))if(root!==ROOT&&root!==API)check('unchanged_pointer:'+root,fs.realpathSync(root+'/current')===target);
 for(const[file,digest]of Object.entries(m.baseline.configs))if(file!==PROJECTS)check('unchanged_config:'+file,sha(fs.readFileSync(file))===digest);
 for(const[name,before]of Object.entries(m.baseline.services)){const after=Object.fromEntries(command('systemctl',['show',name,'-p','ActiveState','-p','MainPID','-p','ExecMainStartTimestampMonotonic']).trim().split('\n').map(l=>l.split('=')));check('service_state:'+name,name==='liyun-account'&&!apiSame?after.ActiveState==='active':JSON.stringify(before)===JSON.stringify(after));}
 check('expected_nginx_config',sha(fs.readFileSync(PROJECTS))===sha(apiSame?originalConfig:Buffer.from(maintenance)));
 if(gated)restoreConfig();else command('systemctl',['reload','nginx']);committed=true;
 // Once writes resume, never automatically restore an older database snapshot.
 check('restored_nginx_config',sha(fs.readFileSync(PROJECTS))===m.baseline.configs[PROJECTS]);
 check('public_api_healthy',await waitStatus('/api/health',200));check('anonymous_progress_denied',(await get('/api/progress')).status===401);
 const receipt={ok:true,id:m.id,version:m.version,sourceSnapshot:m.snapshot,sourceBaseCommit:m.sourceBaseCommit,sourceStatus:m.sourceStatus,previous:{frontend:oldFront,api:oldApi},current:{frontend:rel,api:apiSame?oldApi:apiRel},backup:history,checks,apiRestarted:!apiSame,databaseUnchanged:apiSame,nginxReloaded:true,nginxConfigurationUnchanged:true,dnsCertificateFrpUnchanged:true,existingAccountCountsPreserved:true,completedAt:new Date().toISOString()};
 fs.writeFileSync(history+'/receipt.json',JSON.stringify(receipt,null,2),{mode:0o600});committed=true;console.log(JSON.stringify(receipt));
}catch(error){
 if(!committed){try{
   // Restore while the API gate still blocks writes. Preserve any failure-state DB separately.
   if(!gated){const current=fs.readFileSync(PROJECTS,'utf8');const pos=current.indexOf('server_name liyun.studentop.cn;'),end=current.indexOf('\n}',pos);if(pos>=0&&end>pos){fs.writeFileSync(PROJECTS,current.slice(0,pos)+current.slice(pos,end).replace(/location\s+(?:\^~\s+)?\/api\/\s*\{/,s=>s+'\n return 503;\n')+current.slice(end));command('nginx',['-t']);command('systemctl',['reload','nginx']);gated=true;}}
   if(apiSwitched||stopped){command('systemctl',['stop','liyun-account']);if(frontSwitched)switchTo(ROOT,oldFront);if(apiSwitched)switchTo(API,oldApi);restoreDb();command('systemctl',['start','liyun-account']);}else if(frontSwitched)switchTo(ROOT,oldFront);
   if(gated)restoreConfig();fs.writeFileSync(history+'/rollback.json',JSON.stringify({rolledBack:true,error:error.message,at:new Date().toISOString()}),{mode:0o600});
  }catch(rollbackError){console.error('Rollback requires operator attention: '+rollbackError.message);}}
 throw error;
}
