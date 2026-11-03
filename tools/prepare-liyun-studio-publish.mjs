// Reproducible three-part release; editor key is separate from every public manifest/archive.
import fs from 'node:fs';import path from 'node:path';import {createHash,randomBytes} from 'node:crypto';import {execFileSync} from 'node:child_process';import {pathToFileURL} from 'node:url';
import {buildLiyunRelease} from './build-liyun-release.mjs';
const root=process.cwd(),app=path.join(root,'apps/liyun-explorer'),sha=b=>createHash('sha256').update(b).digest('hex');
const baseline=JSON.parse(fs.readFileSync('.release-local/liyun-studio-baseline.json','utf8').replace(/^\uFEFF/,''));
const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z'),out=path.resolve('.release-local','liyun-studio-'+stamp);fs.mkdirSync(out,{recursive:false});
const bundle=path.join(out,'bundle'),release=buildLiyunRelease(path.join(app,'dist'),path.join(bundle,'public'));
if(release.bytes>20*1024*1024)throw Error('Player release exceeds the 20MiB budget');
fs.mkdirSync(path.join(bundle,'api/shared'),{recursive:true});
for(const name of ['server.mjs','store.mjs','progress.mjs','published-content.mjs']){
 let text=fs.readFileSync(path.join(app,'server',name),'utf8');if(['server.mjs','store.mjs'].includes(name)&&sha(text)!==baseline.apiFiles[name])throw Error('Unexpected account storage/HTTP migration');
 text=text.replaceAll("from '../shared/","from './shared/");fs.writeFileSync(path.join(bundle,'api',name),text);
}
for(const name of ['game-settings.mjs','published.mjs'])fs.copyFileSync(path.join(app,'shared',name),path.join(bundle,'api/shared',name));
const author=path.join(bundle,'author');fs.mkdirSync(path.join(author,'resources/studio'),{recursive:true});
const esbuild=await import(pathToFileURL(path.join(app,'node_modules/esbuild/lib/main.js')));
await esbuild.build({entryPoints:[path.join(app,'server/author.mjs')],outfile:path.join(author,'author.mjs'),bundle:true,platform:'node',format:'esm',target:'node24',external:['node:*'],logLevel:'warning'});
fs.cpSync(path.join(app,'.author-resources'),path.join(author,'resources'),{recursive:true});fs.cpSync(path.join(app,'dist-studio'),path.join(author,'resources/studio'),{recursive:true});
fs.copyFileSync('deploy/nginx/liyun-author.service',path.join(author,'liyun-author.service'));
const files=[];function walk(dir,rel=''){for(const e of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const n=rel?rel+'/'+e.name:e.name,p=path.join(dir,e.name);if(e.isSymbolicLink())throw Error('Symlink in release');if(e.isDirectory())walk(p,n);else{const b=fs.readFileSync(p);files.push({path:n,bytes:b.length,sha256:sha(b)});}}}walk(bundle);
const snapshot=sha(JSON.stringify(files)),id='liyun-studio-'+stamp+'-'+snapshot.slice(0,10);
const manifest={format:2,id,version:release.id,snapshot,commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),baseline,files,accountPublicFile:'/var/lib/liyun-content/published.json'};
fs.writeFileSync(path.join(bundle,'manifest.json'),JSON.stringify(manifest,null,2));execFileSync('tar',['-czf',path.join(out,'bundle.tar.gz'),'-C',bundle,'manifest.json','public','api','author'],{windowsHide:true});
const keyFile=path.resolve('.release-local/liyun-editor-invite.txt');if(!fs.existsSync(keyFile))fs.writeFileSync(keyFile,randomBytes(32).toString('base64url')+'\n',{mode:0o600,flag:'wx'});
const result={id,version:release.id,commit:manifest.commit,out,stage:'/var/tmp/aiden-'+id,archiveSHA256:sha(fs.readFileSync(path.join(out,'bundle.tar.gz'))),operatorSHA256:sha(fs.readFileSync('deploy/apply-liyun-studio.mjs')),keyFile,playerBytes:release.bytes,files:files.length,snapshot};
fs.writeFileSync('.release-local/liyun-studio-publish-session.json',JSON.stringify(result,null,2));console.log(JSON.stringify({...result,keyFile:'private local file; value omitted'},null,2));
