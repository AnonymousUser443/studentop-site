import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {describe,expect,it,vi} from 'vitest';

const origin='https://liyun.test';
const program=readFileSync(new URL('../../public/sw.js',import.meta.url),'utf8');
function serviceWorker(){
 let onFetch:(event:{request:Request,respondWith(response:Promise<Response>):void})=>void;
 const network=vi.fn(async (_request:Request)=>new Response('network'));
 const lookup=vi.fn(async (_url:string,_options:{cacheName:string}):Promise<Response|undefined>=>undefined);
 const self={location:new URL(origin),addEventListener(type:string,listener:typeof onFetch){
  if(type==='fetch')onFetch=listener;
 }};
 runInNewContext(program,{self,caches:{match:lookup},fetch:network,URL,Headers,Response});
 return {
  network,lookup,
  async handle(request:Request){
   let response:Promise<Response>|undefined;
   onFetch({request,respondWith:result=>{response=result;}});
   return response;
  },
 };
}
const audio=origin+'/assets/releases/'+'a'.repeat(24)+'/audio/bgm1.opus';
const media=origin+'/api/content/media/'+'a'.repeat(64)+'.webp';
describe('offline service worker',()=>{
 it('lets the verifying loader own its requests and never serves a draft from an older cache',async ()=>{
  const sw=serviceWorker();
  const preload=new Request(audio,{headers:{'X-Liyun-Precache':'1'}});
  expect(await sw.handle(preload)).toBeUndefined();
  expect(sw.lookup).not.toHaveBeenCalled();
  sw.lookup.mockResolvedValue(new Response('draft',{
   headers:{'Content-Type':'image/webp','Cache-Control':'private, no-store'}
  }));
  expect(await (await sw.handle(new Request(media)))?.text()).toBe('network');
  expect(sw.network).toHaveBeenCalledOnce();
 });

 it('serves local range seeks with an accurate body, including WebKit-style one-byte probes',async ()=>{
  const sw=serviceWorker();
  sw.lookup.mockImplementation(async ()=>new Response('abcd',{headers:{'Content-Type':'audio/ogg'}}));
  const range=(value:string)=>sw.handle(new Request(audio,{headers:{Range:value}}));
  const probe=await range('bytes=0-0');
  expect(probe?.status).toBe(206);
  expect(probe?.headers.get('Content-Length')).toBe('1');
  expect(probe?.headers.get('Content-Range')).toBe('bytes 0-0/4');
  expect(await probe?.text()).toBe('a');
  expect(await (await range('bytes=-2'))?.text()).toBe('cd');
  expect((await range('bytes=10-'))?.status).toBe(416);
  expect(sw.network).not.toHaveBeenCalled();
 });

 it('keeps the checked offline shell when a newer navigation response arrives',async ()=>{
  const sw=serviceWorker();
  // A Node Request cannot manufacture a browser navigation. Supply its event shape.
  const navigation={url:origin+'/',method:'GET',mode:'navigate'} as Request;
  sw.lookup.mockResolvedValue(new Response('checked old shell'));
  sw.network.mockResolvedValueOnce(new Response('unverified new shell'));
  expect(await (await sw.handle(navigation))?.text()).toBe('unverified new shell');
  sw.network.mockRejectedValueOnce(Error('offline'));
  expect(await (await sw.handle(navigation))?.text()).toBe('checked old shell');
  expect(sw.lookup).toHaveBeenCalledExactlyOnceWith('/',{cacheName:'liyun-shell-v1'});
 });
});
