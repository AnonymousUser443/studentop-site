#!/usr/bin/env node
/** Compile and stage only the native music module. Does not publish. */
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),app=path.join(root,'apps/aidenos-music');
if(!process.argv.includes('--stage-only')){const r=spawnSync(process.execPath,[path.join(app,'node_modules/typescript/bin/tsc'),'--noEmit'],{cwd:app,stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);const b=spawnSync(process.execPath,[path.join(app,'node_modules/vite/bin/vite.js'),'build'],{cwd:app,stdio:'inherit'});if(b.status!==0)process.exit(b.status||1);}
const dist=path.join(app,'dist');
const staged=new Set();
// Keep complete licenses with distributed code, including dependencies whose
// upstream bundles do not carry the full permission notice themselves.
const legal='/*!\nTingchao / STUDENTOP — AGPL-3.0-only.\nFolia Sonnet by chthollyphile and Folia contributors.\nSource provenance: apps/aidenos-music/src/vendor/folia/UPSTREAM.json\n\n'+[
  ['GNU Affero General Public License v3',path.join(root,'LICENSE')],
  ['PixiJS 8.21.0',path.join(app,'licenses/pixi-MIT.txt')],
  ['Pretext 0.0.9',path.join(app,'licenses/pretext-MIT.txt')],
].map(([name,file])=>name+'\n'+fs.readFileSync(file,'utf8')).join('\n\n')+'\n*/\n';
const {transformWithEsbuild}=await import(pathToFileURL(path.join(app,'node_modules/vite/dist/node/index.js')).href);
// ES library output preserves whitespace for downstream tree shaking. This is a
// complete native entry, so compact the final artifact after Rollup has shaken it.
// Keep third-party license notices; do not ship development comments or maps.
async function copy(dir,prefix=''){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const rel=prefix+ent.name,src=path.join(dir,ent.name);if(ent.isSymbolicLink())throw Error('Unexpected music build symlink');if(ent.isDirectory()){await copy(src,rel+'/');continue;}if(!/\.(js|css)$/.test(rel))throw Error('Unexpected public module artifact: '+rel);const dest=path.join(root,'site/assets',rel.endsWith('.css')?'css/music':'js/music',rel);fs.mkdirSync(path.dirname(dest),{recursive:true});const artifact=await transformWithEsbuild(fs.readFileSync(src,'utf8'),rel,{loader:rel.endsWith('.css')?'css':'js',minify:true,legalComments:'inline',charset:'utf8',target:'es2020',sourcemap:false});fs.writeFileSync(dest,(rel==='entry.js'?legal:'')+artifact.code);staged.add(dest);}}
await copy(dist);
// These two directories exclusively hold the current unversioned music build.
// Old hashed chunks must not accumulate in future versioned site releases.
function prune(dir,boundary=fs.realpathSync(dir)){
  if(fs.realpathSync(dir)!==path.resolve(dir)||!(dir===boundary||dir.startsWith(boundary+path.sep)))throw Error('Unsafe music staging directory');
  for(const item of fs.readdirSync(dir,{withFileTypes:true})){
    const file=path.join(dir,item.name);
    if(item.isSymbolicLink())throw Error('Unexpected staged music symlink');
    if(item.isDirectory()){prune(file,boundary);continue;}
    if(!item.isFile()||!file.startsWith(boundary+path.sep))throw Error('Unsafe staged music file');
    if(/\.(js|css)$/.test(file)&&!staged.has(file))fs.unlinkSync(file);
  }
}
for(const directory of ['js/music','css/music'])prune(path.join(root,'site/assets',directory));
console.log('Staged native music assets (compacted, licenses retained, obsolete chunks removed).');
