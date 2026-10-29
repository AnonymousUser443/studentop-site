#!/usr/bin/env node
/** Explicitly owner-authorized transaction: home + Liyun static files + desktop monitor bridge only. */
import fs from 'node:fs';import path from 'node:path';import https from 'node:https';import tls from 'node:tls';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
const [stage,archiveSHA]=process.argv.slice(2),sha=b=>createHash('sha256').update(b).digest('hex');
if(process.getuid?.()!==0||!/^\/var\/tmp\/aiden-upload-activity-monitor-[0-9TZ]+-[a-f0-9]{10}$/.test(stage)||!/^[a-f0-9]{64}$/.test(archiveSHA))throw Error('Invalid owner release invocation');
if(fs.lstatSync(stage).isSymbolicLink()||(fs.statSync(stage).mode&0o777)!==0o700)throw Error('Private upload directory required');
if(sha(fs.readFileSync(stage+'/bundle.tar.gz'))!==archiveSHA)throw Error('Archive checksum mismatch');
const work=stage+'/unpacked';fs.mkdirSync(work,{mode:0o700});
const members=execFileSync('tar',['-tzf',stage+'/bundle.tar.gz'],{encoding:'utf8'}).trim().split('\n');if(members.some(n=>n.startsWith('/')||n.split('/').some(p=>p==='..'||p.startsWith('.')&&p!=='.')))throw Error('Unsafe archive member');
execFileSync('tar',['-xzf',stage+'/bundle.tar.gz','--no-same-owner','--no-same-permissions','-C',work]);
const m=JSON.parse(fs.readFileSync(work+'/manifest.json','utf8'));if(m.format!==1||!/^activity-monitor-[0-9TZ]+-[a-f0-9]{10}$/.test(m.id)||!/^[a-f0-9]{40}$/.test(m.commit)||m.files.length>1000||!m.files.length)throw Error('Invalid manifest');
const roots={home:'/opt/win11-home',liyun:'/opt/projects/liyun',auth:'/opt/projects/desktop-auth'};
const configs={'config/home-app.conf':'/etc/nginx/snippets/win11-home-app.conf','config/desktop-auth.service':'/etc/systemd/system/desktop-auth.service'};
const seen=new Set();for(const f of m.files){if(!/^(home|liyun|auth|config)\//.test(f.path)||f.path.split('/').some(x=>!x||x.startsWith('.')||x==='..'||/[\\:\x00-\x1f]/.test(x))||seen.has(f.path)||!Number.isSafeInteger(f.bytes)||f.bytes<0||!/^[a-f0-9]{64}$/.test(f.sha256))throw Error('Invalid file entry');seen.add(f.path);const p=work+'/'+f.path;if(!fs.lstatSync(p).isFile()||fs.lstatSync(p).isSymbolicLink()||fs.statSync(p).size!==f.bytes||sha(fs.readFileSync(p))!==f.sha256)throw Error('Artifact checksum mismatch: '+f.path);}
function scan(dir,prefix=''){const out=[];for(const e of fs.readdirSync(dir,{withFileTypes:true})){const n=prefix+e.name,p=dir+'/'+e.name;if(e.isSymbolicLink())throw Error('Symlink in upload');if(e.isDirectory())out.push(...scan(p,n+'/'));else if(e.isFile())out.push(n);else throw Error('Special member');}return out;}
if(scan(work).some(n=>n!=='manifest.json'&&!seen.has(n)))throw Error('Unlisted upload member');
function baseline(){for(const root of Object.values(roots)){if(!fs.lstatSync(root+'/current').isSymbolicLink()||fs.realpathSync(root+'/current')!==m.baseline.pointers[root])throw Error('Release pointer changed');}for(const [file,hash]of Object.entries(m.baseline.configs))if(sha(fs.readFileSync(file))!==hash)throw Error('Configuration changed: '+file);}
baseline();const history='/var/lib/aiden-release-history/'+m.id;fs.mkdirSync(history,{recursive:false,mode:0o700});fs.writeFileSync(history+'/baseline.json',JSON.stringify(m.baseline,null,2)+'\n',{mode:0o600});
for(const target of Object.values(configs))fs.copyFileSync(target,history+'/'+path.basename(target));
const command=(name,args)=>execFileSync(name,args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});
const previous={};for(const [name,root]of Object.entries(roots))previous[name]=fs.realpathSync(root+'/current');
let activated=false,committed=false;
function copy(source,target){fs.mkdirSync(path.dirname(target),{recursive:true,mode:0o755});fs.copyFileSync(source,target,fs.constants.COPYFILE_EXCL);fs.chmodSync(target,0o644);}
function keep(source,target){if(fs.existsSync(target)){if(fs.lstatSync(target).isSymbolicLink()||sha(fs.readFileSync(target))!==sha(fs.readFileSync(source)))throw Error('Immutable URL conflict: '+target);}else copy(source,target);}
function switchTo(root,target){if(!target.startsWith(root+'/releases/'))throw Error('Target outside release root');const temp=root+'/.current-'+m.id;fs.symlinkSync(target,temp);fs.renameSync(temp,root+'/current');}
function get(host,url){return new Promise((resolve,reject)=>{const req=https.get({hostname:'127.0.0.1',port:443,servername:host,checkServerIdentity:(_,cert)=>tls.checkServerIdentity(host,cert),path:url,headers:{Host:host+':14355','Accept-Encoding':'identity','Cache-Control':'no-cache'},timeout:15000},res=>{const chunks=[];let length=0;res.on('data',chunk=>{length+=chunk.length;if(length>64000000)req.destroy(Error('Body limit'));else chunks.push(chunk);});res.on('error',reject);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));});req.on('error',reject);req.on('timeout',()=>req.destroy(Error('TLS timeout')));});}
const checks=[];function check(name,pass){checks.push({name,pass:!!pass});if(!pass)throw Error(name);}
try{
 for(const [name,root]of Object.entries(roots)){const dest=root+'/releases/'+m.id;fs.mkdirSync(dest,{mode:0o755});for(const f of m.files.filter(f=>f.path.startsWith(name+'/')))copy(work+'/'+f.path,dest+'/'+f.path.slice(name.length+1));}
 // Existing Liyun aliases and past content namespaces stay byte-identical for cached clients.
 const liyun=roots.liyun,newLiyun=liyun+'/releases/'+m.id;
 for(const f of m.baseline.liyunFiles)if(f.path!=='index.html'){const source=previous.liyun+'/'+f.path;if(sha(fs.readFileSync(source))!==f.sha256)throw Error('Liyun baseline moved');keep(source,newLiyun+'/'+f.path);}
 // Append the new namespace to the previous release too: rollback keeps new issued URLs readable.
 for(const f of m.files.filter(f=>f.path.startsWith('liyun/assets/releases/')))keep(work+'/'+f.path,previous.liyun+'/'+f.path.slice(6));
 for(const f of m.files.filter(f=>f.path.startsWith('home/assets/releases/')))keep(work+'/'+f.path,'/opt/win11-home/shared/'+f.path.slice(5));
 // Probe the real 8765 service as the production service user using a disposable synthetic gate.
 const probe=execFileSync('runuser',['-u','desktop-auth','--','/opt/node24/bin/node','--input-type=module','-',roots.auth+'/releases/'+m.id],{input:fs.readFileSync(stage+'/probe-real-monitor.mjs'),encoding:'utf8'});
 const realProbe=JSON.parse(probe);check('real_monitor_proxy_probe',realProbe.ok);fs.writeFileSync(history+'/real-monitor-probe.json',JSON.stringify(realProbe,null,2)+'\n',{mode:0o600});
 baseline();activated=true;
 switchTo(roots.auth,roots.auth+'/releases/'+m.id);
 fs.copyFileSync(work+'/config/desktop-auth.service',configs['config/desktop-auth.service']);fs.chmodSync(configs['config/desktop-auth.service'],0o644);
 command('systemctl',['daemon-reload']);command('systemctl',['restart','desktop-auth']);
 let companionReady=false;for(let attempt=0;attempt<30;attempt++){try{const local=await get('studentop.cn','/__desktop/auth');if(local.status===200&&JSON.parse(local.body).configured===true){companionReady=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}check('new_auth_companion_configured',companionReady);
 fs.copyFileSync(work+'/config/home-app.conf',configs['config/home-app.conf']);fs.chmodSync(configs['config/home-app.conf'],0o644);
 command('nginx',['-t']);switchTo(roots.liyun,newLiyun);switchTo(roots.home,roots.home+'/releases/'+m.id);command('systemctl',['reload','nginx']);
 let compared=0;for(const f of m.files){if(!/^(home|liyun)\//.test(f.path)||f.path==='home/site-build.json')continue;const name=f.path.split('/')[0],url='/'+f.path.slice(name.length+1);const response=await get(name==='home'?'studentop.cn':'liyun.studentop.cn',url);check('public_bytes:'+f.path,response.status===200&&response.body.length===f.bytes&&sha(response.body)===f.sha256);compared++;}
 check('internal_build_index_remains_private',(await get('studentop.cn','/site-build.json')).status===403);
 const denied=await get('studentop.cn','/__desktop/task-manager/health');check('production_monitor_requires_desktop_session',denied.status===401&&/no-store/.test(denied.headers['cache-control']||''));
 check('unchanged_liyun_api_healthy',(await get('liyun.studentop.cn','/api/health')).status===200);
 for(const [host,url]of [['studentop.cn','/'],['studentop.cn','/task-manager/'],['studentop.cn','/campus-entry/'],['studentop.cn','/voxel-campus/'],['frost.studentop.cn','/'],['genshin.studentop.cn','/']])check('neighbor:'+host+url,(await get(host,url)).status===200);
 for(const [root,target]of Object.entries(m.baseline.pointers))if(!Object.values(roots).includes(root))check('untouched_pointer:'+root,fs.realpathSync(root+'/current')===target);
 for(const [name,before]of Object.entries(m.baseline.services)){const after=Object.fromEntries(command('systemctl',['show',name,'-p','ActiveState','-p','MainPID','-p','ExecMainStartTimestampMonotonic']).trim().split('\n').map(x=>x.split('=')));check('active:'+name,after.ActiveState==='active');if(name!=='desktop-auth')check('untouched_process:'+name,after.MainPID===before.MainPID&&after.ExecMainStartTimestampMonotonic===before.ExecMainStartTimestampMonotonic);}
 const receipt={ok:true,id:m.id,commit:m.commit,homeVersion:m.homeVersion,liyunVersion:m.liyunVersion,previous,current:Object.fromEntries(Object.entries(roots).map(([name,root])=>[name,fs.realpathSync(root+'/current')])),checkedPublicFiles:compared,checks,realMonitorProbe:realProbe,ownerPrivateConfigurationTransferred:false,backendDatabaseModified:false,unrelatedServicesRestarted:false,backup:history,completedAt:new Date().toISOString()};
 fs.writeFileSync(history+'/receipt.json',JSON.stringify(receipt,null,2)+'\n',{mode:0o600});committed=true;console.log(JSON.stringify({ok:true,id:m.id,commit:m.commit,homeVersion:m.homeVersion,liyunVersion:m.liyunVersion,checkedPublicFiles:compared,checks:checks.length,backup:history}));
}catch(error){
 if(activated&&!committed){for(const [name,root]of Object.entries(roots))switchTo(root,previous[name]);for(const target of Object.values(configs))fs.copyFileSync(history+'/'+path.basename(target),target);command('systemctl',['daemon-reload']);command('systemctl',['restart','desktop-auth']);command('nginx',['-t']);command('systemctl',['reload','nginx']);console.error('Automatic rollback restored prior home, Liyun, auth and proxy configuration.');}
 throw error;
}
