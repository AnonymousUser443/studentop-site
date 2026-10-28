import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
const m=JSON.parse(await fs.readFile(process.argv[2],'utf8'));const dig=b=>createHash('sha256').update(b).digest('hex');
if(!/^liyun-\d{8}T\d{6}Z-[a-f0-9]{10}$/.test(m.id))throw new Error('Scope');const apiExpected='/opt/projects/liyun-api/releases/'+m.id;
if(await fs.realpath('/opt/projects/liyun/current')!=='/opt/projects/liyun/releases/'+m.id)throw new Error('Current moved');
if(await fs.realpath('/opt/projects/liyun-api/current')!==apiExpected)throw new Error('API pointer moved');
const names=new Set(m.files.map(f=>f.path)),union=[...m.files,...m.baseline.files.filter(f=>f.path!=='index.html'&&!names.has(f.path))];
for(const f of union){if(f.path==='index.html')continue;const p=path.join('/opt/projects/liyun/current',f.path);const b=await fs.readFile(p);if(b.length!==f.size||dig(b)!==f.sha256)throw new Error('Current generation checksum: '+f.path);}
const previousExtras=m.files.filter(f=>f.path!=='index.html'&&f.path!=='favicon.svg');for(const f of m.files){if(f.path==='index.html')continue;const p=path.join(m.previous,f.path);const b=await fs.readFile(p);if(b.length!==f.size||dig(b)!==f.sha256)throw new Error('Rollback generation missing new asset: '+f.path);}
const old=new Map(m.baseline.files.map(f=>[f.path,f]));for(const f of m.baseline.files){const p=path.join(m.previous,f.path);const b=await fs.readFile(p);if(b.length!==f.size||dig(b)!==f.sha256)throw new Error('Rollback original changed: '+f.path);}
const data=await fs.stat('/var/lib/liyun-account');const mode=(data.mode&0o777).toString(8);if(mode!=='700')throw new Error('Data dir mode '+mode);
const configDigest=dig(await fs.readFile('/etc/nginx/sites-available/projects'));if(configDigest!==m.configAfterSHA256)throw new Error('nginx config changed');
const svc=execFileSync('systemctl',['show','liyun-account','--property=ActiveState','--property=User','--property=MainPID'],{encoding:'utf8'}).trim();
const svcState=Object.fromEntries(svc.trim().split('\n').map(l=>l.split('=')));
for(const [name,sha]of [['server.mjs',sha0(m,'server.mjs')],['store.mjs',sha0(m,'store.mjs')],['progress.mjs',sha0(m,'progress.mjs')]]){const b=await fs.readFile(path.join(apiExpected,name));if(dig(b)!==sha)throw new Error('API source '+name);}
function sha0(x,n){return x.apiFiles.find(f=>f.path===n).sha256;}
const neighbors={};for(const p of Object.keys(m.baseline.neighbors))neighbors[p]=await fs.realpath(p);
console.log(JSON.stringify({ok:true,current:'/opt/projects/liyun/releases/'+m.id,previous:m.previous,currentResourcesVerified:union.length,rollbackOriginalFilesVerified:m.baseline.files.length,rollbackBridgedFiles:m.files.filter(f=>f.path!=='index.html').length,apiCurrent:apiExpected,apiSourcesVerified:m.apiFiles.length,dataDirMode:mode,service:svcState,neighbors,nginxConfigUnchanged:true,actualRollbackPerformed:false}));
