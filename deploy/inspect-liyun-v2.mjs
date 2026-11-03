// Read-only production inventory. Never emits env values, database rows, tokens or credentials.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const sha=b=>createHash('sha256').update(b).digest('hex');
const pointers={};
for(const root of ['/opt/win11-home',...fs.readdirSync('/opt/projects').map(n=>'/opt/projects/'+n)]){
  if(fs.existsSync(root+'/current')&&fs.lstatSync(root+'/current').isSymbolicLink())pointers[root]=fs.realpathSync(root+'/current');
}
const services={};for(const name of ['nginx','frpc','frost-atlas','desktop-auth','rpi-monitor','liyun-account']){
  try{services[name]=Object.fromEntries(execFileSync('systemctl',['show',name,'-p','ActiveState','-p','MainPID','-p','ExecMainStartTimestampMonotonic'],{encoding:'utf8'}).trim().split('\n').map(l=>l.split('=')));}catch{}
}
const configs={};for(const file of ['/etc/nginx/nginx.conf','/etc/nginx/sites-available/projects','/etc/nginx/sites-available/win11-home','/etc/nginx/snippets/win11-home-app.conf','/etc/nginx/snippets/win11-home-projects.conf','/etc/systemd/system/liyun-account.service'])if(fs.existsSync(file))configs[file]=sha(fs.readFileSync(file));
const api=pointers['/opt/projects/liyun-api'];const apiFiles={};for(const name of ['server.mjs','store.mjs','progress.mjs'])apiFiles[name]=sha(fs.readFileSync(path.join(api,name)));
const current=pointers['/opt/projects/liyun'];const html=fs.readFileSync(current+'/index.html','utf8');
console.log(JSON.stringify({at:new Date().toISOString(),pointers,services,configs,apiFiles,staticIndexSha256:sha(html),staticVersion:html.match(/name="liyun-release" content="([a-f0-9]+)"/)?.[1]??null},null,2));
