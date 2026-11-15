#!/usr/bin/env node
/** Owner-invoked home + desktop gateway + Music transaction. --dry-run never mutates production. */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';
import {createHash, randomBytes} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOTS = {home:'/opt/win11-home', auth:'/opt/projects/desktop-auth', music:'/opt/projects/aidenos-music'};
const CONFIGS = {
  app:'/etc/nginx/snippets/win11-home-app.conf',
  snippet:'/etc/nginx/snippets/win11-home-music.conf',
  unit:'/etc/systemd/system/aidenos-music.service',
  authDropin:'/etc/systemd/system/desktop-auth.service.d/50-aidenos-music.conf'
};
const MUSIC_ENV = '/etc/aidenos-music.env';
const DATA = '/var/lib/aidenos-music';
const NODE = '/opt/node24/bin/node';
const LOCK = '/run/lock/aiden-desktop-release.lock';
const HISTORY = '/var/lib/aiden-release-history';
const HASH = /^[a-f0-9]{64}$/;
const ID = /^music-\d{8}T\d{6}Z-[a-f0-9]{10}$/;
const MAX_ARCHIVE = 256 * 1024 * 1024;
const MAX_EXPANDED = 768 * 1024 * 1024;
const MAX_FILE = 128 * 1024 * 1024;
const AUTH_FILES = new Set(['desktop-auth.mjs','serve-desktop-auth.mjs','task-manager-proxy.mjs','music-proxy.mjs'].map(n=>'auth/tools/'+n));
const CONFIG_FILES = new Set(['config/aidenos-music.service','config/win11-home-music.conf','config/desktop-auth-music.conf']);
const PUBLIC_EXTENSIONS = new Set(['.html','.js','.mjs','.css','.svg','.png','.jpg','.jpeg','.webp','.avif','.gif','.ico','.bmp','.woff','.woff2','.ttf','.otf','.opus','.mp3','.ogg','.wav','.m4a','.mp4','.webm','.txt','.json']);
const assert = (condition, message) => {if(!condition)throw Error(message);};
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const exists = file => {try{fs.lstatSync(file);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}};
const safe = name => typeof name==='string' && name.split('/').every(s=>s && s!=='.' && s!=='..' && !s.startsWith('.') && !/[\\:\x00-\x1f\x7f]/.test(s) && !/[. ]$/.test(s));
const releaseTarget = (value, root) => typeof value==='string' && path.posix.dirname(value)===root+'/releases' && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(path.posix.basename(value)) && !/[.]$/.test(value);

export function validateMusicBaseline(value) {
  assert(value && Object.keys(value).sort().join(',')==='auth,home,homeAppSha256', 'Expected baseline keys: home, auth, homeAppSha256');
  assert(releaseTarget(value.home,ROOTS.home) && releaseTarget(value.auth,ROOTS.auth) && HASH.test(value.homeAppSha256), 'Invalid production baseline');
  return {...value};
}

function allowedFile(name) {
  if(!safe(name) || name.split('/').includes('node_modules'))return false;
  if(AUTH_FILES.has(name)||CONFIG_FILES.has(name))return true;
  if(name==='music/package.json'||name==='music/package-lock.json')return true;
  if(name.startsWith('music/server/'))return name.endsWith('.mjs') && !/(?:test|diagnos|guest-smoke|README)/i.test(name);
  return name.startsWith('home/') && PUBLIC_EXTENSIONS.has(path.posix.extname(name).toLowerCase()) && !/(?:^|[\/._-])(?:secret|credentials?|private|password|auth)(?:[\/._-]|$)/i.test(name);
}

export function validateMusicManifest(manifest) {
  assert(manifest && manifest.format===1 && ID.test(manifest.id) && /^[a-f0-9]{40}$/.test(manifest.commit) && manifest.id.endsWith(manifest.commit.slice(0,10)), 'Invalid Music manifest identity');
  assert(/^[a-f0-9]{24}$/.test(manifest.homeVersion), 'Invalid native build version');
  validateMusicBaseline(manifest.baseline);
  assert(Array.isArray(manifest.files) && manifest.files.length>0 && manifest.files.length<=12000, 'Invalid artifact file count');
  const seen = new Set();let total=0;
  for(const file of manifest.files){
    assert(file && allowedFile(file.path) && !seen.has(file.path) && Number.isSafeInteger(file.bytes) && file.bytes>=0 && file.bytes<=MAX_FILE && HASH.test(file.sha256), 'Invalid or duplicate artifact member');
    seen.add(file.path);total+=file.bytes;
  }
  assert(total<=MAX_EXPANDED-4*1024*1024, 'Artifact exceeds expanded size limit');
  for(const required of [...AUTH_FILES,...CONFIG_FILES,'home/index.html','home/version.json','home/site-build.json','music/package.json','music/package-lock.json','music/server/index.mjs','music/server/app.mjs','music/server/store.mjs'])assert(seen.has(required), 'Missing required artifact: '+required);
  return manifest;
}

function regular(file, limit=MAX_FILE) {
  const info=fs.lstatSync(file);
  assert(info.isFile()&&!info.isSymbolicLink()&&info.size<=limit, 'Expected bounded ordinary file: '+file);
  return fs.readFileSync(file);
}

function tarNumber(block, start, length) {
  const text=block.subarray(start,start+length).toString('ascii').replace(/\0.*$/s,'').trim();
  assert(/^[0-7]+$/.test(text), 'Invalid tar number');
  const value=Number.parseInt(text,8);assert(Number.isSafeInteger(value), 'Tar number exceeds safe range');return value;
}

/** Only our simple USTAR regular-file archive is accepted: no links, devices, PAX or name extensions. */
export function readMusicTar(bytes) {
  assert(bytes.length>=1024 && bytes.length<=MAX_EXPANDED && bytes.length%512===0, 'Invalid tar length');
  const files=new Map();let offset=0,terminated=false;
  while(offset+512<=bytes.length){
    const block=bytes.subarray(offset,offset+512);offset+=512;
    if(block.every(n=>n===0)){
      assert(bytes.length-offset>=512 && bytes.subarray(offset).every(n=>n===0), 'Invalid tar terminator');terminated=true;break;
    }
    const stored=tarNumber(block,148,8);let sum=0;for(let n=0;n<512;n++)sum+=n>=148&&n<156?32:block[n];
    assert(sum===stored && block.subarray(257,263).toString('ascii')==='ustar\0', 'Invalid USTAR header/checksum');
    assert(block[156]===0||block[156]===48, 'Archive links and non-regular members are forbidden');
    const field=(start,length)=>{const data=block.subarray(start,start+length),end=data.indexOf(0);return data.subarray(0,end<0?length:end).toString('utf8');};
    const name=field(0,100),prefix=field(345,155),full=prefix?prefix+'/'+name:name;
    assert(safe(full) && !files.has(full) && files.size<12001, 'Unsafe/duplicate tar path');
    const size=tarNumber(block,124,12);assert(size<=MAX_FILE && offset+size<=bytes.length, 'Tar member size exceeds bound');
    files.set(full,bytes.subarray(offset,offset+size));offset+=Math.ceil(size/512)*512;
    assert(offset<=bytes.length, 'Truncated tar member');
  }
  assert(terminated, 'Missing tar terminator');return files;
}

function assertPackage(buffers) {
  const pkg=JSON.parse(buffers.get('music/package.json')),lock=JSON.parse(buffers.get('music/package-lock.json'));
  assert(pkg.name==='aidenos-music'&&pkg.type==='module'&&pkg.dependencies?.['@neteasecloudmusicapienhanced/api']==='4.41.1', 'Unreviewed Music SDK dependency');
  assert(lock.lockfileVersion===3&&lock.packages?.['']?.dependencies?.['@neteasecloudmusicapienhanced/api']==='4.41.1'&&lock.packages?.['node_modules/@neteasecloudmusicapienhanced/api']?.version==='4.41.1', 'Music package lock does not pin SDK 4.41.1');
  for(const entry of Object.values(lock.packages||{}))if(entry.resolved){
    const url=new URL(entry.resolved);
    assert(url.protocol==='https:'&&url.hostname==='registry.npmjs.org'&&!url.username&&!url.password&&/^sha512-/.test(entry.integrity||''), 'Unexpected dependency registry or integrity');
  }
}

/** Read-only validation; production additionally requires a root-owned private upload directory. */
export function readMusicArtifact(stage, expectedSHA, {production=false}={}) {
  assert(HASH.test(expectedSHA), 'Pass the independently reviewed archive SHA256');
  const resolved=path.resolve(stage),info=fs.lstatSync(resolved);
  assert(info.isDirectory()&&!info.isSymbolicLink(), 'Expected ordinary staging directory');
  if(production){
    assert(/^\/var\/tmp\/aiden-upload-music-\d{8}T\d{6}Z-[a-f0-9]{10}$/.test(resolved), 'Invalid production staging path');
    assert(info.uid===0&&(info.mode&0o777)===0o700, 'Root-owned 0700 staging required');
  }
  const archive=regular(path.join(resolved,'bundle.tar.gz'),MAX_ARCHIVE);
  assert(sha256(archive)===expectedSHA, 'Archive SHA256 mismatch');
  const buffers=readMusicTar(gunzipSync(archive,{maxOutputLength:MAX_EXPANDED}));
  const manifestBytes=buffers.get('manifest.json');assert(manifestBytes&&manifestBytes.length<=4*1024*1024, 'Missing or oversized manifest');
  const manifest=validateMusicManifest(JSON.parse(manifestBytes));
  assert(buffers.size===manifest.files.length+1, 'Unlisted archive members');
  for(const file of manifest.files){const data=buffers.get(file.path);assert(data&&data.length===file.bytes&&sha256(data)===file.sha256, 'Artifact checksum mismatch: '+file.path);}
  assert(JSON.parse(buffers.get('home/version.json')).id===manifest.homeVersion && buffers.get('home/index.html').toString('utf8').includes('<meta name="site-version" content="'+manifest.homeVersion+'">'), 'Home build/version mismatch');
  assertPackage(buffers);
  assert(buffers.get('config/desktop-auth-music.conf').toString('utf8')==='[Service]\nEnvironmentFile=/etc/aidenos-music.env\n', 'Unexpected desktop auth drop-in');
  return {manifest,manifestBytes,manifestSHA256:sha256(manifestBytes),archiveSHA256:expectedSHA,buffers};
}

export function includeMusicSnippet(bytes) {
  const text=bytes.toString('utf8'),line='include /etc/nginx/snippets/win11-home-music.conf;';
  const active=text.split(/\r?\n/).filter(value=>value.trim()===line);
  assert(active.length<=1, 'Duplicate Music nginx include');
  assert(!text.includes('\0') && (!text.includes('win11-home-music.conf')||active.length===1), 'Unexpected existing Music include');
  if(active.length)return Buffer.from(bytes);
  const newline=text.includes('\r\n')?'\r\n':'\n';
  return Buffer.concat([bytes,Buffer.from((text.endsWith('\n')?'':newline)+line+newline)]);
}

function directory(file) {const stat=fs.lstatSync(file);assert(stat.isDirectory()&&!stat.isSymbolicLink(), 'Unsafe directory: '+file);return stat;}
function ensureDirectory(file,mode=0o755) {
  let target=path.parse(file).root;
  for(const part of file.slice(target.length).split(path.sep).filter(Boolean)){
    target=path.join(target,part);if(!exists(target)){fs.mkdirSync(target,{mode});fs.chmodSync(target,mode);}directory(target);
  }
}
function command(file,args,{allowFailure=false,timeout=30000,env}={}) {
  const result=spawnSync(file,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout,maxBuffer:512*1024,env});
  if(!allowFailure)assert(!result.error&&result.status===0, 'Bounded command failed: '+path.basename(file)+' '+(file==='systemctl'?args.slice(0,2).join(' '):''));
  return {ok:!result.error&&result.status===0,stdout:result.stdout||''};
}
function current(root,optional=false) {
  const link=root+'/current';if(optional&&!exists(link))return null;
  assert(fs.lstatSync(link).isSymbolicLink(), 'Expected current symlink: '+root);
  const target=fs.realpathSync(link);assert(releaseTarget(target,root), 'Current escapes release root: '+root);directory(target);return target;
}
function switchCurrent(root,target,id) {
  const link=root+'/current';
  if(target===null){assert(fs.lstatSync(link).isSymbolicLink(), 'Invalid removable current pointer');fs.unlinkSync(link);return;}
  assert(releaseTarget(target,root),'Invalid current target');directory(target);
  const temp=root+'/.current-'+id;fs.symlinkSync(target,temp);try{fs.renameSync(temp,link);}finally{if(exists(temp))fs.unlinkSync(temp);}
}
function atomic(file,bytes,mode,id) {
  ensureDirectory(path.dirname(file));if(exists(file))regular(file);
  const temp=path.join(path.dirname(file),'.'+path.basename(file)+'.'+id);
  fs.writeFileSync(temp,bytes,{flag:'wx',mode});fs.chmodSync(temp,mode);
  try{fs.renameSync(temp,file);}finally{if(exists(temp))fs.unlinkSync(temp);}
}
function snapshot(file) {if(!exists(file))return null;const bytes=regular(file),stat=fs.statSync(file);return {bytes,mode:stat.mode&0o777,uid:stat.uid,gid:stat.gid};}
function baselineMatches(baseline) {
  assert(current(ROOTS.home)===baseline.home && current(ROOTS.auth)===baseline.auth, 'Production release pointers changed since review');
  assert(sha256(regular(CONFIGS.app))===baseline.homeAppSha256, 'Live home-app.conf changed since review');
}

export function validateMusicEnvironment(text) {
  const values={};for(const line of text.trim().split('\n')){const match=line.match(/^([A-Z_]+)=([A-Za-z0-9_:/.-]+)$/);assert(match&&!Object.hasOwn(values,match[1]), 'Invalid private Music environment format');values[match[1]]=match[2];}
  assert(Object.keys(values).sort().join(',')==='MUSIC_COOKIE_KEY,MUSIC_DATA_DIR,MUSIC_GATEWAY_KEY,MUSIC_PORT,MUSIC_PUBLIC_ORIGIN,MUSIC_SECURE_COOKIES', 'Unexpected private Music environment fields');
  assert(/^[a-f0-9]{64}$/.test(values.MUSIC_COOKIE_KEY)&&/^[A-Za-z0-9_-]{32,256}$/.test(values.MUSIC_GATEWAY_KEY), 'Invalid private Music keys');
  assert(values.MUSIC_DATA_DIR===DATA&&values.MUSIC_PORT==='8901'&&values.MUSIC_PUBLIC_ORIGIN==='https://studentop.cn:14355'&&values.MUSIC_SECURE_COOKIES==='true', 'Music production environment differs from reviewed constants');
  return true;
}
function ensureEnvironment() {
  let created=false;
  if(!exists(MUSIC_ENV)){
    const text='MUSIC_GATEWAY_KEY='+randomBytes(32).toString('hex')+'\nMUSIC_COOKIE_KEY='+randomBytes(32).toString('hex')+'\nMUSIC_DATA_DIR='+DATA+'\nMUSIC_PORT=8901\nMUSIC_PUBLIC_ORIGIN=https://studentop.cn:14355\nMUSIC_SECURE_COOKIES=true\n';
    fs.writeFileSync(MUSIC_ENV,text,{flag:'wx',mode:0o600});created=true;
  }
  const stat=fs.lstatSync(MUSIC_ENV);assert(stat.isFile()&&!stat.isSymbolicLink()&&stat.uid===0&&(stat.mode&0o777)===0o600,'Root-owned 0600 Music environment required');
  validateMusicEnvironment(regular(MUSIC_ENV,4096).toString('utf8'));return created;
}
function ensureMusicUser() {
  let found=command('getent',['passwd','aidenos-music'],{allowFailure:true});
  if(!found.ok){command('useradd',['--system','--user-group','--no-create-home','--home-dir','/nonexistent','--shell','/usr/sbin/nologin','aidenos-music']);found=command('getent',['passwd','aidenos-music']);}
  const fields=found.stdout.trim().split(':');const uid=Number(fields[2]),gid=Number(fields[3]);
  assert(fields[0]==='aidenos-music'&&Number.isSafeInteger(uid)&&uid>0&&uid<1000&&Number.isSafeInteger(gid)&&gid>0, 'Unexpected Music service account');
  ensureDirectory(DATA,0o700);fs.chmodSync(DATA,0o700);fs.chownSync(DATA,uid,gid);
}

function request({secure=true,url,port=secure?443:8900,timeout=5000}) {
  return new Promise((resolve,reject)=>{
    const options={hostname:'127.0.0.1',port,path:url,headers:{Host:'studentop.cn:14355','X-Real-IP':'127.0.0.1','Cache-Control':'no-cache','Accept-Encoding':'identity'},timeout};
    if(secure)Object.assign(options,{servername:'studentop.cn',checkServerIdentity:(_,cert)=>tls.checkServerIdentity('studentop.cn',cert)});
    const req=(secure?https:http).get(options,res=>{
      const chunks=[];let length=0;res.on('data',chunk=>{length+=chunk.length;if(length>MAX_FILE)req.destroy(Error('Probe body limit'));else chunks.push(chunk);});
      res.on('error',reject);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));
    });req.on('error',reject);req.on('timeout',()=>req.destroy(Error('Probe timeout')));
  });
}
async function waitHealthy(url,port,predicate,signal,secure=false) {
  const until=Date.now()+20000;
  while(Date.now()<until){signal?.throwIfAborted();try{if(predicate(await request({secure,url,port,timeout:1500})))return true;}catch{}await new Promise(resolve=>setTimeout(resolve,250));}
  return false;
}

export function acquireMusicReleaseLock() {
  const fd=fs.openSync(LOCK,fs.constants.O_RDWR|fs.constants.O_CREAT|fs.constants.O_NOFOLLOW,0o600);
  try{assert(fs.fstatSync(fd).isFile(),'Invalid shared release lock');const result=spawnSync('flock',['--nonblock','3'],{stdio:['ignore','pipe','pipe',fd],timeout:5000});assert(!result.error&&result.status===0,'Another desktop release is active, or shared flock unavailable');return ()=>fs.closeSync(fd);}catch(error){fs.closeSync(fd);throw error;}
}

/** Fixed production paths deliberately cannot be changed through CLI options or environment. */
export async function applyMusicRelease(artifact,{signal}={}) {
  assert(process.platform==='linux'&&process.getuid?.()===0, 'Production transaction requires Linux root');
  // Public releases must stay readable even when the private upload shell uses umask 0077.
  process.umask(0o022);
  const {manifest:m,buffers}=artifact;validateMusicManifest(m);baselineMatches(m.baseline);signal?.throwIfAborted();
  for(const root of [ROOTS.home,ROOTS.auth]){directory(root);directory(root+'/releases');}
  if(exists(ROOTS.music))directory(ROOTS.music);
  const previous={home:current(ROOTS.home),auth:current(ROOTS.auth),music:exists(ROOTS.music)?current(ROOTS.music,true):null};
  const before=Object.fromEntries(Object.entries(CONFIGS).map(([name,file])=>[name,snapshot(file)]));
  assert(before.app, 'Missing live home nginx configuration');
  assert(command('systemctl',['is-active','--quiet','desktop-auth'],{allowFailure:true}).ok&&command('systemctl',['is-active','--quiet','nginx'],{allowFailure:true}).ok,'Existing desktop gate and nginx must be active');
  const service={present:!!before.unit,active:command('systemctl',['is-active','--quiet','aidenos-music'],{allowFailure:true}).ok,enabled:command('systemctl',['is-enabled','--quiet','aidenos-music'],{allowFailure:true}).ok};
  const fragment=command('systemctl',['show','aidenos-music','--property=FragmentPath','--value'],{allowFailure:true}).stdout.trim();
  assert(!fragment||fragment===CONFIGS.unit,'Music unit is supplied by an unexpected system path');
  assert(!service.active||service.present, 'Unexpected pre-existing Music service');
  const installed={app:includeMusicSnippet(before.app.bytes),snippet:buffers.get('config/win11-home-music.conf'),unit:buffers.get('config/aidenos-music.service'),authDropin:buffers.get('config/desktop-auth-music.conf')};
  ensureDirectory(HISTORY,0o700);const history=HISTORY+'/'+m.id;assert(!exists(history),'Release history already exists');fs.mkdirSync(history,{mode:0o700});
  fs.writeFileSync(history+'/manifest.json',artifact.manifestBytes,{flag:'wx',mode:0o600});
  fs.writeFileSync(history+'/baseline.json',JSON.stringify({baseline:m.baseline,previous,musicService:service,archiveSHA256:artifact.archiveSHA256,manifestSHA256:artifact.manifestSHA256},null,2)+'\n',{flag:'wx',mode:0o600});
  for(const [name,file]of Object.entries(before))if(file)fs.writeFileSync(history+'/'+name+'.before',file.bytes,{flag:'wx',mode:0o600});
  const checks=[];let changed=false,keysCreated=false;
  const check=(name,pass)=>{checks.push({name,pass:!!pass});assert(pass,name);};
  const releases=Object.fromEntries(Object.entries(ROOTS).map(([name,root])=>[name,root+'/releases/'+m.id]));
  try{
    check('node24_runtime',command(NODE,['--input-type=module','-e',"if(Number(process.versions.node.split('.')[0])!==24)process.exit(1); await import('node:sqlite');"],{allowFailure:true,timeout:5000}).ok);
    keysCreated=ensureEnvironment();ensureMusicUser();
    for(const [name,root]of Object.entries(ROOTS)){
      ensureDirectory(root);ensureDirectory(root+'/releases');assert(!exists(releases[name]),'Release already exists: '+name);fs.mkdirSync(releases[name],{mode:0o755});fs.chmodSync(releases[name],0o755);
      for(const file of m.files.filter(file=>file.path.startsWith(name+'/'))){
        signal?.throwIfAborted();const target=releases[name]+'/'+file.path.slice(name.length+1);ensureDirectory(path.dirname(target));fs.writeFileSync(target,buffers.get(file.path),{flag:'wx',mode:0o644});fs.chmodSync(target,0o644);
      }
    }
    // Old namespaces are never removed; a rollback still serves URLs issued by this release.
    ensureDirectory(ROOTS.home+'/shared');
    for(const file of m.files.filter(file=>file.path.startsWith('home/assets/releases/'))){
      const target=ROOTS.home+'/shared/'+file.path.slice(5);ensureDirectory(path.dirname(target));
      if(exists(target))assert(sha256(regular(target))===file.sha256,'Immutable native asset collision');
      else{fs.writeFileSync(target,buffers.get(file.path),{flag:'wx',mode:0o644});fs.chmodSync(target,0o644);}
    }
    signal?.throwIfAborted();ensureDirectory('/var/cache/aidenos-music/npm',0o700);
    command(NODE,['/opt/node24/lib/node_modules/npm/bin/npm-cli.js','ci','--prefix',releases.music,'--omit=dev','--ignore-scripts','--no-audit','--no-fund'],{
      timeout:300000,env:{PATH:'/opt/node24/bin:/usr/sbin:/usr/bin:/sbin:/bin',HOME:'/root',NODE_ENV:'production',npm_config_cache:'/var/cache/aidenos-music/npm',npm_config_fetch_timeout:'45000',npm_config_fetch_retries:'1'}
    });
    baselineMatches(m.baseline);assert(current(ROOTS.music,true)===previous.music,'Music pointer changed during preparation');signal?.throwIfAborted();
    changed=true;
    for(const [name,file]of Object.entries(CONFIGS))atomic(file,installed[name],0o644,m.id);
    command('nginx',['-t']);
    switchCurrent(ROOTS.music,releases.music,m.id);switchCurrent(ROOTS.auth,releases.auth,m.id);
    command('systemctl',['daemon-reload']);command('systemctl',['restart','aidenos-music']);command('systemctl',['restart','desktop-auth']);
    check('music_internal_health',await waitHealthy('/health',8901,result=>result.status===200&&JSON.parse(result.body).app==='aidenos-music',signal));
    check('desktop_auth_configured',await waitHealthy('/__desktop/auth',8900,result=>result.status===200&&JSON.parse(result.body).configured===true,signal));
    signal?.throwIfAborted();switchCurrent(ROOTS.home,releases.home,m.id);command('systemctl',['reload','nginx']);
    const home=await request({url:'/'}),version=await request({url:'/version.json'});
    check('home_entry_matches',home.status===200&&sha256(home.body)===sha256(buffers.get('home/index.html')));
    check('home_version_matches',version.status===200&&JSON.parse(version.body).id===m.homeVersion);
    const gate=await request({url:'/__desktop/auth'});check('public_auth_configured',gate.status===200&&JSON.parse(gate.body).configured===true);
    // nginx reload returns before old workers finish serving. Its old fallback
    // can briefly return the new HTML at this newly added route; await the gate.
    check('public_music_requires_desktop',await waitHealthy('/__desktop/music/v1/session',443,denied=>denied.status===401&&JSON.parse(denied.body).error?.code==='authentication_required'&&/no-store/.test(denied.headers['cache-control']||''),signal,true));
    check('private_build_index_denied',(await request({url:'/site-build.json'})).status===403);
    let publicFiles=0;
    for(const file of m.files.filter(file=>file.path.startsWith('home/assets/releases/'+m.homeVersion+'/')&&/\/(?:js\/(?:music\/|apps-music\.js)|css\/(?:music\/|music-host\.css|music-fonts\.css)|img\/music\/|fonts\/music\/)/.test(file.path))){
      signal?.throwIfAborted();const reply=await request({url:'/'+file.path.slice(5)});check('music_public_bytes:'+file.path,reply.status===200&&reply.body.length===file.bytes&&sha256(reply.body)===file.sha256);publicFiles++;
    }
    check('music_public_assets_checked',publicFiles>0);
    check('music_service_active',command('systemctl',['is-active','--quiet','aidenos-music'],{allowFailure:true}).ok);
    command('systemctl',['enable','aidenos-music']);signal?.throwIfAborted();
    const receipt={ok:true,id:m.id,commit:m.commit,homeVersion:m.homeVersion,archiveSHA256:artifact.archiveSHA256,manifestSHA256:artifact.manifestSHA256,previous,current:releases,checks,checkedMusicPublicFiles:publicFiles,privateKeysCreatedOnPi:keysCreated,privateConfigurationTransferred:false,unrelatedServicesRestarted:false,backup:history,completedAt:new Date().toISOString()};
    fs.writeFileSync(history+'/receipt.json',JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});return receipt;
  }catch(error){
    const rollbackErrors=[];const attempt=(name,fn)=>{try{fn();}catch(e){rollbackErrors.push(name+': '+e.message);}};
    if(changed){
      if(!service.enabled)attempt('disable_new_music',()=>command('systemctl',['disable','aidenos-music']));
      if(!service.active)attempt('stop_new_music',()=>command('systemctl',['stop','aidenos-music']));
      for(const [name,root]of Object.entries(ROOTS))attempt('restore_'+name,()=>{
        const target=current(root,true);assert(target===releases[name]||target===previous[name],'Pointer changed outside release transaction');if(target!==previous[name])switchCurrent(root,previous[name],m.id+'-rollback');
      });
      for(const [name,file]of Object.entries(CONFIGS))attempt('restore_'+name,()=>{
        if(exists(file)){const hash=sha256(regular(file));assert(hash===sha256(installed[name])||(before[name]&&hash===sha256(before[name].bytes)),'Configuration changed outside release transaction');}
        if(before[name]){atomic(file,before[name].bytes,before[name].mode,m.id+'-rollback');fs.chownSync(file,before[name].uid,before[name].gid);}
        else if(exists(file))fs.unlinkSync(file);
      });
      attempt('daemon_reload',()=>command('systemctl',['daemon-reload']));
      attempt('restore_auth_process',()=>command('systemctl',['restart','desktop-auth']));
      if(service.active)attempt('restore_music_process',()=>command('systemctl',['restart','aidenos-music']));
      if(service.enabled)attempt('restore_music_enablement',()=>command('systemctl',['enable','aidenos-music']));
      attempt('restore_nginx',()=>{command('nginx',['-t']);command('systemctl',['reload','nginx']);});
    }
    fs.writeFileSync(history+'/failure.json',JSON.stringify({ok:false,id:m.id,previous,activated:changed,rolledBack:changed&&!rollbackErrors.length,error:error.message,rollbackErrors,checks,privateKeysCreatedOnPi:keysCreated,keysRetainedForRetry:keysCreated,completedAt:new Date().toISOString()},null,2)+'\n',{flag:'wx',mode:0o600});
    throw Error(error.message+(changed?rollbackErrors.length?'; rollback requires review: '+rollbackErrors.join('; '):'; previous home, auth, Music and nginx state restored':'; live pointers and service configuration were not changed'));
  }
}

export async function main(argv=process.argv.slice(2)) {
  if(argv.length===1&&argv[0]==='--help'){console.log('Read-only: node deploy/apply-music-release.mjs --dry-run <stage> <archiveSHA256>\nProduction (Linux root): node apply-music-release.mjs <private-stage> <archiveSHA256>');return;}
  const dry=argv[0]==='--dry-run',args=dry?argv.slice(1):argv;
  assert(args.length===2,'Expected staging directory and archive SHA256');
  if(dry){const artifact=readMusicArtifact(args[0],args[1]);const result={ok:true,mode:'dry-run',id:artifact.manifest.id,commit:artifact.manifest.commit,homeVersion:artifact.manifest.homeVersion,files:artifact.manifest.files.length,archiveSHA256:artifact.archiveSHA256,manifestSHA256:artifact.manifestSHA256};console.log(JSON.stringify(result));return result;}
  assert(process.platform==='linux'&&process.getuid?.()===0,'Production apply requires Linux root; use --dry-run locally');
  const unlock=acquireMusicReleaseLock(),controller=new AbortController(),interrupt=()=>controller.abort(Error('Release interrupted'));
  process.on('SIGINT',interrupt);process.on('SIGTERM',interrupt);
  try{const artifact=readMusicArtifact(args[0],args[1],{production:true});const receipt=await applyMusicRelease(artifact,{signal:controller.signal});console.log(JSON.stringify(receipt));return receipt;}
  finally{process.off('SIGINT',interrupt);process.off('SIGTERM',interrupt);unlock();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(JSON.stringify({ok:false,error:error.message}));process.exitCode=1;});
