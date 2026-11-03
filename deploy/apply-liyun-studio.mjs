// Owner-authorized Liyun player/account/studio release. Run under the shared flock.
import fs from 'node:fs';import path from 'node:path';import https from 'node:https';import tls from 'node:tls';
import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';import {DatabaseSync} from 'node:sqlite';
const[stage,archiveHash]=process.argv.slice(2),sha=b=>createHash('sha256').update(b).digest('hex'),fail=m=>{throw Error(m);};
const cmd=(file,args)=>execFileSync(file,args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});
if(process.getuid?.()!==0||!/^\/var\/tmp\/aiden-liyun-studio-\d{8}T\d{6}Z-[a-f0-9]{10}$/.test(stage)||!/^[a-f0-9]{64}$/.test(archiveHash))fail('Invalid invocation');
if(fs.lstatSync(stage).isSymbolicLink()||(fs.statSync(stage).mode&0o777)!==0o700||sha(fs.readFileSync(stage+'/bundle.tar.gz'))!==archiveHash)fail('Upload integrity mismatch');
const work=stage+'/unpacked';fs.mkdirSync(work,{mode:0o700});
execFileSync('python3',['-c',`import sys,tarfile,pathlib
with tarfile.open(sys.argv[1],'r:gz') as t:
 ms=t.getmembers()
 if len(ms)>500 or sum(m.size for m in ms)>50000000: raise RuntimeError('Archive limits')
 for m in ms:
  p=pathlib.PurePosixPath(m.name)
  if p.is_absolute() or '..' in p.parts or chr(92) in m.name or not(m.isfile() or m.isdir()): raise RuntimeError('Unsafe member')
  if not(m.name=='manifest.json' or m.name.rstrip('/') in ('public','api','author') or m.name.startswith(('public/','api/','author/'))): raise RuntimeError('Unexpected member')
 t.extractall(sys.argv[2],filter='data')`,stage+'/bundle.tar.gz',work]);
const m=JSON.parse(fs.readFileSync(work+'/manifest.json','utf8'));
if(m.format!==2||!/^liyun-studio-\d{8}T\d{6}Z-[a-f0-9]{10}$/.test(m.id)||!Array.isArray(m.files)||m.files.length>250)fail('Invalid manifest');
const ROOT='/opt/projects/liyun',API='/opt/projects/liyun-api',AUTHOR='/opt/projects/liyun-author',PROJECTS='/etc/nginx/sites-available/projects',ACCOUNT_DATA='/var/lib/liyun-account',AUTHOR_DATA='/var/lib/liyun-author',CONTENT='/var/lib/liyun-content',UNIT='/etc/systemd/system/liyun-author.service',DROPIN='/etc/systemd/system/liyun-account.service.d/content.conf';
const oldFront=m.baseline.pointers[ROOT],oldApi=m.baseline.pointers[API],oldAuthor=m.baseline.pointers[AUTHOR]??null;
for(const[root,target]of Object.entries(m.baseline.pointers))if(fs.realpathSync(root+'/current')!==target)fail('Baseline pointer moved: '+root);
if(!oldAuthor&&fs.existsSync(AUTHOR+'/current'))fail('Unexpected existing studio pointer');
for(const[file,digest]of Object.entries(m.baseline.configs))if(sha(fs.readFileSync(file))!==digest)fail('Baseline config moved: '+file);
for(const name of ['server.mjs','store.mjs','progress.mjs'])if(sha(fs.readFileSync(oldApi+'/'+name))!==m.baseline.apiFiles[name])fail('Account baseline moved');
const listed=new Set();for(const f of m.files){
 const authorPath=['author/author.mjs','author/liyun-author.service','author/resources/map.webp','author/resources/seed.json'].includes(f.path)||/^author\/resources\/seed-media\/(?:wencui|beihu|library|teaching|wenbo|sports|tower|park)\.webp$/.test(f.path)||/^author\/resources\/studio\/(?:index\.html|assets\/[A-Za-z0-9_.-]+\.(?:js|css|woff2|txt))$/.test(f.path);
 const accepted=/^public\/(?:index\.html|assets\/[A-Za-z0-9_./-]+)$/.test(f.path)||/^api\/(?:server\.mjs|store\.mjs|progress\.mjs|published-content\.mjs|shared\/(?:game-settings|published)\.mjs)$/.test(f.path)||authorPath;
 if(!accepted||f.path.split('/').some(p=>p==='..'||p.startsWith('.'))||listed.has(f.path))fail('Unsafe payload path');listed.add(f.path);
 const file=work+'/'+f.path,bytes=fs.readFileSync(file);if(fs.lstatSync(file).isSymbolicLink()||!fs.lstatSync(file).isFile()||bytes.length!==f.bytes||sha(bytes)!==f.sha256)fail('Payload checksum mismatch');
}
function walk(dir,rel=''){const out=[];for(const e of fs.readdirSync(dir,{withFileTypes:true})){const n=rel?rel+'/'+e.name:e.name;if(e.isSymbolicLink())fail('Unexpected symlink');if(e.isDirectory())out.push(...walk(dir+'/'+e.name,n));else if(e.isFile())out.push(n);else fail('Special payload file');}return out;}
if(walk(work).some(f=>f!=='manifest.json'&&!listed.has(f)))fail('Unlisted payload');
for(const name of ['server.mjs','store.mjs'])if(sha(fs.readFileSync(work+'/api/'+name))!==m.baseline.apiFiles[name])fail('Unreviewed account DB/HTTP migration');
cmd('nginx',['-t']);
const history='/var/lib/aiden-release-history/'+m.id;fs.mkdirSync(history,{mode:0o700});fs.writeFileSync(history+'/manifest.json',JSON.stringify(m,null,2),{mode:0o600});
const original=fs.readFileSync(PROJECTS),oldUnit=fs.existsSync(UNIT)?fs.readFileSync(UNIT):null,oldDropin=fs.existsSync(DROPIN)?fs.readFileSync(DROPIN):null;
fs.writeFileSync(history+'/projects.before',original,{mode:0o600});if(oldUnit)fs.writeFileSync(history+'/author.service.before',oldUnit,{mode:0o600});if(oldDropin)fs.writeFileSync(history+'/account-content.before',oldDropin,{mode:0o600});
const front=ROOT+'/releases/'+m.id,api=API+'/releases/'+m.id,author=AUTHOR+'/releases/'+m.id;
const checks=[];const check=(name,value)=>{checks.push({name,pass:!!value});if(!value)fail(name);};
function copy(src,dst){fs.mkdirSync(path.dirname(dst),{recursive:true,mode:0o755});fs.copyFileSync(src,dst,fs.constants.COPYFILE_EXCL);fs.chmodSync(dst,0o644);}
function keep(src,dst){if(fs.existsSync(dst)){if(fs.lstatSync(dst).isSymbolicLink()||sha(fs.readFileSync(src))!==sha(fs.readFileSync(dst)))fail('Immutable URL conflict');}else copy(src,dst);}
function point(root,target){if(!target.startsWith(root+'/releases/'))fail('Invalid target');const temp=root+'/.activate-'+m.id;fs.symlinkSync(target,temp);fs.renameSync(temp,root+'/current');}
function get(uri,host='liyun.studentop.cn'){return new Promise((resolve,reject)=>{const request=https.get({hostname:'127.0.0.1',port:443,agent:false,servername:host,checkServerIdentity:(_,cert)=>tls.checkServerIdentity(host,cert),path:uri,headers:{Host:host+':14355','Accept-Encoding':'identity','Cache-Control':'no-cache'},timeout:15000},res=>{let size=0;const chunks=[];res.on('data',b=>{size+=b.length;if(size>32000000)request.destroy(Error('Body limit'));else chunks.push(b);});res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(chunks),headers:res.headers}));res.on('error',reject);});request.on('error',reject);request.on('timeout',()=>request.destroy(Error('TLS timeout')));});}
async function waitStatus(uri,status){for(let i=0;i<40;i++){try{if((await get(uri)).status===status)return true;}catch{}await new Promise(r=>setTimeout(r,200));}return false;}
function counts(){const db=new DatabaseSync(ACCOUNT_DATA+'/liyun.sqlite',{readOnly:true});try{return Object.fromEntries(['users','sessions','checkins','progress'].map(name=>[name,db.prepare('SELECT count(*) n FROM '+name).get().n]));}finally{db.close();}}
function backupDb(){fs.mkdirSync(history+'/account-db-before',{mode:0o700});for(const name of ['liyun.sqlite','liyun.sqlite-wal','liyun.sqlite-shm'])if(fs.existsSync(ACCOUNT_DATA+'/'+name)){fs.copyFileSync(ACCOUNT_DATA+'/'+name,history+'/account-db-before/'+name);fs.chmodSync(history+'/account-db-before/'+name,0o600);}}
function restoreDb(){if(!dbSaved)return;for(const name of ['liyun.sqlite','liyun.sqlite-wal','liyun.sqlite-shm']){const saved=history+'/account-db-before/'+name,dest=ACCOUNT_DATA+'/'+name;if(fs.existsSync(saved)){fs.copyFileSync(saved,dest);fs.chmodSync(dest,0o600);cmd('chown',['liyun-account:liyun-account',dest]);}else if(fs.existsSync(dest))fs.unlinkSync(dest);}}
let gate=false,accountStopped=false,dbSaved=false,apiChanged=false,frontChanged=false,authorChanged=false,committed=false;
const source=original.toString(),start=source.indexOf('server_name liyun.studentop.cn;'),end=source.indexOf('\n}',start);
if(start<0||end<0)fail('Missing Liyun nginx block');
const proxy=(prefix,{sse=false,limit='256k'}={})=>`    location ^~ ${prefix} {\n        proxy_pass http://127.0.0.1:8790;\n        proxy_http_version 1.1;\n        proxy_set_header Host $http_host;\n        proxy_set_header Origin $http_origin;\n        proxy_set_header X-Forwarded-For $remote_addr;\n        proxy_set_header X-Forwarded-Proto $scheme;\n        proxy_set_header Connection "";\n        client_max_body_size ${limit};\n        proxy_connect_timeout 5s;\n        proxy_read_timeout ${sse?'3600s':'30s'};\n${sse?'        proxy_buffering off;\n        proxy_cache off;\n':''}    }\n`;
const cleanBlock=source.slice(start,end).replace(/\n    # liyun-studio-managed begin[\s\S]*?# liyun-studio-managed end\n/g,'\n');
const snippet='\n    # liyun-studio-managed begin\n    location = /studio { return 302 /studio/; }\n'+proxy('/studio/')+proxy('/api/editor/',{sse:true,limit:'5m'})+proxy('/api/content/')+'    # liyun-studio-managed end\n';
const targetConfig=Buffer.from(source.slice(0,start)+cleanBlock+snippet+source.slice(end));
// The replacement is applied only within the Liyun server, never neighboring APIs.
const targetBlock=cleanBlock+snippet;
const maintenance=Buffer.from(source.slice(0,start)+targetBlock.replace(/location\s+(?:\^~\s+)?\/(?:api\/|api\/editor\/)\s*\{/g,s=>s+'\n        return 503; # transient owner-authorized Liyun release\n')+source.slice(end));
try{
 for(const dir of [front,api,author])fs.mkdirSync(dir,{recursive:true,mode:0o755});
 for(const f of m.files){const type=f.path.split('/')[0],dest=type==='public'?front:type==='api'?api:author;copy(work+'/'+f.path,dest+'/'+f.path.slice(type.length+1));}
 for(const file of walk(oldFront))if(file!=='index.html')keep(oldFront+'/'+file,front+'/'+file);
 for(const f of m.files.filter(f=>f.path.startsWith('public/assets/releases/')))keep(work+'/'+f.path,oldFront+'/'+f.path.slice(7));
 if(!oldAuthor&&cmd('ss',['-H','-ltn','( sport = :8790 )']).trim())fail('Studio port belongs to another service');
 try{cmd('id',['-u','liyun-author']);}catch{cmd('useradd',['--system','--no-create-home','--home-dir','/nonexistent','--shell','/usr/sbin/nologin','liyun-author']);}
 cmd('install',['-d','-m','0700','-o','liyun-author','-g','liyun-author',AUTHOR_DATA]);cmd('install',['-d','-m','0755','-o','liyun-author','-g','liyun-author',CONTENT]);
 if(!fs.existsSync(AUTHOR_DATA+'/editor-key')){const key=fs.readFileSync(stage+'/editor-key','utf8').trim();if(!/^[A-Za-z0-9_-]{43}$/.test(key))fail('Invalid editor credential');fs.writeFileSync(AUTHOR_DATA+'/editor-key',key+'\n',{mode:0o600,flag:'wx'});cmd('chown',['liyun-author:liyun-author',AUTHOR_DATA+'/editor-key']);}
 gate=true;fs.writeFileSync(PROJECTS,maintenance,{mode:0o644});cmd('nginx',['-t']);cmd('systemctl',['reload','nginx']);check('account_write_gate',await waitStatus('/api/health',503));check('editor_write_gate',await waitStatus('/api/editor/health',503));
 cmd('systemctl',['stop','liyun-account']);accountStopped=true;backupDb();dbSaved=true;const beforeCounts=counts();
 if(oldAuthor)cmd('systemctl',['stop','liyun-author']);point(AUTHOR,author);authorChanged=true;
 fs.writeFileSync(UNIT,fs.readFileSync(author+'/liyun-author.service'),{mode:0o644});fs.mkdirSync(path.dirname(DROPIN),{recursive:true,mode:0o755});fs.writeFileSync(DROPIN,'[Service]\nEnvironment=LIYUN_CONTENT_FILE=/var/lib/liyun-content/published.json\n',{mode:0o644});cmd('systemctl',['daemon-reload']);cmd('systemctl',['enable','liyun-author']);cmd('systemctl',['start','liyun-author']);
 let ready=false;for(let i=0;i<40;i++){try{if(cmd('curl',['--fail','--silent','--max-time','2','http://127.0.0.1:8790/api/editor/health']).includes('liyun-editor')){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}check('author_service_healthy',ready);
 point(API,api);apiChanged=true;cmd('systemctl',['start','liyun-account']);accountStopped=false;
 ready=false;for(let i=0;i<40;i++){try{if(cmd('curl',['--fail','--silent','--max-time','2','http://127.0.0.1:8787/api/health']).includes('"ok":true')){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}check('account_service_healthy',ready);
 const afterCounts=counts();check('existing_account_row_counts_preserved',JSON.stringify(beforeCounts)===JSON.stringify(afterCounts));fs.writeFileSync(history+'/account-preservation.json',JSON.stringify({beforeCounts,afterCounts}),{mode:0o600});
 point(ROOT,front);frontChanged=true;cmd('nginx',['-t']);
 for(const f of m.files.filter(f=>f.path.startsWith('public/'))){const r=await get('/'+(f.path==='public/index.html'?'':f.path.slice(7)));check('player_bytes:'+f.path,r.status===200&&sha(r.body)===f.sha256);}
 for(const f of m.files.filter(f=>f.path.startsWith('author/resources/studio/'))){const r=await get('/studio/'+(f.path.endsWith('/index.html')?'':f.path.slice('author/resources/studio/'.length)));check('studio_bytes:'+f.path,r.status===200&&sha(r.body)===f.sha256);}
 check('map_bytes',sha((await get('/api/content/map.webp')).body)===m.files.find(f=>f.path==='author/resources/map.webp').sha256);
 check('published_endpoint',(await get('/api/content/published')).status===200);
 check('editor_session_requires_invite',JSON.parse(cmd('curl',['--silent','--max-time','5','http://127.0.0.1:8790/api/editor/session'])).inviteRequired===true);
 check('unauthenticated_editor_denied',cmd('curl',['--silent','--output','/dev/null','--write-out','%{http_code}','--max-time','5','http://127.0.0.1:8790/api/editor/snapshot'])==='401');
 for(const host of ['studentop.cn','frost.studentop.cn','genshin.studentop.cn'])check('neighbor:'+host,(await get('/',host)).status===200);
 for(const[root,target]of Object.entries(m.baseline.pointers))if(![ROOT,API,AUTHOR].includes(root))check('unchanged_pointer:'+root,fs.realpathSync(root+'/current')===target);
 for(const[file,digest]of Object.entries(m.baseline.configs))if(file!==PROJECTS)check('unchanged_config:'+file,sha(fs.readFileSync(file))===digest);
 for(const[name,before]of Object.entries(m.baseline.services))if(name!=='liyun-account'){const after=Object.fromEntries(cmd('systemctl',['show',name,'-p','ActiveState','-p','MainPID','-p','ExecMainStartTimestampMonotonic']).trim().split('\n').map(l=>l.split('=')));check('unchanged_service:'+name,JSON.stringify(before)===JSON.stringify(after));}
 fs.writeFileSync(PROJECTS,targetConfig,{mode:0o644});cmd('nginx',['-t']);cmd('systemctl',['reload','nginx']);gate=false;committed=true;
 check('public_account_healthy',await waitStatus('/api/health',200));check('public_author_healthy',await waitStatus('/api/editor/health',200));check('protected_author_data',(await get('/api/editor/snapshot')).status===401);
 const receipt={ok:true,id:m.id,version:m.version,commit:m.commit,snapshot:m.snapshot,current:{frontend:front,api,author},previous:{frontend:oldFront,api:oldApi,author:oldAuthor},backup:history,checks,urls:{game:'https://liyun.studentop.cn:14355/',studio:'https://liyun.studentop.cn:14355/studio/'},privateAuthorData:AUTHOR_DATA,publicContentFile:CONTENT+'/published.json',accountCountsPreserved:true,deploymentDidNotPublishDraft:true,dnsCertificateFrpUnchanged:true,completedAt:new Date().toISOString()};
 fs.writeFileSync(history+'/receipt.json',JSON.stringify(receipt,null,2),{mode:0o600});console.log(JSON.stringify(receipt));
}catch(error){
 if(!committed){try{
  if(!gate){fs.writeFileSync(PROJECTS,maintenance,{mode:0o644});cmd('nginx',['-t']);cmd('systemctl',['reload','nginx']);gate=true;}
  if(apiChanged||accountStopped){cmd('systemctl',['stop','liyun-account']);if(apiChanged)point(API,oldApi);restoreDb();}
  if(frontChanged)point(ROOT,oldFront);
  if(authorChanged){cmd('systemctl',['stop','liyun-author']);if(oldAuthor)point(AUTHOR,oldAuthor);else if(fs.existsSync(AUTHOR+'/current')&&fs.realpathSync(AUTHOR+'/current')===author)fs.unlinkSync(AUTHOR+'/current');}
  if(oldUnit)fs.writeFileSync(UNIT,oldUnit,{mode:0o644});else if(fs.existsSync(UNIT)){try{cmd('systemctl',['disable','liyun-author']);}catch{}fs.unlinkSync(UNIT);}
  if(oldDropin)fs.writeFileSync(DROPIN,oldDropin,{mode:0o644});else if(fs.existsSync(DROPIN))fs.unlinkSync(DROPIN);
  cmd('systemctl',['daemon-reload']);if(oldAuthor)cmd('systemctl',['start','liyun-author']);if(apiChanged||accountStopped)cmd('systemctl',['start','liyun-account']);
  fs.writeFileSync(PROJECTS,original,{mode:0o644});cmd('nginx',['-t']);cmd('systemctl',['reload','nginx']);gate=false;
  fs.writeFileSync(history+'/rollback.json',JSON.stringify({rolledBack:true,error:error.message,at:new Date().toISOString()}),{mode:0o600});
 }catch(rollbackError){console.error('Rollback requires operator attention: '+rollbackError.message);}}
 throw error;
}
