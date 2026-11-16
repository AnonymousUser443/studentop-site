import {afterEach,describe,expect,it,vi} from 'vitest';
import {loadPublication} from './bootstrap';

const key='liyun.content.published.v1';
function install(initial?:string,online=true,search=''){
 const storage=new Map<string,string>(initial===undefined?[]:[[key,initial]]);
 const pull=vi.fn(async (_input:string)=>Response.json({published:null}));
 const write=vi.fn((name:string,value:string)=>{storage.set(name,value);});
 vi.stubGlobal('fetch',pull);
 vi.stubGlobal('localStorage',{getItem:(name:string)=>storage.get(name)??null,setItem:write});
 vi.stubGlobal('location',new URL('/'+search,'https://liyun.test'));
 vi.stubGlobal('navigator',{onLine:online});
 vi.stubGlobal('window',{});
 return {pull,write,storage};
}
const points=[{u:.1,v:.1},{u:.4,v:.1},{u:.4,v:.4}];
const geometry=[[points]];
const publication={revision:2,document:{
 schema:2,mapId:'campus-v04-eaa124716c51375f',boundary:{name:'良乡',geometry},
 sites:[{id:'lake',name:'北湖',intro:'环湖步行',subtitle:'湖光',verse:'秋日',icon:'lake',physical:true,center:{uv:points[0]},radiusM:30,geometry,photos:[]}]
}};
afterEach(()=>vi.unstubAllGlobals());

describe('public catalog bootstrap',()=>{
 it('records the confirmed built-in catalog for a real offline refresh',async ()=>{
  const fixture=install();
  await loadPublication();
  expect(fixture.write).toHaveBeenCalledExactlyOnceWith(key,'null');
  const offline=install(fixture.storage.get(key),false);
  await loadPublication();
  expect(offline.pull).not.toHaveBeenCalled();
  expect(window.__LIYUN_CONTENT__).toBeUndefined();
 });

 it('cannot treat an unavailable server as an empty catalog without a known copy',async ()=>{
  const fixture=install(undefined,false);
  fixture.pull.mockRejectedValue(Error('offline'));
  await expect(loadPublication()).rejects.toThrow('offline');
  expect(fixture.write).not.toHaveBeenCalled();
 });

 it('does not serialize the same public revision again and still applies new ones',async ()=>{
  const fixture=install(JSON.stringify(publication));
  fixture.pull.mockResolvedValueOnce(Response.json({published:publication}));
  await loadPublication();
  expect(window.__LIYUN_CONTENT__?.revision).toBe(2);
  expect(fixture.write).not.toHaveBeenCalled();
  fixture.pull.mockResolvedValueOnce(Response.json({published:{...publication,revision:3}}));
  await loadPublication();
  expect(window.__LIYUN_CONTENT__?.revision).toBe(3);
  expect(fixture.write).toHaveBeenCalledOnce();
 });

 it('does not substitute a public catalog or write a draft if the editor preview is offline',async ()=>{
  const fixture=install(JSON.stringify(publication),false,'?contentPreview=3');
  fixture.pull.mockRejectedValue(Error('offline'));
  await expect(loadPublication()).rejects.toThrow('offline');
  expect(fixture.pull.mock.calls[0]?.[0]).toBe('/api/editor/preview?revision=3');
  expect(fixture.write).not.toHaveBeenCalled();
 });
});
