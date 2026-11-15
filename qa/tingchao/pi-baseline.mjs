/** Read-only production snapshot; never reads account/configuration secret values. */
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const source=String.raw`import fs from 'node:fs';import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';
const hash=b=>createHash('sha256').update(b).digest('hex');
const home=fs.realpathSync('/opt/win11-home/current'),auth=fs.realpathSync('/opt/projects/desktop-auth/current');
const baseline={home,auth,homeAppSha256:hash(fs.readFileSync('/etc/nginx/snippets/win11-home-app.conf'))};
const version=JSON.parse(fs.readFileSync(home+'/version.json','utf8')).id;
let manifest=null;try{manifest=JSON.parse(fs.readFileSync(home+'/assets/releases/'+version+'/manifest.json','utf8'));}catch{}
const canonical=(file,bytes)=>/\.(?:html|js|mjs|css|svg)$/.test(file)?Buffer.from(bytes.toString('utf8').replaceAll('\r\n','\n').replaceAll(version,'NATIVE_VERSION')):bytes;
const canonicalFiles=manifest?[...manifest.files.map(f=>({path:'assets/'+f.path,actual:home+'/assets/releases/'+version+'/'+f.path})),...manifest.entries.map(f=>({path:f.path,actual:home+'/'+f.path}))].map(f=>({path:f.path,sha256:hash(canonical(f.path,fs.readFileSync(f.actual)))})):[];
const authFiles=['desktop-auth.mjs','serve-desktop-auth.mjs','task-manager-proxy.mjs'].map(name=>({path:'tools/'+name,sha256:hash(fs.readFileSync(auth+'/tools/'+name).toString('utf8').replaceAll('\r\n','\n'))}));
const services=Object.fromEntries(['nginx','desktop-auth','aidenos-music','frpc'].map(name=>{const r=spawnSync('systemctl',['is-active',name],{encoding:'utf8'});return[name,r.stdout.trim()];}));
const ports=spawnSync('ss',['-H','-ltn'],{encoding:'utf8'}).stdout;
console.log(JSON.stringify({baseline,version,manifest,canonicalFiles,authFiles,services,port8901Free:!ports.split('\n').some(line=>/\s(?:127\.0\.0\.1|0\.0\.0\.0|\*|\[::\]):8901\s/.test(line)),node:process.version,arch:process.arch,at:new Date().toISOString()}));`;
const result=spawnSync('ssh',['-o','BatchMode=yes','biteraiden-pi','sudo -n /opt/node24/bin/node --input-type=module -'],{input:source,encoding:'utf8',timeout:25000,maxBuffer:4*1024*1024,windowsHide:true});
if(result.status!==0)throw Error('Read-only Pi baseline failed: '+result.stderr.slice(0,800));
const value=JSON.parse(result.stdout);fs.mkdirSync('.release-local',{recursive:true});fs.writeFileSync('.release-local/music-baseline.json',JSON.stringify(value.baseline,null,2)+'\n');fs.writeFileSync('.release-local/music-pi-before.json',JSON.stringify(value,null,2)+'\n');
console.log(JSON.stringify({...value,canonicalFiles:value.canonicalFiles.length,authFiles:value.authFiles.length,manifest:value.manifest?{id:value.manifest.id,files:value.manifest.files.length}:null,baselineFile:path.resolve('.release-local/music-baseline.json')}));
