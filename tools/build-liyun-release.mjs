#!/usr/bin/env node
/** Local-only immutable wrapper for Vite's publicDir assets (fonts/art keep stable source names). */
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const digest=b=>createHash('sha256').update(b).digest('hex');
const allowed=/^(?:index\.html|sw\.js|favicon\.svg|assets\/[A-Za-z0-9_./-]+)$/;
const extensions=new Set(['.html','.css','.js','.mjs','.json','.svg','.png','.jpg','.jpeg','.webp','.avif','.gif','.ico','.woff','.woff2','.ttf','.otf','.mp3','.opus','.ogg','.wav','.m4a','.mp4','.webm','.wasm']);
const licenses=new Set(['assets/fonts/MaShanZheng-OFL.txt','assets/fonts/NotoSerifSC-OFL.txt','assets/fonts/DejaVu-LICENSE.txt']);
function files(root,dir=''){
 const out=[];for(const entry of fs.readdirSync(path.join(root,dir),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en'))){
  const name=dir?dir+'/'+entry.name:entry.name;if(entry.isSymbolicLink()||name.split('/').some(s=>!s||s.startsWith('.')||s==='..'))throw Error('Unsafe public artifact');
  if(entry.isDirectory())out.push(...files(root,name));else if(entry.isFile()&&allowed.test(name)&&!/(?:^|[\/._-])(?:secret|private|credentials?|password|token|auth|env)(?:[\/._-]|$)/i.test(name)&&(extensions.has(path.extname(name))||licenses.has(name)))out.push({path:name,data:fs.readFileSync(path.join(root,name))});else throw Error('Unexpected public artifact: '+name);
 }return out;
}
export function buildLiyunRelease(source,out){
 source=fs.realpathSync(source);out=path.resolve(out);const relative=path.relative(source,out);
 if(!relative||(!path.isAbsolute(relative)&&relative!=='..'&&!relative.startsWith('..'+path.sep)))throw Error('Output must be outside source');
 if(fs.existsSync(out))throw Error('Output already exists; use a new dedicated release directory');
 const input=files(source);if(!input.some(f=>f.path==='index.html'))throw Error('Missing index');
 const hash=createHash('sha256').update('liyun-immutable-release-v3\0').update(JSON.parse(fs.readFileSync(path.join(ROOT,'apps/liyun-explorer/package.json'),'utf8')).version+'\0');for(const f of input)hash.update(f.path+'\0'+f.data.length+'\0').update(f.data).update('\0');
 const id=hash.digest('hex').slice(0,24),prefix='/assets/releases/'+id+'/';const manifest=[];
 for(const file of input){
  let data=file.data;
  if(/\.(?:html|js|css|mjs)$/.test(file.path)){
   let text=data.toString('utf8').replace(/(["'`(])\/assets\/(?!releases\/)/g,(_all,start)=>start+prefix).replace(/(["'`])assets\//g,(_all,start)=>start+prefix.slice(1)).replace(/(["'`(])\/favicon\.svg/g,(_all,start)=>start+prefix+'favicon.svg');
   if(file.path==='index.html')text=text.replace('</head>','<meta name="liyun-release" content="'+id+'">\n</head>');data=Buffer.from(text);
  }
  const name=['index.html','sw.js'].includes(file.path)?file.path:prefix.slice(1)+(file.path.startsWith('assets/')?file.path.slice(7):file.path);
  const dest=path.join(out,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,data,{flag:'wx'});manifest.push({path:name,bytes:data.length,sha256:digest(data)});
 }
 const assets=manifest.filter(f=>f.path.startsWith(prefix.slice(1))).map(f=>({url:'/'+f.path,bytes:f.bytes,sha256:f.sha256}));
 const add=(name,value)=>{const data=Buffer.from(JSON.stringify(value));const dest=path.join(out,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,data);manifest.push({path:name,bytes:data.length,sha256:digest(data)});};
 add(prefix.slice(1)+'precache.json',{format:1,version:id,assets});
 add('version.json',{id,version:JSON.parse(fs.readFileSync(path.join(ROOT,'apps/liyun-explorer/package.json'),'utf8')).version});
 return {format:1,id,files:manifest,sourceFiles:input.length,bytes:manifest.reduce((n,f)=>n+f.bytes,0)};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{if(process.argv.length!==4)throw Error('Usage: node tools/build-liyun-release.mjs <vite-dist> <new-output>');console.log(JSON.stringify(buildLiyunRelease(process.argv[2],process.argv[3])));}catch(e){console.error(e.message);process.exitCode=1;}
}
