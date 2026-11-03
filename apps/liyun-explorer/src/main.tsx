import React from 'react';
import ReactDOM from 'react-dom/client';
import {loadPublication} from './content/bootstrap';
// 样式加载顺序：令牌 → 画质 → 基线 → 旧全局（逐步被替代）
import './styles/tokens.css';
import './styles/quality.css';
import './styles/base.css';
import './global.css';

async function start(){
 if(new URLSearchParams(location.search).get('tool')==='calibration'&&new URLSearchParams(location.search).get('legacy')!=='1'){location.replace('/studio/');return;}
 try{
  await loadPublication();
  const[{default:App},{default:Providers}]=await Promise.all([import('./App'),import('./app/providers')]);
  ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><Providers>{new URLSearchParams(location.search).has('contentPreview')&&<div className="content-preview-banner">团队草稿预览 · 不计入个人探索 <a href="/studio/">返回工坊 ↗</a></div>}<App/></Providers></React.StrictMode>);
 }catch(error){
  const root=document.getElementById('root')!;root.replaceChildren();const message=document.createElement('p');message.textContent=error instanceof Error?error.message:'地图内容暂时不可用';const retry=document.createElement('button');retry.textContent='重新载入';retry.onclick=()=>location.reload();const studio=document.createElement('a');studio.href='/studio/';studio.textContent='返回团队工坊';root.append(message,retry,studio);
 }
}
void start();
