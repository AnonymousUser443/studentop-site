import {validPublication} from '../../shared/published.mjs';
const CACHE='liyun.content.published.v1';
export async function loadPublication(){
 const query=new URLSearchParams(location.search),preview=query.get('contentPreview');
 if(preview!==null){
  if(!/^\d+$/.test(preview))throw Error('草稿预览版本无效');
  const response=await fetch('/api/editor/preview?revision='+preview,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(8000)}),body=await response.json();
  if(!response.ok||!validPublication(body.published))throw Error(body.error??'无法读取草稿，请先在团队工坊加入协作');
  window.__LIYUN_CONTENT__=body.published;return;
 }
 if(query.get('tool')==='calibration')return;
 let cached:unknown;try{cached=JSON.parse(localStorage.getItem(CACHE)??'null');}catch{/* Optional public catalog cache. */}
 try{
  const response=await fetch('/api/content/published',{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(3500)});
  if(!response.ok)throw Error('地图内容服务暂不可用');const body=await response.json();
  if(body.published===null){if(validPublication(cached))window.__LIYUN_CONTENT__=cached;return;}
  if(!validPublication(body.published))throw Error('地图内容版本无效');window.__LIYUN_CONTENT__=body.published;
  try{localStorage.setItem(CACHE,JSON.stringify(body.published));}catch{/* Browsers may disable persistent storage. */}
 }catch(error){
  if(validPublication(cached)){window.__LIYUN_CONTENT__=cached;return;}
  if(['127.0.0.1','localhost','[::1]'].includes(location.hostname))return;
  throw error;
 }
}
