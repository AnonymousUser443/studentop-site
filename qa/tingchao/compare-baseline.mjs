import fs from 'node:fs';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
const live=JSON.parse(fs.readFileSync('.release-local/music-pi-before.json'));
const id=JSON.parse(fs.readFileSync('.tmp/music-build-baseline/version.json')).id;
const hash=b=>createHash('sha256').update(b).digest('hex');
const site=live.canonicalFiles.map(file=>{const data=fs.readFileSync('.tmp/music-build-baseline/'+(file.path.startsWith('assets/')?'assets/releases/'+id+'/'+file.path.slice(7):file.path));const canonical=/\.(?:html|js|mjs|css|svg)$/.test(file.path)?Buffer.from(data.toString('utf8').replaceAll('\r\n','\n').replaceAll(id,'NATIVE_VERSION')):data;return{path:file.path,match:hash(canonical)===file.sha256};});
const auth=live.authFiles.map(file=>({path:file.path,match:hash(execFileSync('git',['show','825f1b99d35384aecc65ae4990bb0f9970d4beab:'+file.path],{maxBuffer:4*1024*1024}).toString('utf8').replaceAll('\r\n','\n'))===file.sha256}));
fs.writeFileSync('.release-local/music-baseline-comparison.json',JSON.stringify({live:live.version,baseline:id,site,auth},null,2)+'\n');console.log(JSON.stringify({siteTotal:site.length,siteDifferent:site.filter(f=>!f.match),auth}));
