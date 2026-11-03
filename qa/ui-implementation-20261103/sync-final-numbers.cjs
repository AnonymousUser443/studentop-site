const fs=require('node:fs'),path=require('node:path');
const here=__dirname,root=path.resolve(here,'../..'),app=path.join(root,'apps/liyun-explorer');
const inv=JSON.parse(fs.readFileSync(path.join(here,'invariants.json'),'utf8'));if(!inv.ok)throw Error('Passing artifact required');
const bytes=inv.evidence.dist.bytes,gzip=inv.evidence.initialJS.reduce((n,v)=>n+v.gzipBytes,0),remaining=20*1024*1024-bytes;
const substitutions=[['20,957,758',bytes.toLocaleString('en-US')],['19.9868755',(bytes/1024/1024).toFixed(7)],['19.987',(bytes/1024/1024).toFixed(3)],['13,762',remaining.toLocaleString('en-US')],['214,155',gzip.toLocaleString('en-US')],['65文件',inv.evidence.dist.files+'文件'],['键盘15','键盘16'],['键盘15项','键盘16项'],['生产纯键盘15','生产纯键盘16'],['生产键盘15','生产键盘16']];
substitutions.push(['20,908,789',bytes.toLocaleString('en-US')],['19.9401751',(bytes/1024/1024).toFixed(7)],['19.940',(bytes/1024/1024).toFixed(3)],['62,731',remaining.toLocaleString('en-US')],['214,013',gzip.toLocaleString('en-US')]);
for(const filename of ['README.md','TODO.md','docs/ASSETS.md','docs/QA.md','docs/IMPLEMENTATION-TRACKER-20261103.md'].map(f=>path.join(app,f)).concat(path.join(here,'README.md'))){let text=fs.readFileSync(filename,'utf8');for(const[from,to]of substitutions)text=text.split(from).join(to);fs.writeFileSync(filename,text);}
console.log(JSON.stringify({bytes,gzip,files:inv.evidence.dist.files,remaining}));
