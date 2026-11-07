import { StageFilm } from '../../components/StageFilm';
import { appUrl } from "../../core/url";
import type { StoryProps } from './types';
import { reducedMotion, slideById, type Slide } from '../../core/deck';
import './story5.css';
function Copy({slide,lines}:{slide:Slide;lines?:string[]}){return <div className="s5-copy" key={slide.id} data-story-copy>{(lines||slide.content).filter(Boolean).map((t,i)=><p key={i}>{t}</p>)}</div>}
function Core({rotation=0,duration=1.1}:{rotation?:number;duration?:number}){
 return <div className="s5-core"><i aria-hidden="true"/><div className="s5-rotor" data-perform data-rotate={rotation} data-duration={duration} data-enter-y={0}><img src={appUrl("/assets/art/p5/obsidian-computing-seal-v3.png")} alt="黑曜鎏金计算核心"/></div><span>AI</span></div>
}
function Machine({slide,beat}:StoryProps){return <div className={`s5-machine s5-machine-${beat}`}><img className="s5-art s5-chamber" src={appUrl("/assets/art/p5/obsidian-computing-chamber-v3.png")} alt="鎏金机器空间示意"/><div className="s5-machine-core" data-perform data-x={beat===0?300:0} data-scale={beat===0?.6:beat===3?1.12:1} data-alpha={beat===0?.2:1} data-duration={1.5}><Core rotation={beat===3?120:0} duration={beat===3?1.65:1}/></div><svg className="s5-circuit" viewBox="0 0 1920 1080">{[0,1,2].map(i=><path key={i} pathLength={1} d={`M710 ${515+i*155}H800L1040 ${500+i*65}H1220`} data-perform data-alpha={beat>=2?1:0} data-delay={i*.16}/>)}</svg>{['写代码','整理资料','问问题'].map((t,i)=><div className="s5-input" key={t} style={{top:470+i*155}} data-perform data-x={beat>=2?0:-280} data-alpha={beat>=2?1:0} data-delay={i*.14}><span>0{i+1}</span>{t}</div>)}<div className="s5-door s5-door-left" data-perform data-x={beat===0?0:-1100} data-alpha={beat===0?1:0}/><div className="s5-door s5-door-right" data-perform data-x={beat===0?0:1100} data-alpha={beat===0?1:0}/><Copy slide={slide}/><div className="s5-speed-lines" data-perform data-alpha={beat===3?1:0}>{Array.from({length:22},(_,i)=><i style={{left:100+(i*173)%1750,top:180+(i*97)%730,width:50+i%5*30}} key={i}/>)}</div></div>}
function Truth({slide,beat,staticMode,compact}:StoryProps){
 const leaves=['语法','语义','知识关联','复杂规律'];
 const checking=beat===4;
 const separated=beat===5;
 const idle=separated&&!staticMode&&!compact&&!reducedMotion;
 return <div className={`s5-truth s5-truth-${beat}`}>
  <img className="s5-art s5-chamber" src={appUrl("/assets/art/p5/obsidian-computing-chamber-v3.png")} alt="黑曜机房与鎏金线路" data-perform data-alpha={checking?.54:separated?.3:beat===6?.47:.82} data-duration={1.1} data-enter-y={0} data-enter-scale={1}/>
  <div className="s5-context-core" data-perform data-scale={beat>=4?.64:1} data-x={beat>=4?250:0} data-alpha={separated?.12:1}><Core rotation={beat===2?22:beat===3?45:beat>=4?65:0}/></div>
  <svg className="s5-network" viewBox="0 0 1920 1080" data-perform data-alpha={checking?.15:beat>=2&&beat<5?1:0}>{leaves.map((_,i)=><path key={i} d={`M${330+i*365} 790Q${510+i*270} 530 1340 430`}/>)}</svg>
  <div className="s5-word-leaves">{leaves.map((t,i)=><div key={t} style={{left:200+i*405,top:745}} data-perform data-alpha={checking?.35:beat>=2&&beat<5?1:0} data-y={beat===3?-90:0} data-scale={beat>=4?.68:1} data-delay={i*.1}>{t}</div>)}</div>
  <div className="s5-output" data-perform data-alpha={beat===1?1:0} data-y={beat===1?0:90}><span>疯狂星期四……</span><strong>V我50</strong></div>
  <div className="s5-truth-rails" data-perform data-alpha={checking||separated?1:0} data-y={separated?-160:0} data-duration={1.06}>
    <div data-perform data-x={separated?-160:0} data-duration={1.06}><strong>流畅</strong><i/></div>
    <b className={idle?'s5-truth-sign-breathe':undefined} data-perform data-alpha={separated?1:0} data-scale={separated?1:.62} data-delay={separated?.32:0} data-duration={.64}>≠</b>
    <div data-perform data-x={separated?160:0} data-duration={1.06}><strong>正确</strong><i/></div>
  </div>
  <svg className="s5-fact-crack" viewBox="0 0 1920 1080" data-perform data-alpha={checking?1:0} data-scale={separated?.44:1} data-duration={.85}><path d="M990 190L1030 310L980 420L1040 530L970 680L1005 890"/></svg>
  <div className="s5-copy s5-truth-question" data-perform data-alpha={checking?1:0} data-y={checking?0:separated?-28:24} data-duration={.7} aria-hidden={!checking}><p>{slideById('P5-12').content[0]}</p></div>
  {beat!==1&&!checking&&!separated&&<Copy slide={slide} lines={beat===2?[slide.content[0]]:undefined}/>}
 </div>;
}
function Time({slide,beat,compact,staticMode,spectator}:StoryProps){return <div className={'s5-time'+(beat===1?' s5-time-demo':'')}><img className="s5-art" src={appUrl("/assets/art/p5/pages/P5-16.webp")} alt="计算与时间的层次插画"/><div className="s5-time-core" data-perform data-x={beat>1?600:0} data-scale={beat>1?.6:1} data-alpha={beat>1?0:1} data-duration={1.5}><Core rotation={beat===1?85:beat>1?120:0}/></div><div className="s5-task-stack">{Array.from({length:5},(_,i)=><div key={i} data-perform data-x={beat===0?0:beat===1?400:720} data-y={beat===0?i*65:beat===1?130:170} data-scale={beat===0?1:beat===1?.5:.15} data-alpha={beat>1?0:1} data-rotate={beat===0?-6+i*3:0} data-delay={i*.12}><i/><i/><i/></div>)}</div><div className="s5-freed-band" data-perform data-y={beat>1?0:74} data-alpha={beat>1?1:0} data-duration={1.2}><div className="s5-scroll-reveal"><img src={appUrl("/assets/art/p5/freed-time-scroll-v3.png")} alt="展开的留白计时卷轴"/>{beat===3&&<strong data-perform data-enter-y={-44} data-enter-scale={1.13} data-delay={.29} data-duration={.7}>{slide.content[1]}</strong>}</div></div>{beat===1&&<figure className="s5-ai-wiring"><div className="s5-ai-screen"><StageFilm src={appUrl('/assets/video/ai-wiring-lab.mp4')} poster={appUrl('/assets/img/supplement/ai-wiring-poster.webp')} compact={compact} controls={!staticMode&&!spectator} muted={spectator}/></div><figcaption>电力电子实验课 · AI 洞洞板布线规划实录</figcaption></figure>}<Copy slide={slide} lines={beat===1?['如果有一天，','越来越多的事情，','可以在 AI 辅助下','迅速完成……']:beat===3?[slide.content[0]]:undefined}/></div>}
export function Story5(props:StoryProps){return props.scene.id==='ti-machine'?<Machine {...props}/>:props.scene.id==='ti-context-truth'?<Truth {...props}/>:<Time {...props}/>}
