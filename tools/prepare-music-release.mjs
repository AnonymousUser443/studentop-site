#!/usr/bin/env node
/** Build an inspectable, secret-free Music release. No SSH, installs, listeners or production writes. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import {siteRevision,verifySiteBuild} from './site-release.mjs';
import {readMusicArtifact,sha256,validateMusicBaseline,validateMusicManifest} from '../deploy/apply-music-release.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const REVIEWED_PATHS=['site','apps/aidenos-music','tools/desktop-auth.mjs','tools/serve-desktop-auth.mjs','tools/task-manager-proxy.mjs','tools/music-proxy.mjs','tools/prepare-music-release.mjs','deploy/apply-music-release.mjs','deploy/systemd/aidenos-music.service','deploy/nginx/win11-home-music.conf'];
const AUTH=['desktop-auth.mjs','serve-desktop-auth.mjs','task-manager-proxy.mjs','music-proxy.mjs'];
const assert=(condition,message)=>{if(!condition)throw Error(message);};
const safe=name=>typeof name==='string'&&name.split('/').every(part=>part&&part!=='.'&&part!=='..'&&!part.startsWith('.')&&!/[\\:\x00-\x1f\x7f]/.test(part)&&!/[. ]$/.test(part));
const exists=file=>{try{fs.lstatSync(file);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}};

function ordinary(file){const info=fs.lstatSync(file);assert(info.isFile()&&!info.isSymbolicLink(),'Expected ordinary artifact file');return fs.readFileSync(file);}
function sourceFile(root,name){
  assert(safe(name),'Unsafe source path');let target=root;
  for(const part of name.split('/')){target=path.join(target,part);assert(!fs.lstatSync(target).isSymbolicLink(),'Artifact source contains a symlink');}
  return ordinary(target);
}
function list(dir,prefix=''){
  const info=fs.lstatSync(dir);assert(info.isDirectory()&&!info.isSymbolicLink(),'Expected ordinary artifact directory');
  const files=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)){
    const name=prefix+entry.name;assert(safe(name)&&!entry.isSymbolicLink(),'Unsafe artifact member');
    if(entry.isDirectory())files.push(...list(path.join(dir,entry.name),name+'/'));
    else{assert(entry.isFile(),'Special artifact member rejected');files.push(name);}
  }
  return files;
}
function reviewedTree(root,commit){
  assert(/^[a-f0-9]{40}$/.test(commit||''),'Pass the full reviewed commit SHA');
  const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:10000,maxBuffer:1024*1024}).trim();
  assert(git(['rev-parse','HEAD'])===commit,'HEAD differs from reviewed commit');
  assert(git(['status','--porcelain','--untracked-files=all','--',...REVIEWED_PATHS])==='','Music release sources must be committed and unchanged');
}
function tarPath(name){
  assert(safe(name),'Unsafe tar member');
  if(Buffer.byteLength(name)<=100)return {name,prefix:''};
  let index=name.lastIndexOf('/');
  while(index>0){const prefix=name.slice(0,index),leaf=name.slice(index+1);if(Buffer.byteLength(prefix)<=155&&Buffer.byteLength(leaf)<=100)return {name:leaf,prefix};index=name.lastIndexOf('/',index-1);}
  throw Error('Tar member path exceeds USTAR limits');
}
/** Explicit regular-file USTAR avoids host tar metadata, links and absolute-path extensions. */
export function createMusicTar(files,mtime=0){
  const records=[];
  for(const [full,data]of [...files.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0)){
    const {name,prefix}=tarPath(full),header=Buffer.alloc(512);
    const octal=(start,length,value)=>{const text=value.toString(8).padStart(length-1,'0')+'\0';assert(text.length===length,'Tar numeric field exceeds bound');header.write(text,start,length,'ascii');};
    header.write(name,0,100,'utf8');octal(100,8,0o644);octal(108,8,0);octal(116,8,0);octal(124,12,data.length);octal(136,12,mtime);
    header.fill(32,148,156);header[156]=48;header.write('ustar\0',257,6,'ascii');header.write('00',263,2,'ascii');header.write('root',265,32,'ascii');header.write('root',297,32,'ascii');header.write(prefix,345,155,'utf8');
    const sum=header.reduce((total,value)=>total+value,0);header.write(sum.toString(8).padStart(6,'0')+'\0 ',148,8,'ascii');
    records.push(header,data,Buffer.alloc((512-data.length%512)%512));
  }
  records.push(Buffer.alloc(1024));return Buffer.concat(records);
}

/** root/now overrides support isolated local fixtures; CLI always uses this worktree. */
export function prepareMusicRelease(commit,baselineFile=path.join(ROOT,'.release-local/music-baseline.json'),{root=ROOT,now=new Date()}={}){
  root=fs.realpathSync(root);reviewedTree(root,commit);
  const baseline=validateMusicBaseline(JSON.parse(ordinary(path.resolve(baselineFile)).toString('utf8')));
  const native=verifySiteBuild(path.join(root,'dist-site'));
  assert(native.id===siteRevision(path.join(root,'site')),'Native build does not match current site source; rebuild dist-site');
  assert(now instanceof Date&&Number.isFinite(now.getTime()),'Invalid release time');
  const id='music-'+now.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z')+'-'+commit.slice(0,10);
  const parent=path.join(root,'.release-local');
  if(!exists(parent))fs.mkdirSync(parent,{mode:0o700});
  assert(fs.lstatSync(parent).isDirectory()&&!fs.lstatSync(parent).isSymbolicLink()&&fs.realpathSync(parent)===parent,'Unsafe local release directory');
  const out=path.join(parent,id);assert(!exists(out),'Release staging already exists');
  const entries=[],buffers=new Map();
  const add=(name,bytes)=>{assert(safe(name)&&!buffers.has(name),'Unsafe/duplicate release path');buffers.set(name,bytes);entries.push({path:name,bytes:bytes.length,sha256:sha256(bytes)});};
  for(const file of list(path.join(root,'dist-site')))add('home/'+file,sourceFile(root,'dist-site/'+file));
  for(const file of AUTH)add('auth/tools/'+file,sourceFile(root,'tools/'+file));
  for(const file of ['package.json','package-lock.json'])add('music/'+file,sourceFile(root,'apps/aidenos-music/'+file));
  for(const file of list(path.join(root,'apps/aidenos-music/server'))){
    if(!file.endsWith('.mjs')||/(?:test|diagnos|guest-smoke|README)/i.test(file))continue;
    add('music/server/'+file,sourceFile(root,'apps/aidenos-music/server/'+file));
  }
  add('config/aidenos-music.service',sourceFile(root,'deploy/systemd/aidenos-music.service'));
  add('config/win11-home-music.conf',sourceFile(root,'deploy/nginx/win11-home-music.conf'));
  add('config/desktop-auth-music.conf',Buffer.from('[Service]\nEnvironmentFile=/etc/aidenos-music.env\n'));
  entries.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  const manifest=validateMusicManifest({format:1,id,commit,homeVersion:native.id,baseline,createdAt:now.toISOString(),files:entries});
  const manifestBytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n');buffers.set('manifest.json',manifestBytes);
  assert(siteRevision(path.join(root,'site'))===native.id,'Site changed while preparing release');reviewedTree(root,commit);
  fs.mkdirSync(out,{mode:0o700});
  for(const [name,bytes]of buffers){const file=path.join(out,...name.split('/'));fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o755});fs.writeFileSync(file,bytes,{flag:'wx',mode:0o644});}
  const archive=gzipSync(createMusicTar(buffers,Math.floor(now.getTime()/1000)),{level:6}),archiveSHA256=sha256(archive);
  fs.writeFileSync(path.join(out,'bundle.tar.gz'),archive,{flag:'wx',mode:0o600});
  const verified=readMusicArtifact(out,archiveSHA256);
  return {ok:true,id,commit,homeVersion:native.id,out,archive:path.join(out,'bundle.tar.gz'),archiveSHA256,manifestSHA256:verified.manifestSHA256,files:entries.length,bytes:entries.reduce((total,file)=>total+file.bytes,0),applyScript:path.join(root,'deploy/apply-music-release.mjs'),applyScriptSHA256:sha256(sourceFile(root,'deploy/apply-music-release.mjs'))};
}

export function main(argv=process.argv.slice(2)){
  if(argv.length===1&&argv[0]==='--help'){console.log('node tools/prepare-music-release.mjs <reviewed-commit> [baseline.json]\nDefault baseline: .release-local/music-baseline.json\nOutput is local only; all release sources must match the reviewed HEAD.');return;}
  assert(argv.length===1||argv.length===2,'Expected reviewed commit and optional baseline JSON path');
  const result=prepareMusicRelease(argv[0],argv[1]?path.resolve(argv[1]):undefined);console.log(JSON.stringify(result));return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{main();}catch(error){console.error(JSON.stringify({ok:false,error:error.message}));process.exitCode=1;}}
