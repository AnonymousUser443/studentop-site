/** OpenCLI-only browser driver. Never opens a separate raw CDP connection. */
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const execute=promisify(execFile);
export const SESSION=process.env.TINGCHAO_QA_SESSION||'tingchao-qa';
const cli=process.env.OPENCLI_ENTRY||'C:/Users/12929/AppData/Roaming/npm/node_modules/@jackwener/opencli/dist/src/main.js';
export async function browser(...args){
 const {stdout}=await execute(process.execPath,[cli,'browser',...args,...(args[0]==='chrome'?[]:['--session',SESSION])],{timeout:55000,maxBuffer:8*1024*1024,windowsHide:true});
 const line=stdout.split(/\r?\n/).find(value=>value.startsWith('{"ok":'));
 if(!line)throw Error('Missing OpenCLI result: '+stdout.slice(0,500));const result=JSON.parse(line);
 if(!result.ok)throw Error(JSON.stringify(result.error));return result.data;
}
export async function evaluate(fn,...args){
 const data=await browser('eval',typeof fn==='string'?fn:`(${fn.toString()})(...${JSON.stringify(args)})`);
 return data;
}
export async function screenshot(file,width,height){return browser('screenshot',path.resolve(file),...(width?['--width',String(width),'--height',String(height)]:[]));}
export async function waitFor(fn,timeout=12000,...args){
 const end=Date.now()+timeout;let value;
 do{value=await evaluate(`(async()=>Boolean(await (${fn.toString()})(...${JSON.stringify(args)})))()`);if(value===true)return true;await new Promise(resolve=>setTimeout(resolve,200));}while(Date.now()<end);
 throw Error('Browser condition timed out: '+fn.toString().slice(0,400)+'; last='+JSON.stringify(value));
}
export async function inspect(){return evaluate(()=>({url:location.href,locked:window.Win?.isLocked(),viewport:[innerWidth,innerHeight],window:document.querySelector('#windowLayer > [role=dialog]')?.getBoundingClientRect().toJSON(),root:document.querySelector('[data-tingchao-root]')?.getAttribute('data-music-theme'),snapshot:window.AidenMusic?.getSnapshot()&&{status:AidenMusic.getSnapshot().status,position:AidenMusic.getSnapshot().positionMs,track:AidenMusic.getSnapshot().currentTrack?.title,queue:AidenMusic.getSnapshot().queue.length,lyrics:AidenMusic.getSnapshot().lyrics?.lines.length,error:AidenMusic.getSnapshot().error?.message},audio:window.__tingchaoQa?.audio.map(a=>({sourceOrigin:a.currentSrc?new URL(a.currentSrc).origin:null,paused:a.paused,time:a.currentTime,duration:a.duration})),errors:window.__tingchaoQa?.errors,iframes:document.querySelectorAll('iframe').length}));}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [mode,...args]=process.argv.slice(2);let result;
 if(mode==='inspect')result=await inspect();
 else if(mode==='eval-file')result=await evaluate(await fs.readFile(args[0],'utf8'));
 else if(mode==='screenshot')result=await screenshot(...args);
 else result=await browser(mode,...args);
 console.log(JSON.stringify(result));
}
