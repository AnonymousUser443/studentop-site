// Local-only packaging of the owner-authorized, already-tested working-tree artifact.
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
import {buildLiyunRelease} from './build-liyun-release.mjs';
const root=process.cwd(),sha=b=>createHash('sha256').update(b).digest('hex');
const baseline=JSON.parse(fs.readFileSync('.release-local/liyun-ui-20261103-inventory.json','utf8').replace(/^\uFEFF/,''));
const inv=JSON.parse(fs.readFileSync('qa/ui-implementation-20261103/invariants.json','utf8'));
const dist=path.join(root,'apps/liyun-explorer/dist');if(!inv.ok||sha(fs.readFileSync(dist+'/index.html'))!==inv.evidence.dist.indexSha256)throw Error('Reviewed dist no longer matches final acceptance');
const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
const out=path.resolve('.release-local','liyun-ui-'+stamp);fs.mkdirSync(out,{recursive:false});
const release=buildLiyunRelease(dist,path.join(out,'bundle/public'));fs.mkdirSync(path.join(out,'bundle/api/shared'),{recursive:true});
const apiSource=[];
for(const name of ['server.mjs','store.mjs','progress.mjs']){
 const bytes=fs.readFileSync('apps/liyun-explorer/server/'+name);apiSource.push({path:'server/'+name,sha256:sha(bytes)});
 if(name!=='progress.mjs'&&sha(bytes)!==baseline.apiFiles[name])throw Error('Unexpected server/store change needs a separate migration review');
 let text=bytes.toString('utf8');if(name==='progress.mjs'){const from="from '../shared/game-settings.mjs'";if(text.split(from).length!==2)throw Error('Unexpected shared import');text=text.replace(from,"from './shared/game-settings.mjs'");}
 fs.writeFileSync(path.join(out,'bundle/api',name),text);
}
const shared=fs.readFileSync('apps/liyun-explorer/shared/game-settings.mjs');apiSource.push({path:'shared/game-settings.mjs',sha256:sha(shared)});fs.writeFileSync(path.join(out,'bundle/api/shared/game-settings.mjs'),shared);
const files=[];function scan(dir,rel=''){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const n=rel?rel+'/'+e.name:e.name,p=path.join(dir,e.name);if(e.isSymbolicLink())throw Error('Symlink rejected');if(e.isDirectory())scan(p,n);else{const b=fs.readFileSync(p);files.push({path:n,bytes:b.length,sha256:sha(b)});}}}scan(path.join(out,'bundle'));
const snapshot=sha(JSON.stringify(files));const id='liyun-ui-'+stamp+'-'+snapshot.slice(0,10);
const manifest={format:1,id,version:release.id,sourceBaseCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceStatus:'owner-authorized reviewed working tree; not represented as a committed tree',snapshot,apiSource,apiImportAdjustment:'Flat service entry retained; progress import points to ./shared/game-settings.mjs',baseline,files};
fs.writeFileSync(path.join(out,'bundle/manifest.json'),JSON.stringify(manifest,null,2)+'\n');
execFileSync('tar',['-czf',path.join(out,'bundle.tar.gz'),'-C',path.join(out,'bundle'),'manifest.json','public','api'],{windowsHide:true});
const result={id,version:release.id,out,stage:'/var/tmp/aiden-'+id,archiveSHA256:sha(fs.readFileSync(path.join(out,'bundle.tar.gz'))),operatorSHA256:sha(fs.readFileSync('deploy/apply-liyun-v2.mjs')),files:files.length,publicFiles:release.files.length,publicBytes:release.bytes,sourceSnapshot:snapshot};
fs.writeFileSync('.release-local/liyun-ui-publish-session.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
