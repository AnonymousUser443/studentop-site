// Narrow recovery of the frontend pointer only. Preserve the upgraded account DB.
import fs from 'node:fs';import {execFileSync} from 'node:child_process';
const root='/opt/projects/liyun',bad=root+'/releases/liyun-ui-20261103T120047Z-2da7680f86',previous=root+'/releases/activity-monitor-20261029T154940Z-f320dadbb9';
if(process.getuid()!==0||fs.realpathSync(root+'/current')!==bad||!fs.statSync(previous+'/index.html').isFile())throw Error('Recovery baseline mismatch');
execFileSync('nginx',['-t']);fs.symlinkSync(previous,root+'/.recover-ui-20261103');fs.renameSync(root+'/.recover-ui-20261103',root+'/current');execFileSync('systemctl',['reload','nginx']);
console.log(JSON.stringify({ok:true,frontend:fs.realpathSync(root+'/current'),api:fs.realpathSync('/opt/projects/liyun-api/current'),databaseUnchanged:true,at:new Date().toISOString()}));
