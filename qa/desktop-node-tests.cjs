/* Exercise the real desktop core in a minimal VM: no DOM rendering, browser or network. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function core({blocked=false,stored={}}={}) {
  const memory=new Map(Object.entries(stored)), opened=[];
  const window={location:{href:'http://127.0.0.1:8899/',hostname:'127.0.0.1'},
    matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){},
    open:(...args)=>{opened.push(args);return null;}};
  const localStorage={getItem:key=>{if(blocked)throw new Error('blocked');return memory.get(key)??null;},
    setItem:(key,value)=>{if(blocked)throw new Error('quota');memory.set(key,value);},
    removeItem:key=>{if(blocked)throw new Error('blocked');memory.delete(key);}};
  const context=vm.createContext({window,document:{readyState:'loading',addEventListener(){}},localStorage,URL,console,setTimeout,clearTimeout});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../site/assets/js/core.js'),'utf8'),context);
  return {Win:window.Win,opened,memory};
}
test('desktop safeUrl rejects executable schemes credentials and controls',()=>{
  const {Win}=core();
  for(const url of ['',null,'javascript:alert(1)','data:text/html,test','file:///C:/secret','http://u:p@localhost/','https://example.test/\n']) assert.equal(Win.safeUrl(url),'');
  assert.equal(Win.safeUrl('assets/img/avatar-aiden.jpg'),'http://127.0.0.1:8899/assets/img/avatar-aiden.jpg');
  assert.equal(Win.safeUrl('mailto:a@example.test'),'');
  assert.equal(Win.safeUrl('mailto:a@example.test',true),'mailto:a@example.test');
  assert.equal(Win.esc('<img src=x onerror="x">'), '&lt;img src=x onerror=&quot;x&quot;&gt;');
});
test('desktop project mapping is restricted to exact loopback hosts',()=>{
  const {Win}=core();
  assert.equal(Win.resolveProjectUrl('liyun-explorer','https://example.test/','127.0.0.1'),'http://127.0.0.1:5174/');
  assert.equal(Win.resolveProjectUrl('genshin-start','https://example.test/','localhost'),'http://127.0.0.1:8081/');
  for(const host of ['studentop.cn','localhost.evil','127.0.0.1.evil']) assert.equal(Win.resolveProjectUrl('genshin-start','https://example.test/',host),'https://example.test/');
  assert.equal(Win.resolveProjectUrl('frost-atlas','https://example.test/','localhost'),'https://example.test/');
});
test('desktop store reports persistence failure but preserves in-memory values',()=>{
  const {Win}=core({blocked:true});
  assert.equal(Win.store.get('missing','fallback'),'fallback');
  assert.equal(Win.store.set('draft',{text:'test'}),false);
  assert.equal(Win.store.get('draft').text,'test');
  assert.equal(Win.store.del('draft'),false);
  assert.equal(Win.store.get('draft','gone'),'gone');
  const cycle={};cycle.self=cycle;
  assert.equal(Win.store.set('bad',cycle),false);
});
test('desktop preferences reject corrupt values and external open is never retried',()=>{
  const {Win,opened}=core({stored:{'win11home.v1.prefs':JSON.stringify({themeMode:'bad',motion:'false',accent:'red',align:'bad',wall:'bad'})}});
  assert.equal(Win.prefs.themeMode,'light'); assert.equal(Win.prefs.motion,true); assert.equal(Win.prefs.wall,'chenyu');
  assert.equal(Win.validPref('themeMode','dark'),true); assert.equal(Win.validPref('motion',false),true);
  for(const [key,value] of [['themeMode','DARK'],['motion','false'],['accent','red'],['unknown',true]]) assert.equal(Win.validPref(key,value),false);
  assert.equal(Win.openExternal('http://127.0.0.1:5174/'),true);
  assert.equal(opened.length,1); assert.equal(opened[0][2],'noopener,noreferrer');
});
