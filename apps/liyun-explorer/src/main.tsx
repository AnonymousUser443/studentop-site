import React from 'react';
import ReactDOM from 'react-dom/client';
import {flushSync} from 'react-dom';
import {arrival} from './startup/arrival';
import {prepareResources} from './startup/resources';
import VersionNotice from './startup/VersionNotice';
import {loadPublication} from './content/bootstrap';
// 样式加载顺序：令牌 → 画质 → 基线 → 旧全局（逐步被替代）
import './styles/tokens.css';
import './styles/quality.css';
import './styles/base.css';
import './global.css';

async function start(){
 if(new URLSearchParams(location.search).get('tool')==='calibration'&&new URLSearchParams(location.search).get('legacy')!=='1'){location.replace('/studio/');return;}
 const loading=arrival();
 try{
  loading.progress(.01,'正在确认最新校园篇章');
  await loadPublication();
  const resources=await prepareResources((n,label)=>loading.progress(.03+n*.94,label));
  const[{default:App},{default:Providers}]=await Promise.all([import('./App'),import('./app/providers')]);
  flushSync(()=>ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><Providers>{new URLSearchParams(location.search).has('contentPreview')&&<div className="content-preview-banner">团队草稿预览 · 不计入个人探索 <a href="/studio/">返回工坊 ↗</a></div>}<App/><VersionNotice/></Providers></React.StrictMode>));
  await loading.finish(resources.warm);
 }catch(error){
  loading.error(error);
 }
}
void start();
