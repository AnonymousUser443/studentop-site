import fs from 'node:fs';import path from 'node:path';
const session=JSON.parse(fs.readFileSync('.release-local/liyun-ui-publish-session.json','utf8').replace(/^\uFEFF/,''));
const root=path.join(session.out,'bundle/public'),prefix='assets/releases/'+session.version+'/';
const files=[];function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(/\.(js|css|html)$/.test(p))files.push(p);}}walk(root);
const dependencies=[];
for(const file of files){const text=fs.readFileSync(file,'utf8');for(const match of text.matchAll(/["'`]\/?(assets\/[^"'`\s${}]+)["'`]/g)){
 const url=match[1];if(!url.startsWith(prefix))throw Error('Unversioned asset literal: '+url);
 // This check targets Vite's preload JS/CSS map and fonts. Frozen map metadata
 // also embeds historical image labels that the runtime deliberately does not load.
 if(!/\.(js|css|woff2?|svg)$/.test(url))continue;
 if(!fs.existsSync(path.join(root,url)))throw Error('Unresolved published dependency: '+url);dependencies.push({file:path.relative(root,file),url});
}}
if(!dependencies.some(d=>d.url.includes('MenuScreen-'))||!dependencies.some(d=>d.url.includes('SettingsScreen-')))throw Error('Lazy preload map not covered');
fs.writeFileSync('qa/release-liyun-ui-20261103/wrapper.json',JSON.stringify({ok:true,version:session.version,dependencies:dependencies.length,files:files.length},null,2));
console.log(JSON.stringify({ok:true,version:session.version,dependencies:dependencies.length,files:files.length}));
