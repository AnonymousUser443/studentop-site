import { appUrl } from "../../core/url";
import type { ReactNode } from 'react';
import type gsap from 'gsap';
import { reducedMotion, type Slide } from '../../core/deck';
import type { StoryProps } from './types';
import { PhotoArchive, type ArchivePhoto } from './PhotoArchive';
import './story34.css';

const sprite=(name:string)=>appUrl(`/assets/art/story34/${name}.png`);
const photo=(name:string)=>appUrl(`/assets/img/p3/${name}.webp`);
function Copy({slide,className=''}:{slide:Slide;className?:string}){
 return <div className={`s34-copy ${className}`} key={slide.id} data-story-copy>{slide.content.filter(Boolean).map((text,i)=><p key={i}>{text}</p>)}</div>;
}
function Frame({src,className='',children}:{src:string;className?:string;children?:ReactNode}){return <figure className={`s34-frame ${className}`}><img src={src} alt="真实项目记录" loading="eager"/>{children}</figure>}
function StoryMascot({name,description,visible,position,className}:{
 name:string;description:string;visible:boolean;position:number;className:string;
}){
 return <div className={`s34-mascot ${className}`} data-perform data-alpha={visible?1:0} data-y={visible?0:position} data-enter-y={position} data-duration={.9} aria-hidden={!visible}>
  <img src={sprite(name)} alt={description}/>
 </div>;
}
export function Review34PollArt({slide}:{slide:Slide}){
 const experience=slide.id==='P3-15';
 if(!experience&&slide.id!=='P4-23')return null;
 return <img className="s34-poll-mascot" src={sprite(experience?'si-voting-lanyan':'te-deadline-lanyan')} alt={experience?'蓝砚捧着经验索引盒，请观众选择一项':'蓝砚抱着书和闹钟，忙着安排今晚的任务'} data-production-figure/>;
}
function Memory({slide,beat}:StoryProps){
 const photos=['edian-group','edian-04','edian-06'];
 return <div className="s34-memory"><Copy slide={slide}/><div className="s34-memory-table"/><StoryMascot name="si-remembering-lanyan" description="蓝砚捧着一件藤编纪念物回想往事" className="s34-mascot-remember" visible={beat===0} position={65}/>{photos.map((name,i)=><div className={`s34-memory-photo s34-memory-photo-${i}`} key={name} data-perform data-x={beat===1?150+i*55:beat===2?30:0} data-y={beat===1?-80-i*80:beat===2?15:0} data-rotate={beat===1?14+i*7:(i-1)*9} data-alpha={beat===1?.22:beat===2?.12:1} data-blur={beat===0?0:beat===1?7:3} data-duration={1.2} data-delay={i*.12} data-enter-y={90}><Frame src={photo(name)}/></div>)}<div className="s34-memory-trace" data-perform data-alpha={beat===2?1:0} data-y={beat===2?0:40}><span>方法</span><span>协作</span><span>判断</span><svg viewBox="0 0 800 220"><path d="M35 155C160 25 200 225 370 110S600 10 760 130"/></svg></div></div>;
}
function Methods({slide,beat}:StoryProps){
 const methods=['缩小问题范围的方法','和队友重新讨论的能力','时间紧张时的优先级判断'];
 return <div className="s34-methods"><div className="s34-artifacts" data-perform data-y={beat>0?-265:0} data-scale={beat>0?.62:1} data-alpha={beat===2?.09:1} data-duration={1.05}>{[['那块电路板','si-circuit-board'],['那个奖项','si-award-medallion'],['那张证书','si-certificate-folio']].map(([t,art],i)=><figure className={`s34-artifact s34-artifact-${i}`} key={art} data-perform data-enter-y={75-i*12} data-delay={i*.11}><img src={sprite(art)} alt={`${t}的示意插画`}/><figcaption>{t}</figcaption></figure>)}</div><div className="s34-method-title" key={slide.id}>{beat===2?<Copy slide={slide}/>:null}</div><div className="s34-method-slips">{methods.map((t,i)=><div key={t} className="s34-method-slip" data-perform data-alpha={beat>0?1:0} data-y={beat>0?0:130} data-x={beat===2?(i-1)*-28:0} data-rotate={beat===2?0:(i-1)*-3} data-delay={i*.13}><b>0{i+1}</b><p>{t}</p><span className="s34-slip-notch"/></div>)}</div><div className="s34-method-baseline" data-perform data-scale={beat===2?1:0} data-alpha={beat===2?1:0}/></div>;
}
function Cabinet({highlight}:{highlight:boolean}){return <div className="s34-cabinet-art"><img src={sprite('si-archive-cabinet')} alt="三层四列的实验室元件柜示意"/><span className="s34-cabinet-highlight" data-perform data-alpha={highlight?1:0} data-scale={highlight?1:.85}><b>03</b></span></div>}
const supplement = (name: string) => appUrl('/assets/img/supplement/' + name + '.webp');

const contestPhotos: ArchivePhoto[] = [
  { src: supplement('edc-night-wide'), caption: '暴雨前夜 · 同一张实验台', description: '比赛截止前夜的实验台，放着电脑、电路板和调试工具', left: 145, top: 276, width: 522 },
  { src: supplement('edc-night-code'), caption: '电脑里的程序', description: '实验台上的电脑、正在修改的程序和手中的饮料', left: 725, top: 283, width: 440 },
  { src: supplement('edc-night-overhead'), caption: '俯看调试现场', description: '从上方俯看摆满电子零件、电脑和零食的圆桌', left: 1275, top: 287, width: 410 },
  { src: supplement('edc-night-snacks'), caption: '夜里的补给', description: '布满调试工具和电子元件的桌面上放着夜宵与饮料', left: 228, top: 731, width: 314 },
  { src: supplement('edc-night-second-desk'), caption: '程序与接线', description: '工作台前的笔记本电脑和电线', left: 744, top: 670, width: 390 },
  { src: supplement('edc-night-car'), caption: '测试台上的小车', description: '测试台上接着导线的小车原型', left: 1268, top: 650, width: 420 },
];

const labPhotos: readonly ArchivePhoto[][] = [
  [
    { src: supplement('lab-storage'), caption: '805 实验室 · 储物区', description: '805 实验室墙边的储物柜和周转箱', left: 1126, top: 205, width: 476 },
    { src: supplement('lab-instrument'), caption: '信号源面板 · 近看', description: '实验室中的信号源仪器面板', left: 1314, top: 629, width: 408 },
  ],
  [
    { src: supplement('lab-cabinet'), caption: '器材分类放入柜内', description: '示波器、仪器和配件按类摆放在储物柜里', left: 132, top: 460, width: 420 },
    { src: supplement('lab-shelves'), caption: '柜内按层归放', description: '实验室柜中分层收纳的元件、导线和器材', left: 599, top: 555, width: 342 },
  ],
  [
    { src: supplement('lab-equipment-label'), caption: '实际器材标签', description: '工具盒上贴着的 805 实验室资产标签', left: 143, top: 628, width: 432 },
  ],
];

const wiringPhotos: ArchivePhoto[] = [
  { src: supplement('wires-wide'), caption: '电力电子实验课 · 布线全景', description: '电力电子课程实验台上密集的导线和接线面板', left: 252, top: 704, width: 322 },
  { src: supplement('wires-detail'), caption: '电力电子实验课 · 走线细节', description: '放大后能看清的实验台走线和连接孔', left: 623, top: 704, width: 322 },
];

function ContestNight({slide}: StoryProps) {
 return <div className="s34-contest-night">
  <header data-story-copy><small>SI · 一次真实的电赛</small><h2>{slide.content[0]}</h2></header>
  <p className="s34-night-question" data-story-copy>{slide.content[1]}</p>
  <PhotoArchive photos={contestPhotos} tone="night"/>
 </div>;
}

function Archive({slide,beat}:StoryProps) {
 return <div className="s34-archive">
  <div className="s34-archive-screen" data-perform data-scale={beat===0?1:.58} data-x={beat===0?0:-230} data-y={beat===0?0:160} data-alpha={beat===0?1:0} data-duration={1.2}>
   <Frame src={photo('lab-805-ui')}/>
   <span>805 实验室资产管理系统 · 真实界面</span>
  </div>
  <PhotoArchive key={beat} photos={labPhotos[beat]}/>
  <div className="s34-cabinet-stage" data-perform data-alpha={beat>0?1:0} data-x={beat>0?0:200} data-scale={beat===2?1.05:.96}><Cabinet highlight={beat===2}/></div>
  <figure className="s34-drawer-art" data-perform data-alpha={beat===2?1:0} data-x={beat===2?0:-165} data-y={beat===2?0:-185} data-scale={beat===2?1:.4} data-duration={.95} data-delay={.22}>
   <img src={sprite('si-archive-drawer')} alt="盒内的电阻、电容和二极管示意"/>
   <figcaption>03 号盒 · 电阻／电容／二极管</figcaption>
  </figure>
  {beat<2?<Copy slide={slide}/>:<div className="s34-location" key={slide.id} data-story-copy>{slide.content.map((t,i)=><span key={t}><b>0{i+1}</b>{t}</span>)}</div>}
 </div>;
}

function Relay({slide,beat,compact,staticMode}:StoryProps){const breathe=beat===2&&!compact&&!staticMode&&!reducedMotion;return <div className="s34-relay"><svg className="s34-relay-road" viewBox="0 0 1920 1080"><path d="M180 340C500 340 630 630 950 620S1230 340 1710 350"/><path d="M180 750C480 750 630 630 950 620"/><path className="s34-road-next" d="M950 620C1250 620 1340 790 1780 780" data-perform data-alpha={beat>0?1:0}/></svg><div className="s34-relay-origin s34-relay-origin-a" data-perform data-alpha={beat===2?.25:1} data-x={beat===2?-48:0}><Frame src={appUrl("/assets/img/p1/siyuan-01.webp")}/><span>招生实践</span></div><div className="s34-relay-origin s34-relay-origin-b" data-perform data-alpha={beat===2?.25:1} data-x={beat===2?-48:0}><Frame src={photo('lab-805-ui')}/><span>实验室系统</span></div><div className={breathe?"s34-relay-light s34-relay-light-breathe":"s34-relay-light"} data-perform data-x={beat===0?0:beat===1?320:620} data-y={beat===0?0:beat===1?-200:120} data-scale={beat===2?.7:1} data-duration={1.4}/><div className="s34-relay-copy" key={slide.id}>{beat===0?<><div><p>{slide.content[0]}</p><p>{slide.content[1]}</p></div><h2>{slide.content[2]}</h2></>:<Copy slide={slide}/>}</div><span className="s34-new-start" data-perform data-alpha={beat===1?1:0}>新的起点</span><StoryMascot name="si-sharing-lanyan" description="蓝砚翻开经历册，思考怎么把经历变成成果" className="s34-mascot-sharing" visible={beat===2} position={110}/></div>}
function Rally({slide,beat}:StoryProps){return <div className="s34-rally"><img className="s34-rally-track" src={sprite('te-rally-startline')} alt="" data-perform data-scale={beat?1.06:1} data-y={beat?-20:0} data-duration={1.2}/><img className="s34-rally-audience" src={sprite('te-rally-audience')} alt="" data-perform data-alpha={beat?1:0} data-y={beat?0:175} data-enter-y={130} data-duration={.95}/><div className="s34-rally-copy"><Copy slide={slide}/></div></div>}
function Ruler({className=''}:{className?:string}){return <div className={`s34-ruler ${className}`}>{Array.from({length:19},(_,i)=><i key={i} style={{height:i%3===0?48:25}}/>)}</div>}
function Ranks({slide,beat}:StoryProps){return <div className="s34-ranks"><div className="s34-rank-pair" data-perform data-y={beat===2?-185:0} data-scale={beat===2?.72:1}><img className="s34-rank-stand" src={sprite('te-rank-measurement-stand')} alt=""/><div className="s34-rank-one"><strong>13</strong><p>专业排名</p><Ruler/></div><span className="s34-rank-slash">/</span><div className="s34-rank-one s34-rank-gold"><strong>7</strong><p>综合测评</p><Ruler/></div></div><div className="s34-rank-question" data-perform data-alpha={beat===1?1:0} data-y={beat===1?0:50}><Copy slide={slide}/></div><div className="s34-rank-dimensions" data-perform data-alpha={beat===2?1:0} data-y={beat===2?0:100}>{['课程学习','竞赛','社会实践','志愿服务','学生工作'].map((t,i)=><div key={t}><span>0{i+1}</span><p>{t}</p><i/></div>)}</div>{beat===0&&<p className="s34-rank-caption" data-story-copy>同样一个人 · 两种评价</p>}</div>}
function Rules({slide,beat}:StoryProps){const goals=['想申请奖学金','想参加竞赛','想争取推免'];return <div className={`s34-rules s34-rules-step-${beat}`}><div className="s34-rule-book" data-perform data-x={beat===0?0:-240} data-y={beat===0?0:80} data-scale={beat===0?1:.54} data-alpha={beat===4?0:1}><img src={sprite('te-rulebook')} alt="规则手册与直角尺示意"/></div><svg className="s34-rule-routes" viewBox="0 0 1920 1080" preserveAspectRatio="none" data-perform data-alpha={beat>0?1:0}><path d="M340 540H640Q700 540 700 350H1610"/><path d="M340 540H1610"/><path d="M340 540H640Q700 540 700 730H1610"/></svg><div className="s34-rule-goals" data-perform data-alpha={beat>0?1:0} data-y={beat===3?-80:0}>{goals.map((t,i)=><div key={t}><b>{t}</b><span>{['提前看评选办法','先看形式、时间、条件','了解课程要求与排名计算'][i]}</span></div>)}</div><div className="s34-rule-break" data-perform data-alpha={beat===2?1:0} data-y={beat===2?0:-80}><span>提前登记</span><i>!</i><span>证明材料</span></div><div className="s34-portals" data-perform data-alpha={beat===3?1:0} data-y={beat===3?0:160}>{['哔特儿\n校园墙开放平台\n微信小程序','BIT101\n课表 · 课程安排 · DDL\nbit101.cn/home','BITShare\n课程往年题\nbitshare.com.cn'].map((t,i)=><div key={t}><b>0{i+1}</b><p>{t}</p></div>)}</div><div className="s34-route-comparison" data-perform data-alpha={beat===4?1:0} aria-hidden={beat!==4}>
 <div className="s34-route-more"><span>信息不全</span><i/><small>反复补查与返工</small></div>
 <div className="s34-route-clear"><span>提前了解</span><i/><small>从条件走到行动</small></div>
 </div><StoryMascot name="te-guiding-lanyan" description="蓝砚打开路线图，指向提前了解规则的路线" className="s34-mascot-route" visible={beat===4} position={90}/><div className="s34-rules-copy" key={slide.id}>{beat===1||beat===3?null:<Copy slide={slide}/>}</div></div>}
const moduleSprites=['te-module-hardware','te-module-control','te-module-test'] as const;
function Module({name,index,failed=false}:{name:string;index:number;failed?:boolean}){return <figure className={`s34-module-actor ${failed?'s34-module-actor-failed':''}`}><img src={sprite(moduleSprites[index])} alt=""/><figcaption>{name}</figcaption>{failed&&<span className="s34-fault-badge" aria-label="连接故障">×</span>}</figure>}
function Workshop({slide,beat}:StoryProps){const names=beat===4?['传感器','控制电机','完整系统']:['硬件电路','程序控制','测试调试'];return <div className={`s34-workshop s34-workshop-${beat}`}><div className="s34-workbench-art" data-perform data-alpha={beat===0?.34:beat===2?.8:1} data-y={beat===0?72:0}><img src={sprite('te-workbench')} alt=""/></div><div className="s34-certificate" data-perform data-x={beat>0?-760:0} data-y={beat>0?185:0} data-rotate={beat>0?-18:-5} data-alpha={beat===0?1:0}><img src={sprite('si-certificate-folio')} alt="证书示意"/></div>{[0,1,2].map((i)=><div className={`s34-module-place s34-module-place-${i}`} key={i} data-perform data-x={beat===0?(i-1)*80:beat===2?(i-1)*-25:0} data-y={beat===0?160:0} data-scale={beat===0?.7:1} data-alpha={beat>0?1:0} data-rotate={beat===2?(i-1)*3:0} data-delay={i*.1}><Module name={names[i]} index={i} failed={(beat===2||beat===3)&&i===1}/></div>)}<svg className={`s34-module-wires ${beat===2||beat===3?'s34-wires-broken':''}`} viewBox="0 0 1920 1080" data-perform data-alpha={beat>0?1:0}><path d="M600 503H645Q676 503 676 525H827"/><path className="s34-link-failing" d="M1095 525H1151Q1185 525 1185 503H1320"/><path className="s34-broken-mark" d="M1140 497L1162 513L1148 527L1170 548"/></svg><div className="s34-build-steps" data-perform data-alpha={beat===4?1:0} data-y={beat===4?0:60}>{['让一个传感器读出数据','让一块开发板控制电机','把多个模块组合起来'].map(t=><p key={t}>{t}</p>)}</div><div className="s34-probe" data-perform data-alpha={beat===3?1:0} data-x={beat===3?0:-700} data-y={beat===3?0:100} data-duration={1.15}><i/><span>定位问题</span></div>{beat===3&&<PhotoArchive photos={wiringPhotos}/>}<div className="s34-workshop-copy" key={slide.id}>{beat===1?<p>把不同部分，整合成一个能够实际运行的系统。</p>:beat===4?null:<Copy slide={slide}/>}</div></div>}
function Proof({slide,beat}:StoryProps){return <div className={`s34-proof s34-proof-${beat}`}><div className="s34-proof-docs" data-perform data-x={beat===1?-25:beat===2?-100:0} data-y={beat===2?80:0} data-scale={beat===2?.85:beat===1?.94:1}><Frame src={photo('lab-805-ui')}/><Frame src={photo('edian-06')}/></div><div className="s34-proof-invitation" data-perform data-alpha={beat===0?1:0} data-x={beat===1?160:0} data-rotate={beat===1?8:0}><span>研究方向</span><span>动手项目</span><span>具体问题</span></div><div className="s34-proof-path" data-perform data-alpha={beat===2?1:0} data-y={beat===2?0:100}>{['先了解规则，','再确定目标，','最后把事情做出来。'].map((t,i)=><div key={t}><b>0{i+1}</b><strong>{t}</strong>{i<2&&<i>↓</i>}</div>)}</div><div className="s34-proof-copy">{beat<2&&<Copy slide={slide}/>}</div><StoryMascot name="te-building-lanyan" description="蓝砚把做好的小车原型托在手里" className="s34-mascot-maker" visible={beat===1} position={115}/></div>}
function Values({slide,beat}:StoryProps){return <div className="s34-values"><div className="s34-value-ruler s34-value-ruler-a" data-perform data-x={beat>0?-560:0} data-alpha={beat>0?.08:.55} data-rotate={beat>0?-18:-5}><Ruler/><span>绩点 · 排名 · 竞赛</span></div><div className="s34-value-ruler s34-value-ruler-b" data-perform data-x={beat>0?560:0} data-alpha={beat>0?.08:.55} data-rotate={beat>0?18:5}><Ruler/><span>评价体系</span></div><div className="s34-person" data-perform data-alpha={beat===0?1:.84} data-scale={beat===2?.84:1} data-y={beat===2?46:0}><img src={sprite('te-values-walker')} alt="面对下一条路的学生背影"/></div><svg className="s34-value-road" viewBox="0 0 1920 1080" data-perform data-alpha={beat===2?1:0}><path d="M960 1080V900Q960 850 1170 790M960 900Q960 850 750 790"/></svg><div className="s34-values-copy"><Copy slide={slide}/></div></div>}

export function Story34(props:StoryProps){switch(props.scene.id){
  case 'si-contest-night':return <ContestNight {...props}/>;case'si-memory':return <Memory {...props}/>;case'si-method':return <Methods {...props}/>;case'si-archive':return <Archive {...props}/>;case'si-relay':return <Relay {...props}/>;case'te-rally':return <Rally {...props}/>;case'te-rank':return <Ranks {...props}/>;case'te-rules':return <Rules {...props}/>;case'te-workshop':return <Workshop {...props}/>;case'te-proof':return <Proof {...props}/>;case'te-value':return <Values {...props}/>;default:return null;}}

/** A finite fault shake. All position targets remain owned by the shared scene animator. */
export function animate34(tl:gsap.core.Timeline,root:HTMLElement,slide:Slide,previousId?:string){
 if(slide.id==='P4-14'&&previousId!==slide.id){const node=root.querySelector('.s34-module-place-1');if(node)tl.to(node,{x:'+=7',duration:.045,repeat:5,yoyo:true,ease:'none'},.85);}
}

export function animate34Exit(tl:gsap.core.Timeline,host:HTMLElement,from:Slide,to:Slide){
 if(from.id!=='P3-08'||to.id!=='P3-09')return 0;
 const cards=host.querySelectorAll('[data-page-id="P3-08"] .s34-method-slip');
 if(!cards.length)return 0;
 tl.to(cards,{y:620,rotation:i=>(i-1)*13,duration:.52,stagger:.08,ease:'power2.in',overwrite:'auto'},0);
 return .68;
}
