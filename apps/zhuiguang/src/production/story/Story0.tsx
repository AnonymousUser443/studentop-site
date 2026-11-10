import { appUrl } from "../../core/url";
import { chapters, slideById, type Slide } from '../../core/deck';
import type { StoryProps } from './types';
import './story0.css';
const covers: Record<number,string> = {"1":appUrl("/assets/art/approved/fe-open-screens.webp"),"2":appUrl("/assets/art/p2/cover.webp"),"3":appUrl("/assets/art/p3/cover.webp"),"4":appUrl("/assets/art/p4/cover.webp"),"5":appUrl("/assets/art/p5/pages/P5-01.webp"),"6":appUrl("/assets/art/approved/ne-lake.webp"),"7":appUrl("/assets/art/p7/overlook-at-dawn.webp"),"8":appUrl("/assets/art/approved/fi-inner-echo.webp")};
const world=appUrl('/assets/art/p0/opening-campus-world-v2.png');
function Copy({slide,className=''}:{slide:Slide;className?:string}){return <div key={slide.id} className={`s0-copy ${className}`} data-story-copy>{slide.content.filter(Boolean).map((t,i)=><p key={i}>{t}</p>)}</div>}
const impressionArt = ['lake', 'activities', 'overwork'];
const lanternCenter = { x: 1160, y: 525 };
function Unfold({slide,beat}:StoryProps){return <div className="s0-unfold">
 <img className="s0-world" src={world} alt="实验室、社团集市、骑行与朋友交谈组成的大学世界示意" data-perform data-scale={beat?1:1.06} data-alpha={beat?1:.3} data-duration={1.7}/>
 {(["left","right"] as const).map((side,i)=><div key={side} className={"s0-curtain s0-curtain-"+side} data-perform data-x={beat?(i?1190:-1230):0} data-y={beat?-24:0} data-duration={1.6} data-enter-y={0}><img src={appUrl("/assets/art/p0/stage-drape-v3.png")} alt=""/></div>)}
 <div className="s0-opening-title" data-perform data-y={beat?-80:0} data-scale={beat?.8:1} data-alpha={beat?0:1}><span>睿信之星 · 追光者演讲</span><h1>追光者</h1><p>2026.11</p></div>
 <div className="s0-welcome-lanyan" data-perform data-x={beat?0:-95} data-y={beat?0:110} data-enter-x={-75} data-alpha={beat?1:0} data-delay={beat?.16:0} data-duration={1.43}>
  <img src={appUrl("/assets/art/p0/lanyan-open-curtain-v3.png")} alt="蓝砚伸手拉开帷幕，邀请大家看向校园"/>
 </div>
 {beat===1&&<Copy slide={slide}/>}
 </div>}
const metrics=[
 {label:'绩点？',src:appUrl('/assets/art/p0/metric-ledger-v3.png'),x:775,y:145,from:[-520,-320],to:[-880,360],rotate:-6},
 {label:'综测？',src:appUrl('/assets/art/p0/metric-ruler-v3.png'),x:1280,y:204,from:[530,-460],to:[710,280],rotate:7},
 {label:'奖学金？',src:appUrl('/assets/art/p0/metric-ribbon-v3.png'),x:820,y:550,from:[-400,520],to:[-700,450],rotate:-6},
 {label:'还是……未来？',src:appUrl('/assets/art/p0/metric-crossroads-v3.png'),x:1305,y:520,from:[540,450],to:[680,420],rotate:5},
];
function Metrics({slide,beat}:StoryProps){return <div className={"s0-metrics s0-metrics-"+beat}>
 <img className="s0-table-art" src={appUrl("/assets/art/p0/opening-question-table-v2.png")} alt="评价与未来问题的桌面插画" data-perform data-alpha={[.63,.25,.31,.12][beat]} data-x={beat===3?260:0}/>
 <div className="s0-table-light"/>
 {metrics.map(({label,src,x,y,from,to,rotate},i)=><div key={label} className={"s0-metric-object s0-metric-"+i} style={{left:x,top:y}} data-perform data-x={beat===0?from[0]:beat===3?to[0]:0} data-y={beat===0?from[1]:beat===3?to[1]:beat===2?-18:0} data-enter-x={from[0]*.45} data-enter-y={from[1]*.45} data-scale={beat===0?.6:beat===2?1.07:beat===3?.65:1} data-rotate={beat===3?(i%2?34:-35):rotate} data-alpha={beat===0||beat===3?0:1} data-duration={beat===3?1.2:1.02} data-delay={i*.11}>
  <img src={src} alt=""/>
  <strong>{label}</strong>
 </div>)}
 {beat!==1&&<Copy slide={slide}/>}{beat===1&&<div className="s0-metric-question" data-story-copy>今天，聊些什么？</div>}
 </div>}
function Campus(props:StoryProps){const {slide,beat,messages=[],state}=props;const published=messages.filter(m=>m.interactionId==='initial-impression'&&!m.hidden);const selected=published.filter(m=>m.selected);const shown=(selected.length?selected:published).slice(-6);return <div className={`s0-campus s0-campus-${beat}`}>
 <img className="s0-world" src={world} alt="同一校园里的多种生活示意" data-perform data-x={[0,-35,10,45,80,-120][beat]} data-y={[0,-15,15,25,20,-65][beat]} data-scale={[1,1.07,1.11,1.08,1.12,1.16][beat]} data-alpha={[1,.7,.56,.39,.58,.26][beat]} data-duration={1.5}/>
 <div className="s0-campus-copy-wash" data-perform data-alpha={beat<2||beat===4?1:0}/>
 {beat===0||beat===4?<Copy slide={slide}/>:beat===1?<><Copy slide={slide}/><div className="s0-join-cue" data-story-copy><b>{state?.interaction?.open ? '现场留言已开启' : '请在观众端参与'}</b><span>在当前页面写一句话即可。</span></div></>:beat===2?<Copy slide={slide} className="s0-voices-head"/>:null}
 <div className="s0-campus-notes">{shown.map((m,i)=><div className="s0-campus-note" key={m.id} style={{left:850+(i%2)*475,top:232+Math.floor(i/2)*204}} data-perform data-x={beat===4?75:0} data-y={beat===4?-20:0} data-alpha={beat===1||beat===2?1:0} data-enter-y={90} data-delay={i*.06}><span>{m.emoji||'◌'}</span><p>{m.text}</p></div>)}</div>
 {beat===2&&<span className="s0-live-count">{published.length} 束声音 · 正在汇入</span>}
 {beat===3&&<div className="s0-review-impressions">
    <p className="s0-impressions-title" data-story-copy>校园印象</p>
    {slide.content.map((label,index)=><figure key={label} className={'s0-impression s0-impression-'+index}
      data-perform data-enter-y={-190} data-enter-scale={1.17} data-delay={.10+index*.35} data-duration={.43}
      data-review-impact="label" data-impact-delay={.53+index*.35}>
      <img src={appUrl(`/assets/art/p0/review-lanyan-${impressionArt[index]}.png`)} alt="" />
      <figcaption>{label}</figcaption>
    </figure>)}
  </div>}
 {beat===4&&<img className="s0-review-perspectives" src={appUrl("/assets/art/p0/review-lanyan-perspectives.png")}
  alt="蓝砚举起两个取景框，同一处校门，一个映出北湖，一个映出社团活动"
  data-perform data-enter-x={120} data-enter-y={25} data-duration={1.05} />}
 <div className="s0-perspective-layer" aria-hidden={beat!==5} data-perform data-alpha={beat===5?1:0} data-y={beat===5?0:60} data-duration={1.35}><img src={appUrl("/assets/art/p0/campus-four-perspectives-v3.png")} alt="校园里交谈的朋友、自习的学生、社团市集和新生入校连在同一条路上"/><div className="s0-perspective-captions" data-story-copy>{['朋友','压力','丰富','适应'].map((tag,i)=><div key={tag} data-perform data-alpha={beat===5?1:0} data-y={beat===5?0:60} data-delay={beat===5?.18+i*.14:0}><h2>{tag}</h2><p>{beat===5?slide.content[i]?.replace('，','，\n').replace('享受丰富','享受\n丰富').replace('适应从','适应\n从'):''}</p></div>)}</div></div>
 </div>}
const photoDetails = slideById('P0-14').content.map(line=>line.split('\n').slice(1).join('\n').split(' · '));
function Exploration({slide,beat}:StoryProps){const pics=[appUrl('/assets/img/p3/edian-group.webp'),appUrl('/assets/img/p2/hanfu-02.webp'),appUrl('/assets/img/p1/siyuan-01.webp')];const cats=['科研竞赛','社团组织','认识的人'];return <div className={"s0-exploration s0-exploration-"+beat}><img className="s0-exploration-art" src={appUrl("/assets/art/p0/exploration-sketchbook-v3.png")} alt="摊开的探索册，真实照片将铺在册页上" data-perform data-scale={beat===0?1.04:beat===2?1.09:1} data-duration={1.4}/><svg className="s0-explore-trail" viewBox="0 0 1920 1080"><path d="M290 790C475 818 630 740 805 785S1140 828 1365 733S1570 680 1650 605"/></svg>
 {pics.map((src,i)=><figure className={`s0-explore-photo s0-explore-photo-${i}`} key={src} data-perform data-x={beat===0?150:beat===2?[-135,155,112][i]:0} data-y={beat===0?180:beat===2?[195,250,195][i]:0} data-rotate={beat===2?(i-1)*16:(i-1)*-6} data-scale={beat===0?.8:beat===2?.72:1} data-alpha={beat===0?.13:beat===2?.76:1} data-delay={i*.12}><img src={src} alt={`${cats[i]}的真实活动记录`}/><figcaption><b>{cats[i]}</b><p data-perform data-alpha={beat===1?1:0} data-duration={.36}>{photoDetails[i]?.map((item,k)=><span key={item}>{k>0?' · ':''}{item}</span>)}</p></figcaption></figure>)}
 {beat!==1&&<Copy slide={slide}/>}<div className="s0-explore-dot" data-perform data-x={beat===0?0:beat===1?530:1360} data-y={beat===0?0:beat===1?-10:-184} data-duration={1.6}/>
 <div className="s0-unwritten-answer" data-perform data-alpha={beat===2?1:0} data-scale={beat===2?1:.6}><span>？</span></div>
 </div>}
function Eight({slide,beat}:StoryProps){return <div className="s0-eight"><div className="s0-eight-light" data-perform data-x={beat===1?-170:beat===2?105:0} data-y={beat===1?85:0} data-scale={beat===2?1.35:1}/><svg className="s0-eight-thread" viewBox="0 0 1920 1080" aria-hidden="true"><g data-perform data-alpha={beat===0?.65:0}>{Array.from({length:8},(_,i)=>{const angle=(-90+i*45)*Math.PI/180;return <path key={i} d={`M${lanternCenter.x} ${lanternCenter.y} L${lanternCenter.x+Math.cos(angle)*270} ${lanternCenter.y+Math.sin(angle)*270}`}/>})}</g><path d="M150 738 Q960 596 1770 738" data-perform data-alpha={beat===1?.86:0}/><path d="M550 414 C720 505 845 571 1120 565" data-perform data-alpha={beat===2?.68:0}/></svg><Copy slide={slide}/><div className="s0-eight-orbit">{chapters.filter(c=>c.id>0).map((c,i)=>{const a=(-90+i*45)*Math.PI/180;const x=Math.cos(a)*340,y=Math.sin(a)*340;return <div className="s0-chapter-lamp" key={c.id} data-perform data-x={beat===0?x:beat===1?(i-3.5)*205-200:i===0?120:x*.34+120} data-y={beat===0?y:beat===1?160:i===0?60:y*.34+40} data-scale={beat===2?(i===0?2.2:.4):beat===1?.86:1} data-alpha={beat===2?(i===0?1:0):1} data-delay={beat===0?i*.085:0} data-duration={1.25} data-enter-x={-x*.6} data-enter-y={-y*.6}><div className="s0-lamp-window"><img src={covers[c.id]} alt=""/><span>{c.code}</span></div><img className="s0-lamp-shell" src={appUrl("/assets/art/p0/eight-lamp-frame-v3.png")} alt=""/><strong>{c.name}</strong></div>})}</div><div className="s0-eight-center" style={{left:lanternCenter.x,top:lanternCenter.y}} data-perform data-alpha={beat===0?1:0} data-scale={beat===0?1:.86}>
  <div className="s0-light-breath"><i/>{[0,1,2].map(i=><span className="s0-light-ripple" key={i} style={{animationDelay:`${i*1.35}s`}}/>)}{Array.from({length:8},(_,i)=><span className="s0-light-mote" key={i} style={{rotate:`${i*45+18}deg`,animationDelay:`${1.8+(i%4)*.11}s`}}/>)}</div><b>八重光</b>
 </div></div>}
export function Story0(props:StoryProps){switch(props.scene.id){case'opening-unfold':return <Unfold {...props}/>;case'opening-metrics':return <Metrics {...props}/>;case'opening-campus':return <Campus {...props}/>;case'opening-exploration':return <Exploration {...props}/>;case'opening-eight':return <Eight {...props}/>;default:return null}}
