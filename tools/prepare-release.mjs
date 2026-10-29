#!/usr/bin/env node
/** Assemble only reviewed public builds and the two public auth code files. No secrets, SSH or install. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {siteRevision,verifySiteBuild} from './site-release.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha=b=>createHash('sha256').update(b).digest('hex');
const safe=n=>n.split('/').every(p=>p&&p!=='.'&&p!=='..'&&!p.startsWith('.')&&!/[\\:\x00-\x1f]/.test(p));
const publicExt=new Set(['.html','.js','.css','.svg','.png','.webp','.jpg','.jpeg','.ico','.woff2','.txt','.opus','.json']);
function list(dir,prefix=''){const out=[];for(const e of fs.readdirSync(dir,{withFileTypes:true})){const name=prefix+e.name;if(e.isSymbolicLink()||!safe(name))throw new Error('Unsafe artifact path');if(e.isDirectory())out.push(...list(path.join(dir,e.name),name+'/'));else if(e.isFile())out.push(name);else throw new Error('Unsupported artifact type');}return out.sort();}
export function prepareRelease(commit){
 if(!/^[a-f0-9]{40}$/.test(commit||''))throw new Error('Pass the full reviewed Git commit SHA.');
 const native=verifySiteBuild(path.join(root,'dist-site'));
 if(native.id!==siteRevision(path.join(root,'site')))throw new Error('Native build is not current source.');
 const id=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z')+'-'+commit.slice(0,10);
 const out=path.join(root,'.release-local','bundle-'+id);if(fs.existsSync(out))throw new Error('Release staging already exists.');
 const entries=[];
 const copy=(source,dest)=>{if(!safe(dest))throw new Error('Unsafe destination');const actual=fs.lstatSync(source);if(!actual.isFile()||actual.isSymbolicLink())throw new Error('Expected ordinary source file');const bytes=fs.readFileSync(source);fs.mkdirSync(path.dirname(path.join(out,dest)),{recursive:true});fs.writeFileSync(path.join(out,dest),bytes,{flag:'wx'});entries.push({path:dest,bytes:bytes.length,sha256:sha(bytes)});};
 for(const [name,dir] of [['home','dist-site'],['voxel','apps/liangxiang-cloudwalk/dist'],['campus','apps/genshin-start/dist']]){
  const base=path.join(root,dir);if(!fs.existsSync(path.join(base,'index.html')))throw new Error('Missing build: '+name);
  for(const file of list(base)){if(name!=='home'&&(!publicExt.has(path.extname(file))||/(?:^|[\/._-])(?:secret|private|auth|password|credentials?)(?:[\/._-]|$)/i.test(file)))throw new Error('Unapproved public app file: '+file);copy(path.join(base,file),name+'/'+file);}
 }
 const voxel=fs.readFileSync(path.join(out,'voxel/index.html'),'utf8'),campus=fs.readFileSync(path.join(out,'campus/index.html'),'utf8');
 if(!voxel.includes('./assets/')||!campus.includes('/campus-entry/assets/'))throw new Error('Wrong application production base.');
 if(!fs.existsSync(path.join(out,'voxel/licenses/three-MIT.txt')))throw new Error('Missing Three.js copyright notice.');
 for(const name of ['desktop-auth.mjs','serve-desktop-auth.mjs'])copy(path.join(root,'tools',name),'auth/tools/'+name);
 for(const name of ['win11-home-app.conf','win11-home-headers.conf','win11-home-projects.conf'])copy(path.join(root,'deploy/nginx',name),'nginx/'+name);
 copy(path.join(root,'deploy/systemd/desktop-auth.service'),'systemd/desktop-auth.service');
 copy(path.join(root,'deploy/check-release.mjs'),'checks/check-live.mjs');
 const manifest={format:1,id,commit,nativeVersion:native.id,files:entries};fs.writeFileSync(path.join(out,'release.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
 return {id,commit,nativeVersion:native.id,out,files:entries.length,bytes:entries.reduce((n,e)=>n+e.bytes,0)};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{console.log(JSON.stringify(prepareRelease(process.argv[2])));}catch(e){console.error(e.message);process.exitCode=1;}}
