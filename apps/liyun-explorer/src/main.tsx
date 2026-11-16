import React from 'react';
import ReactDOM from 'react-dom/client';
import {flushSync} from 'react-dom';
import {arrival} from './startup/arrival';
import {prepareResources} from './startup/resources';
import VersionNotice from './startup/VersionNotice';
import {loadPublication} from './content/bootstrap';
import {prepareOpeningActivityArtwork,prepareLaterActivityArtwork,warmArtwork} from './activity/artworkAssets';
import { PAPER_TEXTURE } from './world/paper/scorch';
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
  const publication=loadPublication();
  const [,resources]=await Promise.all([
   publication,
   prepareResources((n,label)=>loading.progress(.03+n*.92,label),publication),
  ]);
  loading.progress(.96,'正在预绘宣纸揭幕');
  // Decode from the verified release cache while the navigation modules load. Optional
  // art cannot keep the entrance blocked; slower images continue in the background.
  const artwork=Promise.all([
   warmArtwork('/assets/maps/campus-xuan.webp'),
   warmArtwork('/assets/paintings/frost-frame.webp'),
   warmArtwork('/assets/art/pine-left.webp'),
   warmArtwork('/assets/art/mountain-right.webp'),
   warmArtwork('/assets/regions/xuan-paper.webp'),
   warmArtwork(PAPER_TEXTURE),
  ]).then(prepareOpeningActivityArtwork);
  let artBudget:ReturnType<typeof setTimeout>|undefined;
  const [,{default:App},{default:Providers}]=await Promise.all([
   Promise.race([artwork,new Promise<void>(resolve=>{artBudget=setTimeout(resolve,650);})]).finally(()=>clearTimeout(artBudget)),
   import('./App'),
   import('./app/providers'),
   import('./world/paper/arrivalBake').then(module=>module.prepareArrivalPaper()),
  ]);
  flushSync(()=>ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><Providers>{new URLSearchParams(location.search).has('contentPreview')&&<div className="content-preview-banner">团队草稿预览 · 不计入个人探索 <a href="/studio/">返回工坊 ↗</a></div>}<App/><VersionNotice/></Providers></React.StrictMode>));
  await loading.finish(resources.warm);
  prepareLaterActivityArtwork();
 }catch(error){
  loading.error(error);
 }
}
void start();
