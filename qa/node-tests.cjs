/* Pure Node tests: no browser, network, sockets, install, build or service startup. */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {evaluation,targetURL,matchesTarget,args} = require('./lib.js');

test('launcher exposes only public site assets and fixed entrypoints', async () => {
  const {publicPath,validHost,APPS,ACCOUNT_API,SITE_PORT,HOST} = await import('../tools/dev-workspace.mjs');
  assert.equal(HOST,'127.0.0.1'); assert.equal(SITE_PORT,8899);
  assert.deepEqual(APPS.map(x=>x.id),['liyun','campus','voxel']);
  assert.deepEqual(APPS.map(x=>x.port),[5174,8081,5180]);
  assert.equal(ACCOUNT_API.id,'liyun-api'); assert.equal(ACCOUNT_API.port,8787);
  assert.equal(new Set([SITE_PORT,ACCOUNT_API.port,...APPS.map(x=>x.port)]).size,5);
  assert.equal(path.basename(APPS.find(x=>x.id==='voxel').root),'liangxiang-cloudwalk');
  for (const [url,result] of [['/','index.html'],['/projects/','projects/index.html'],['/assets/js/core.js?v=1','assets/js/core.js'],['/assets/img/wall-chenyu.webp','assets/img/wall-chenyu.webp'],['/assets/fonts/OFL-NotoSansSC.txt','assets/fonts/OFL-NotoSansSC.txt'],['/assets/fonts/OFL-NotoSerifSC.txt','assets/fonts/OFL-NotoSerifSC.txt']]) assert.equal(publicPath(url),result);
  for (const url of ['/../README.md','/%2e%2e/README.md','/assets/js/../../.env','/assets/js/%252e%252e/.env','/assets/js/..%5csecrets.js','/assets/js/a.js:secret','//assets/js/core.js','/apps/liyun-explorer/src/App.tsx','/.git/config','/.env','/README.md','/assets/js/core.js.map','/assets/js/private-key.js','/assets/js/token.js','/assets/fonts/.env','/assets/fonts/secret.txt','/assets/fonts/anything.txt','/assets/img/x.','/%00','/%ZZ']) assert.equal(publicPath(url),null,url);
  assert.equal(validHost('127.0.0.1:8899'),true); assert.equal(validHost('localhost:8899'),true);
  for (const host of ['evil.example:8899','127.0.0.1:8080','127.0.0.1:8899.evil','localhost',undefined]) assert.equal(validHost(host),false);
});
test('site-only preflight skips all application dependency entries', async () => {
  const {preflight,ROOT} = await import('../tools/dev-workspace.mjs');
  const result = await preflight(true);
  assert.deepEqual(result.apps,[]);
  assert.equal(result.api,null);
  assert.equal(path.basename(result.site),'site');
  assert.equal(path.relative(result.workspace,ROOT),'');
});
test('containment rejects sibling prefix and parent paths', async () => {
  const {within} = await import('../tools/dev-workspace.mjs');
  const root=path.resolve('site');
  assert.equal(within(root,path.join(root,'assets','a.js')),true);
  assert.equal(within(root,path.resolve('site-copy','a.js')),false);
  assert.equal(within(root,path.resolve('README.md')),false);
});
test('QA fails closed on false, missing, empty and malformed assertions', () => {
  for (const result of [false,'false','null',null,undefined,{ok:false},{errors:['boom']},{checks:[]},{checks:null},{checks:undefined},{checks:[{pass:false}]},{checks:[{pass:true,ok:false}]},{checks:[{pass:'true'}]},{checks:[{}]},{results:[{passed:false}]},{checks:[{pass:true}],total:2},{checks:[{pass:true}],passed:0},'{broken']) assert.throws(()=>evaluation(result));
  assert.throws(()=>evaluation({metrics:42},true));
  assert.equal(evaluation({checks:[{pass:true}]}).assertions,1);
  assert.equal(evaluation(JSON.stringify({checks:[{pass:true}]})).assertions,1);
  assert.equal(evaluation({results:[{passed:true}]}).assertions,1);
});
test('URLs default to loopback and exact origins cannot be spoofed', () => {
  assert.equal(targetURL('http://127.0.0.1:8899/'),'http://127.0.0.1:8899/');
  for (const url of ['https://studentop.cn:14355/','javascript:alert(1)','http://127.0.0.1.evil/','http://user:pass@localhost/']) assert.throws(()=>targetURL(url));
  assert.equal(matchesTarget('http://127.0.0.1:5174/?qa=1','http://127.0.0.1:5174/'),true);
  assert.equal(matchesTarget('http://127.0.0.1:5174.evil/','http://127.0.0.1:5174/'),false);
  assert.equal(matchesTarget('http://127.0.0.1:5174/wrong','http://127.0.0.1:5174/'),false);
  assert.equal(matchesTarget('http://127.0.0.1:5175/','http://127.0.0.1:5174/'),false);
});
test('legacy positional URLs and explicit options parse', () => {
  assert.deepEqual(args(['http://127.0.0.1:8899/','--mode','flow','--allow-public']),{_:['http://127.0.0.1:8899/'],mode:'flow','allow-public':true});
  assert.throws(()=>args(['--url']));
});
