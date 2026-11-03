import './prepare-studio.mjs';
import path from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';import {spawn} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url)),url='http://127.0.0.1:5174/studio/',noOpen=process.argv.includes('--no-open'),children=[];
const start=args=>{const child=spawn(process.execPath,args,{cwd:root,stdio:'inherit',windowsHide:true});children.push(child);child.on('error',error=>{console.error(error.message);process.exitCode=1;});return child;};
async function check(url,expected){try{const response=await fetch(url,{signal:AbortSignal.timeout(1500)}),text=await response.text();if(!response.ok||!expected(text))throw Error('Port already belongs to another service: '+url);return true;}catch(error){if(error.cause?.code==='ECONNREFUSED')return false;throw error;}}
if(!await check('http://127.0.0.1:8790/api/editor/health',s=>s.includes('liyun-editor')))start(['server/author.mjs']);
if(!await check('http://127.0.0.1:5174/',s=>s.includes('/@vite/client')&&s.includes('理韵寻踪'))){const require=createRequire(import.meta.url),vite=path.join(path.dirname(require.resolve('vite/package.json')),'bin/vite.js');start([vite,'--host','127.0.0.1','--port','5174','--strictPort']);}
console.log('Team studio: '+url);console.log('Keep this terminal open for any services started here.');
if(!noOpen){const command=process.platform==='win32'?'rundll32.exe':process.platform==='darwin'?'open':'xdg-open',args=process.platform==='win32'?['url.dll,FileProtocolHandler',url]:[url];const browser=spawn(command,args,{stdio:'ignore',windowsHide:true});browser.on('error',()=>console.error('Open '+url+' in your browser.'));browser.unref();}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{for(const child of children)child.kill();});
