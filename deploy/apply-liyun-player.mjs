// Static player only. Owner authorization required; invoke under the shared flock.
import fs from 'node:fs';import path from 'node:path';import https from 'node:https';import tls from 'node:tls';import{createHash}from'node:crypto';import{execFileSync}from'node:child_process';
const [stage,digest,expected]=process.argv.slice(2),ROOT='/opt/projects/liyun',CONFIG='/etc/nginx/sites-available/projects';
const sha=b=>createHash('sha256').update(b).digest('hex'),fail=s=>{throw Error(s)},cmd=(f,args)=>execFileSync(f,args,{encoding:'utf8'});
if(process.getuid?.()!==0||!/^\/var\/tmp\/aiden-liyun-player-\d{8}T\d{6}Z-[a-f0-9]{10}$/.test(stage)||!/^[a-f0-9]{64}$/.test(digest))fail('Invalid invocation');
if(fs.lstatSync(stage).isSymbolicLink()||(fs.statSync(stage).mode&0o777)!==0o700||sha(fs.readFileSync(stage+'/bundle.tar.gz'))!==digest)fail('Upload mismatch');
const work=stage+'/unpacked';fs.mkdirSync(work,{mode:0o700});
execFileSync('python3',['-c',`import tarfile,pathlib,sys
with tarfile.open(sys.argv[1]) as t:
 ms=t.getmembers()
 if len(ms)>1500 or sum(m.size for m in ms)>50000000: raise RuntimeError('Archive limit')
 for m in ms:
  p=pathlib.PurePosixPath(m.name)
  if p.is_absolute() or '..' in p.parts or chr(92) in m.name or not(m.isfile() or m.isdir()): raise RuntimeError('Unsafe member')
  if not(m.name=='manifest.json' or m.name.rstrip('/')=='public' or m.name.startswith('public/')): raise RuntimeError('Unexpected member')
 t.extractall(sys.argv[2],filter='data')`,stage+'/bundle.tar.gz',work]);
const m=JSON.parse(fs.readFileSync(work+'/manifest.json','utf8'));
if(m.format!==1||!/^liyun-player-\d{8}T\d{6}Z-[a-f0-9]{10}$/.test(m.id)||m.baseline.previous!==expected||fs.realpathSync(ROOT+'/current')!==expected)fail('Baseline moved');
const original=fs.readFileSync(CONFIG);if(sha(original)!==m.baseline.configSHA256)fail('nginx baseline moved');
const publication='/var/lib/liyun-content/published.json';
if(sha(fs.readFileSync(publication))!==m.baseline.publicationSHA256)fail('Publication moved; refresh baseline');
const safe=p=>/^(index\.html|sw\.js|version\.json|assets\/[A-Za-z0-9_./-]+)$/.test(p)&&p.split('/').every(s=>s&&!s.startsWith('.'));
function walk(dir,rel=''){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{if(e.isSymbolicLink())fail('Symlink rejected');const p=rel?rel+'/'+e.name:e.name;return e.isDirectory()?walk(dir+'/'+e.name,p):[p]});}
const listed=new Set();for(const f of m.files){if(!safe(f.path)||listed.has(f.path))fail('Unsafe manifest');listed.add(f.path);const file=work+'/public/'+f.path,b=fs.readFileSync(file);if(!fs.lstatSync(file).isFile()||b.length!==f.bytes||sha(b)!==f.sha256)fail('Checksum mismatch');}
if(walk(work+'/public').length!==listed.size)fail('Unlisted files');
const history='/var/lib/aiden-release-history/'+m.id,release=ROOT+'/releases/'+m.id;fs.mkdirSync(history,{mode:0o700});fs.writeFileSync(history+'/projects.before',original,{mode:0o600});
function copy(src,dst){fs.mkdirSync(path.dirname(dst),{recursive:true,mode:0o755});fs.copyFileSync(src,dst,fs.constants.COPYFILE_EXCL);fs.chmodSync(dst,0o644);}
function keep(src,dst){if(fs.existsSync(dst)){if(sha(fs.readFileSync(dst))!==sha(fs.readFileSync(src)))fail('Immutable conflict');}else copy(src,dst);}
function point(target){const temp=ROOT+'/.activate-'+m.id;fs.symlinkSync(target,temp);fs.renameSync(temp,ROOT+'/current');}
function get(uri,host='liyun.studentop.cn'){return new Promise((resolve,reject)=>{const q=https.get({hostname:'127.0.0.1',port:443,servername:host,checkServerIdentity:(_,cert)=>tls.checkServerIdentity(host,cert),path:uri,headers:{Host:host+':14355','Accept-Encoding':'identity'},timeout:15000},r=>{const chunks=[];r.on('data',b=>chunks.push(b));r.on('end',()=>resolve({status:r.statusCode,headers:r.headers,body:Buffer.concat(chunks)}));});q.on('error',reject);q.on('timeout',()=>q.destroy(Error('Timeout')));});}
const serviceNames=['liyun-account','liyun-author','frpc'],services=Object.fromEntries(serviceNames.map(n=>[n,cmd('systemctl',['show',n,'-p','MainPID','-p','ActiveState'])]));
const neighbors=['/opt/win11-home','/opt/projects/genshin','/opt/projects/frost'],pointers=Object.fromEntries(neighbors.map(p=>[p,fs.realpathSync(p+'/current')]));
const source=original.toString(),start=source.indexOf('server_name liyun.studentop.cn;'),end=source.indexOf('\n}',start);if(start<0||end<0)fail('Liyun vhost missing');
const clean=source.slice(start,end).replace(/\n    # liyun-player-cache begin[\s\S]*?# liyun-player-cache end\n/g,'\n');
if(/location = \/(?:version\.json|sw\.js)\s*\{/.test(clean))fail('Unexpected cache endpoint configuration');
const snippet='\n    # liyun-player-cache begin\n    location = /version.json { try_files $uri =404; expires off; add_header Cache-Control "no-store" always; }\n    location = /sw.js { try_files $uri =404; expires off; add_header Cache-Control "no-cache" always; add_header Service-Worker-Allowed "/" always; }\n    # liyun-player-cache end\n';
const target=Buffer.from(source.slice(0,start)+clean+snippet+source.slice(end));let changed=false,switched=false;
const checks=[];const check=(name,value)=>{checks.push({name,pass:!!value});if(!value)fail(name)};
try{
 fs.mkdirSync(release,{mode:0o755});for(const f of m.files)copy(work+'/public/'+f.path,release+'/'+f.path);
 for(const name of walk(expected))if(name.startsWith('assets/'))keep(expected+'/'+name,release+'/'+name);
 for(const f of m.files)if(f.path.startsWith('assets/'))keep(work+'/public/'+f.path,expected+'/'+f.path);
 fs.writeFileSync(CONFIG,target,{mode:0o644});changed=true;cmd('nginx',['-t']);
 point(release);switched=true;cmd('systemctl',['reload','nginx']);
 for(const f of m.files){const r=await get(f.path==='index.html'?'/':'/'+f.path);check('bytes:'+f.path,r.status===200&&sha(r.body)===f.sha256);}
 for(const name of ['/version.json','/sw.js'])check('revalidate:'+name,/no-store|no-cache/.test((await get(name)).headers['cache-control']||''));
 check('publication_unchanged',sha(fs.readFileSync(publication))===m.baseline.publicationSHA256);
 for(const[n,before]of Object.entries(services))check('service_unchanged:'+n,cmd('systemctl',['show',n,'-p','MainPID','-p','ActiveState'])===before);
 for(const[p,before]of Object.entries(pointers))check('pointer_unchanged:'+p,fs.realpathSync(p+'/current')===before);
 for(const host of ['studentop.cn','genshin.studentop.cn','frost.studentop.cn'])check('neighbor:'+host,(await get('/',host)).status===200);
 const receipt={ok:true,id:m.id,commit:m.commit,version:m.version,current:release,previous:expected,publicationUnchanged:true,servicesUnchanged:true,checks,completedAt:new Date().toISOString()};
 fs.writeFileSync(history+'/receipt.json',JSON.stringify(receipt,null,2),{mode:0o600});console.log(JSON.stringify(receipt));
}catch(error){if(switched)point(expected);if(changed){fs.writeFileSync(CONFIG,original);cmd('nginx',['-t']);cmd('systemctl',['reload','nginx']);}fs.writeFileSync(history+'/rollback.json',JSON.stringify({rolledBack:true,error:error.message}),{mode:0o600});throw error;}
