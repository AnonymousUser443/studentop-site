import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
const base=join(process.cwd(),'public','assets');
const files=[];
function visit(folder){
  for(const entry of readdirSync(folder,{withFileTypes:true})){
    const path=join(folder,entry.name);
    if(entry.isDirectory())visit(path);
    else files.push({path:relative(process.cwd(),path).replaceAll('\\','/'),bytes:statSync(path).size,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')});
  }
}
visit(base);
writeFileSync('docs/asset-manifest.json',JSON.stringify({generatedAt:new Date().toISOString(),mapId:'campus-v04-eaa124716c51375f',logicalCanvas:[4000,4958],totalBytes:files.reduce((n,x)=>n+x.bytes,0),files},null,2)+'\n');
console.log(`Recorded ${files.length} assets.`);
