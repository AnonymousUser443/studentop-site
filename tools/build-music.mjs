#!/usr/bin/env node
/** Compile and stage only the native music module. Does not publish. */
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),app=path.join(root,'apps/aidenos-music');
if(!process.argv.includes('--stage-only')){const r=spawnSync(process.execPath,[path.join(app,'node_modules/typescript/bin/tsc'),'--noEmit'],{cwd:app,stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);const b=spawnSync(process.execPath,[path.join(app,'node_modules/vite/bin/vite.js'),'build'],{cwd:app,stdio:'inherit'});if(b.status!==0)process.exit(b.status||1);}
const dist=path.join(app,'dist');
const {transformWithEsbuild}=await import(pathToFileURL(path.join(app,'node_modules/vite/dist/node/index.js')).href);
// ES library output preserves whitespace for downstream tree shaking. This is a
// complete native entry, so compact the final artifact after Rollup has shaken it.
// Keep third-party license notices; do not ship development comments or maps.
async function copy(dir,prefix=''){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const rel=prefix+ent.name,src=path.join(dir,ent.name);if(ent.isSymbolicLink())throw Error('Unexpected music build symlink');if(ent.isDirectory()){await copy(src,rel+'/');continue;}if(!/\.(js|css)$/.test(rel))throw Error('Unexpected public module artifact: '+rel);const dest=path.join(root,'site/assets',rel.endsWith('.css')?'css/music':'js/music',rel);fs.mkdirSync(path.dirname(dest),{recursive:true});const artifact=await transformWithEsbuild(fs.readFileSync(src,'utf8'),rel,{loader:rel.endsWith('.css')?'css':'js',minify:true,legalComments:'inline',charset:'utf8',target:'es2020',sourcemap:false});fs.writeFileSync(dest,artifact.code);}}
await copy(dist);console.log('Staged native music assets (compacted).');
