#!/usr/bin/env node
/** Local-only release compiler/checker. Never invokes SSH, npm, browsers or servers. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSite, verifySiteBuild } from './site-release.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function main(argv=process.argv.slice(2)) {
  if(argv.length===1 && argv[0]==='--help') {console.log('node tools/build-site.mjs [--source site] [--out dist-site] [--retain 2]\nnode tools/build-site.mjs --check dist-site');return;}
  if(argv[0]==='--check') {if(argv.length!==2)throw new Error('--check requires exactly one generated output directory.');const result=verifySiteBuild(path.resolve(argv[1]));console.log(JSON.stringify({ok:true,mode:'check',...result}));return result;}
  const options={source:path.join(ROOT,'site'),out:path.join(ROOT,'dist-site'),retain:2};
  for(let i=0;i<argv.length;i+=2) {
    const name=argv[i];if(!['--source','--out','--retain'].includes(name)||!argv[i+1]||argv[i+1].startsWith('--'))throw new Error('Unknown/missing build option. Use --help.');
    options[name.slice(2)]=name==='--retain'?Number(argv[i+1]):path.resolve(argv[i+1]);
  }
  const result=buildSite(options.source,options.out,{retain:options.retain});console.log(JSON.stringify({ok:true,mode:'build',...result}));return result;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {main();}catch(error){console.error(JSON.stringify({ok:false,error:String(error.message)}));process.exitCode=1;}
}
