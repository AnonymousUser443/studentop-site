import { StageFilm } from './StageFilm';
import { appUrl } from "../core/url";
import { useEffect, useState } from 'react';
import { chapters, chapterById, slideById, type Slide } from '../core/deck';
import type { LiveMessage, PollResults, SyncState } from '../core/sync';
import { Seal } from './Seal';
import { ChapterRing } from './ChapterRing';
import { SpecificSlide } from './SpecificSlides';
import PeakCanvas from '../scenes/PeakCanvas';
import { ArtLayers, Composition, ProductionCover, productionStyle } from '../production/Composition';
import { designFor } from '../production/design';
import { TiScene } from '../production/TiScene';
import { storyFor } from '../production/story/registry';
import { StoryView } from '../production/story/StoryView';
import { Review34PollArt } from '../production/story/Story34';

export interface SlideViewProps { slide:Slide; compact?:boolean; staticMode?:boolean; messages?:LiveMessage[]; results?:PollResults; state?:SyncState; audienceUrl?:string; spectator?:boolean }
const img=(chapter:number,name:string)=>appUrl(`/assets/img/p${chapter}/${name}.webp`);
const photoPages:Record<string,string[]>={
 'P1-11':Array.from({length:5},(_,i)=>img(1,`siyuan-0${i+1}`)),
 'P2-05':[img(2,'circuit'),img(2,'code')], 'P2-08':[img(2,'hanfu-02')],
 'P2-10':[img(2,'frost-ui-01')], 'P2-11':[img(2,'frost-ui-02')],
 'P2-13':[...Array.from({length:4},(_,i)=>img(2,`hanfu-0${i+1}`)),img(2,'frost-ui-01'),img(2,'frost-ui-02')],
 'P3-05':[img(3,'edian-group'),img(3,'edian-04'),img(3,'edian-06')],
 'P3-09':[img(3,'lab-805-ui')],
 'P6-13':[img(6,'liyun-01')], 'P6-14':Array.from({length:4},(_,i)=>img(6,`liyun-0${i+1}`)),
 'P8-10':Array.from({length:5},(_,i)=>img(8,`dengweiwang-0${i+1}`)),
};
export function Photo({src,className='',alt='现场记录'}:{src:string;className?:string;alt?:string}){return <figure className={`photo ${className}`} data-photo><img src={src} alt={alt} loading="eager"/><span className="photo-toning"/></figure>}
export function PaperLayers(){return <><div className="vignette"/><div className="paper-grain" aria-hidden="true"/></>}
export function Mountains({className=''}:{className?:string}){return <svg className={`mountains ${className}`} viewBox="0 0 1920 1080" fill="none" aria-hidden="true">{[
 'M-160 740Q70 710 250 560T550 540Q760 300 990 480T1300 400Q1540 200 1770 390L2090 480V1080H-160Z',
 'M-160 800Q80 600 320 700T650 580Q780 440 1040 600T1440 550Q1680 430 2090 650V1080H-160Z',
 'M-160 900Q100 740 300 800T720 700Q940 680 1100 810T1510 700Q1760 610 2090 790V1080H-160Z',
 'M-160 1080Q120 920 480 980T1000 870Q1300 800 1530 940T2090 950V1080Z'].map((d,i)=><path key={i} d={d} fill={['#95a39d','#6e7d77','#2c3833','#161e1b'][i]} opacity={[.055,.07,.14,.6][i]} data-mountain/>)}<path d="M120 820H1800" stroke="#c9a961" opacity=".16"/><circle cx="960" cy="870" r="3" fill="#c2412e"/></svg>}
export function Lantern({className=''}:{className?:string}){return <div className={`lantern ${className}`} data-depth><div className="lantern-light"/><svg viewBox="0 0 240 360" aria-hidden="true"><path d="M120 0V45M72 55H168M72 280H168M95 292H145M120 292V348" stroke="currentColor" strokeWidth="2" fill="none"/><ellipse cx="120" cy="168" rx="78" ry="110" stroke="currentColor" strokeWidth="1.5" fill="none"/><ellipse cx="120" cy="168" rx="40" ry="110" stroke="currentColor" opacity=".45" fill="none"/><path d="M120 58V278M45 147H195M44 189H196" stroke="currentColor" opacity=".3" fill="none"/></svg></div>}
function Header({slide}:{slide:Slide}){const c=chapterById(slide.chapter);return <div className="slide-label eyebrow" data-detail><span>{slide.chapter?`${c.code} / ${c.name}`:'追光者 / PROLOGUE'}</span><i/><span>{slide.id}</span></div>}
function Lines({lines,className='',size}:{lines:string[];className?:string;size?:number}){return <div className={`text-lines ${className}`} style={size?{fontSize:size}:undefined}>{lines.flatMap((l)=>l.split('\n')).map((l,i)=><div className="reveal-line" key={i}><span data-reveal>{l||'\u00a0'}</span></div>)}</div>}
function useSeconds(deadline?:number){const [now,setNow]=useState(Date.now());useEffect(()=>{if(!deadline)return;const id=window.setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(id)},[deadline]);return deadline?Math.max(0,Math.ceil((deadline-now)/1000)):null}
function Countdown({deadline,seconds=60}:{deadline?:number;seconds?:number}){const n=useSeconds(deadline);const pct=n===null?1:Math.min(1,n/seconds);return <div className="countdown"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="32" className="track"/><circle cx="40" cy="40" r="32" pathLength="1" strokeDasharray="1" strokeDashoffset={1-pct}/></svg><span className="mono">{n===null?'—':String(n).padStart(2,'0')}<small>SEC</small></span></div>}
function InteractionScene({slide,state,messages=[],results={}}:SlideViewProps){const it=slide.interaction!;const data=results[it.id]||{total:0,counts:[]};const letters='ABCDE';if(it.mode==='hands')return <div className="hero-copy"><Lines lines={['准备保研的同学，','举手示意。']} size={88}/></div>;
 return <><div className="interaction-heading"><span className="eyebrow">{it.mode==='private'?'A LETTER / 只给讲者':it.mode==='idea'?'LET YOUR IDEAS GROW':'YOUR VOICE / 在场的你'}</span><Lines lines={it.prompt.split('\n')} size={it.prompt.length>32?46:56}/>{it.mode==='private'&&<p>这些话不会出现在大屏上。</p>}</div>
 {it.mode==='private'?<div className="private-envelope" data-depth><svg viewBox="0 0 600 360"><path d="M20 40H580V330H20ZM20 40L300 220L580 40M20 330L220 165M580 330L380 165" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg><div className="private-count"><span className="eyebrow">已写下</span><strong className="mono">{state?.privateCount||0}</strong><span>封 · 只交给此刻</span></div></div>:
 it.mode==='poll'?<div className={`poll-options count-${it.options?.length}`}>{it.options?.map((option,i)=>{const percent=data.total?Math.round((data.counts[i]||0)/data.total*100):0;return <div className="poll-option" key={option} data-depth><b className="mono">{letters[i]}</b><span>{option}</span><em className="mono">{percent}<small>%</small></em><div className="poll-track"><i style={{width:`${percent}%`}}/></div></div>})}<div className="poll-total eyebrow">{data.total} 人 · 已选择</div></div>:
 it.mode==='idea'?<div className="idea-elements"><span data-depth>北湖</span><i>×</i><span data-depth>传感器</span><i>×</i><span data-depth>古诗词</span><p>一句话就行，越离谱越好。</p></div>:<div className="interaction-pool"><div className="pool-surface"/>{messages.filter(m=>m.interactionId===it.id&&!m.hidden).slice(-3).map((m,i)=><div className="water-message" key={m.id} style={{left:60+i*280,top:80+i*45}}>{m.emoji} {m.text}</div>)}<span className="pool-caption eyebrow">{messages.filter(m=>m.interactionId===it.id&&!m.hidden).length} 束声音 · 正在汇入</span></div>}
 <div className="interaction-join direct-interaction"><div><span className="eyebrow">{state?.interaction?.id===it.id&&state.interaction.open?'互动已开启':'现场互动'}</span><p>请在观众端参与</p><Countdown deadline={state?.interaction?.id===it.id?state.interaction.deadline:undefined} seconds={it.seconds}/></div></div></>}
function SealEnding({slide}:{slide:Slide}){const c=chapterById(slide.chapter);return <><div className="chapter-closing"><span className="eyebrow">{c.code} / 一重光</span><div className="closing-title" data-reveal>{c.name}</div><div className="gold-line" data-line/></div><div className="chapter-seal" data-stamp><Seal text={c.name} chapter={c.id} size={230} opacity={c.id===7?.55:1}/></div></>}
function RankScene(){return <div className="rank-scene"><span className="eyebrow" data-detail>同样一个人 · 两种评价</span><div className="rank-values"><div><strong className="mono" data-number="13">13</strong><span>专业排名</span></div><i data-line/><div><strong className="mono gold-text" data-number="7">7</strong><span>综合测评</span></div></div><p data-detail>数字能记录一部分努力。<br/>衡量的尺度，也值得被看见。</p></div>}
function SevenArts(){return <div className="seven-arts"><div className="eyebrow">霜降雅集 / 七艺</div><div className="arts-row">{'诗乐画书茶花香'.split('').map((s,i)=><div key={s} style={{top:[0,-8,4,-12,6,-4,10][i]}}><span data-ink>{s}</span><Seal text={s} size={32} chapter={i+1}/></div>)}</div><p data-detail>围绕诗、乐、画、书、茶、花、香，<br/>七个不同的文化主题展开。</p></div>}
function EightSeals(){return <div className="eight-seals">{chapters.filter(c=>c.id>0).map((c,i)=>{const a=(-90+i*45)*Math.PI/180;return <div className="collected-seal" data-collect key={c.id} style={{left:960+Math.cos(a)*320-48,top:540+Math.sin(a)*320-48}}><Seal chapter={c.id} text={c.name} size={96}/></div>})}<div className="seal-heart" data-ink>让今天的每一次认真生活，<br/>都成为未来某一天<br/>值得回望的光。</div></div>}
function Finale({slide, quiet}:{slide:Slide; quiet:boolean}){return <>{!quiet&&<><div className="finale-memory"><EightSeals/></div><p className="finale-wish">{slide.content[1]}</p><div className="finale-dot"/></>}<div className="finale"><h1 className="gold-text">{slide.content[0]}</h1></div></>}
function ImpressionPond({slide,messages=[]}:Pick<SlideViewProps,'slide'|'messages'>){
 const harvest=slide.id==='P0-10';
 const visible=messages.filter((message)=>message.interactionId==='initial-impression'&&!message.hidden);
 const notes=visible.slice(-3).map((message)=>message.text);
 const cards=notes.length?notes:harvest?slide.content:[];
 return <div className={`impression-pond ${harvest?'pond-harvest':'pond-listening'}`}>
   {!harvest&&<div className="pond-line"><Lines lines={slide.content} size={76}/></div>}
   <div className="pond-impressions">{cards.map((text,i)=><div className="pond-card" key={i} data-depth><span className="eyebrow">0{i+1}</span><p>{text}</p></div>)}</div>
   {visible.length>0&&!harvest&&<span className="pond-tally eyebrow">{visible.length} 束声音 · 正在汇入</span>}
 </div>;
}
function ChangeScene(){return <div className="change-scene"><div className="change-half"><div className="eyebrow">自其变者而观之</div><h2 data-reveal>变者</h2><div className="change-streams">{Array.from({length:30},(_,i)=><i key={i} data-stream style={{left:`${(i*83)%850}px`,height:30+i*9,top:140+(i*43)%430,opacity:.1+i%4*.04}}/>)}</div><div className="change-words">城市 · 数据 · 工具</div></div><div className="change-half still"><div className="eyebrow">自其不变者而观之</div><h2 data-reveal>不变者</h2><div className="moon"/><Mountains/><div className="change-words">江 · 明月 · 人</div></div><div className="river-line" data-line/><p className="river-quote" data-ink>自其变者而观之，则天地曾不能以一瞬；<br/>自其不变者而观之，则物与我皆无尽也。</p></div>}
function TearScene(){return <div className="tear-scene"><div className="tear-world"><Photo src={img(2,'hanfu-01')}/><div className="tear-warmth"/><span className="tear-word" data-ink>原来，还可以。</span></div><svg viewBox="0 0 1920 1080" className="tear-shell" aria-hidden="true"><defs><linearGradient id="tear-back"><stop stopColor="#101916"/><stop offset="1" stopColor="#090e0c"/></linearGradient></defs><path data-tear-left d="M0 0H1150L1122 80L1166 150L1084 226L1138 310L1094 390L1116 480L1056 550L1100 620L1050 710L1092 806L1040 912L1078 1080H0Z" fill="url(#tear-back)"/><path data-tear-right d="M1150 0L1122 80L1166 150L1084 226L1138 310L1094 390L1116 480L1056 550L1100 620L1050 710L1092 806L1040 912L1078 1080H1920V0Z" fill="#0B0F0E"/><path data-tear-crack d="M1150 0L1122 80L1166 150L1084 226L1138 310L1094 390L1116 480L1056 550L1100 620L1050 710L1092 806L1040 912L1078 1080" stroke="#F6E4BC" strokeWidth="2" fill="none"/></svg><div className="tear-before" data-tear-before><span className="eyebrow">AUTOMATION / 日常</span><p>电路。控制。编程。</p></div><svg className="swallow" viewBox="0 0 100 50" data-swallow><path d="M2 4Q35 8 47 31Q57 13 98 2Q75 20 57 37L66 49L49 40L33 48L41 36Q20 18 2 4Z" fill="#95a39d"/></svg></div>}
function IdeaWall({messages=[]}:Pick<SlideViewProps,'messages'>){const chosen=messages.filter(m=>m.interactionId==='creative'&&!m.hidden).slice(-12);return <div className="idea-wall"><span className="eyebrow">IDEAS / 没有标准答案的星图</span>{chosen.length?chosen.map((m,i)=><div data-depth className={`idea-note ${m.selected?'selected':''}`} key={m.id} style={{left:180+(i%4)*400,top:250+Math.floor(i/4)*210,transform:`rotate(${(i%3-1)*2}deg)`}}><span>0{i+1}</span><p>{m.text}</p></div>):<div className="empty-idea"><div className="tiny-star"/><p>这里，等待一个想法落下。</p><span>北湖 × 传感器 × 古诗词</span></div>}</div>}
function Flow({slide}:{slide:Slide}){const sections=slide.content.length>1?slide.content:slide.content[0]?.split(/[\/／]/)||[];return <div className="flow-scene"><span className="eyebrow">{slide.title}</span><div className="flow-nodes">{sections.slice(0,5).map((t,i)=><div key={i} data-depth><b className="mono">0{i+1}</b><p>{t}</p>{i<sections.length-1&&<svg viewBox="0 0 180 30"><path d="M0 15H165L154 5M165 15L154 25" stroke="currentColor" fill="none" data-draw/></svg>}</div>)}</div></div>}
function PhotoReel({images}:{images:string[]}){return <div className="photo-reel">{images.map((src,i)=><div className="photo-reel-frame" data-reel-frame key={src} style={{opacity:i===0?1:0}}><Photo src={src}/><span className="reel-caption eyebrow">理韵文化协会 / 0{i+1} · 06</span></div>)}</div>}
export function SlideView(props:SlideViewProps){const {slide,compact=false,staticMode=false,spectator=false}=props;const chapter=chapterById(slide.chapter);const images=photoPages[slide.id];const opening=slide.id.endsWith('-01');const ending=slide.chapter>0&&(['P1-16','P2-18','P3-16','P4-24','P6-22','P7-15'].includes(slide.id));const content=slide.content?.filter(Boolean)||[slide.title];
 if(storyFor(slide.id))return <StoryView {...props}/>;
 const design=designFor(slide);
 let body;const specific=SpecificSlide({slide});
 if(slide.chapter===5)body=<TiScene slide={slide} quiet={staticMode||compact}/>;
 else if(specific)body=specific;
 else if(opening)body=<ProductionCover slide={slide}/>;
 else if(ending)body=<SealEnding slide={slide}/>;
 else if(slide.id==='P4-04')body=<RankScene/>;
 else if(slide.id==='P2-07')body=<TearScene/>;
 else if(slide.id==='P2-09')body=<SevenArts/>;
 else if(slide.id==='P7-11')body=<ChangeScene/>;
 else if(slide.id==='P8-16')body=<EightSeals/>;
 else if(slide.id==='P8-19')body=<Finale slide={slide} quiet={staticMode||compact}/>;
 else if(slide.id==='P0-16'||slide.id==='P0-18')body=<><div className="ring-statement"><Lines lines={content} size={92}/></div><ChapterRing large active={slide.id==='P0-18'?1:0}/><div className="ring-note eyebrow" data-detail>一盏灯 · 八重光</div></>;
 else if(slide.id==='P0-17')body=<><div className="hero-copy"><Lines lines={['接下来，我们聊聊','大学里的八个侧面。']} size={80}/></div><div className="chapter-columns">{chapters.filter(c=>c.id>0).map(c=><div key={c.id} data-depth>{c.name.split('').map(t=><span key={t}>{t}</span>)}<i style={{background:c.accent}}/></div>)}</div></>;
 else if(slide.id==='P8-08')body=design.art?<div className="prod-lamp-reveal" aria-hidden="true" data-production-art/>:<Lantern className="center-lantern"/>;
 else if(slide.id==='P7-14')body=design.art?null:<div className="one-light"><i/></div>;
 else if(slide.id==='P6-07')body=<IdeaWall messages={props.messages}/>;
 else if(slide.interaction&&slide.id!=='P0-09'&&slide.id!=='P0-10')body=<InteractionScene {...props}/>;
 else if(slide.id==='P0-09'||slide.id==='P0-10')body=<ImpressionPond slide={slide} messages={props.messages}/>;
 else if(slide.id==='P1-07')body=<div className="video-scene"><StageFilm src={appUrl("/assets/video/genshin-campus.mp4")} poster={appUrl("/assets/img/p1/campus-film-poster.webp")} compact={compact} controls={!spectator} muted={spectator}/><img className="prod-media-frame" src={appUrl("/assets/art/approved/media-frame-16x9.png")} alt=""/><div className="video-caption eyebrow">思源实践 / 校园宣传</div></div>;
 else if(images){if(slide.id==='P2-13')body=<PhotoReel images={images}/>;
 else if(slide.id==='P8-10')body=<div className="comic-strip">{images.map((src,i)=><div key={src}><Photo src={src} alt={`《灯未完》画面 ${i+1}`}/><span className="eyebrow">0{i+1} / 05</span></div>)}</div>;
 else if(slide.id==='P1-11')body=<div className="photo-tale"><Photo src={images[0]} className="tale-main"/><Photo src={images[1]} className="tale-secondary"/>{images.slice(2).map((src,i)=><Photo src={src} key={src} className={`tale-small-${i+2}`}/>)}<div className="tale-caption" data-depth><span className="eyebrow">思源 / 把帮助继续传下去</span><h2>从被照亮，<br/>到成为一束光。</h2></div></div>;
 else if(slide.id==='P6-14')body=<div className="liyun-details"><div className="liyun-details-copy"><h2 data-production-text>{content[0]}</h2><p data-production-text>{content[1]}</p></div><div className="photo-gallery gallery-4">{images.map((src,i)=><div key={src}><Photo src={src} alt={`《理韵寻踪》项目界面 ${i+1}`}/><span className="eyebrow">0{i+1} / 04</span></div>)}</div></div>;
 else if(slide.id==='P3-05')body=<div className="photo-gallery gallery-3">{images.map((src,i)=><div key={src}><Photo src={src} alt={['全国大学生电子设计竞赛合照','比赛工作现场','小车电路调试'][i]}/><span className="eyebrow">0{i+1} / 共同完成</span></div>)}</div>;
 else if(slide.id==='P2-05')body=<div className="paired-photos">{images.map(src=><Photo src={src} key={src}/>)}<p>电路　·　控制　·　编程</p><span className="eyebrow">自动化专业的日常</span></div>;
 else if(slide.id==='P2-08'||slide.id==='P2-11'||slide.id==='P3-09')body=<div className="photo-split"><Photo src={images[0]}/><div><span className="eyebrow">{chapter.code} / {chapter.name}</span><Lines lines={slide.id==='P2-08'?['理韵','文化协会']:content} size={slide.id==='P2-08'?72:42}/>{slide.id==='P2-08'&&<p>一个让我觉得<br/>非常有意思的地方。</p>}</div></div>;
 else body=<div className={`photo-full ${slide.id==='P2-13'?'photo-playback':''}`}><Photo src={images[0]}/><div className="photo-full-caption"><span className="eyebrow">{chapter.name} / 真实的片刻</span>{slide.id==='P6-13'&&<h2 data-reveal>《理韵寻踪》</h2>}</div></div>}
 else if(slide.id==='P3-11'||slide.id==='P4-13'||slide.id==='P4-16')body=<Flow slide={slide}/>;
 else if(design.media?.length)body=<div className={`prod-media-story ${design.media.length===1?'single-medium':''}`}><div className="prod-media-items">{design.media.map(({src,alt})=><Photo src={src} alt={alt} key={src}/>)}</div><div className="prod-media-copy">{content.map((line,index)=><p key={index} data-production-text>{line}</p>)}</div></div>;
 else if(slide.type==='GRID')body=<div className={`content-grid cards-${content.length}`}>{content.map((t,i)=><div className="content-card" data-depth key={i}><span className="eyebrow mono">0{i+1}</span><Lines lines={[t]} size={t.length>40?30:40}/><div className="gold-line" data-line/></div>)}</div>;
 else if(slide.id==='P6-05')body=<div className="three-elements">{['北湖','传感器','古诗词'].map((s,i)=><div key={s} data-ink style={{top:[350,250,420][i]}}><span>0{i+1}</span><h2>{s}</h2></div>)}</div>;
 else if(slide.id==='P7-06'||slide.id==='P7-10')body=<div className={`text-split ${slide.id==='P7-10'?'poem':''}`}>{(slide.id==='P7-10'?['盖将自其变者而观之，\n则天地曾不能以一瞬。','自其不变者而观之，\n则物与我皆无尽也。']:['风景画创新实践课\n我一个学自动化的，\n跑去学画画。','一位从事艺术研究的学长\n他居然在用 AI 编程工具\n开发课程教学系统。']).map((t,i)=><Lines key={i} lines={[t]} size={slide.id==='P7-10'?52:38}/>)}</div>;
 else body=<Composition slide={slide}/>;
 const focusedArt = ['P8-08','P8-09','P8-12','P8-14'].includes(slide.id);
 const lightText = slide.chapter===5 || focusedArt || (opening && [0,7,8].includes(slide.chapter));
 return <section className={`slide production-slide ${opening?'production-cover':''} ${focusedArt?'production-focused-art':''} slide-${slide.id.toLowerCase()} type-${slide.type.toLowerCase()} chapter-${slide.chapter} ${compact?'compact':''} ${staticMode?'static-mode':''}`} data-page-id={slide.id} data-tone={design.tone} data-side={design.side||'left'} data-layout={design.layout} data-scene-ink={lightText?'light':'dark'} style={productionStyle(slide)}>
   <ArtLayers slide={slide}/>
   {!staticMode&&!compact&&['P0-09','P1-05','P8-14','P8-16'].includes(slide.id)&&<PeakCanvas pageId={slide.id} messages={props.messages}/>}
   {!['P0-01','P0-02','P7-14','P8-08','P8-19'].includes(slide.id)&&!opening&&!ending&&slide.chapter!==5&&<Header slide={slide}/>}
   <div className="slide-body">{body}<Review34PollArt slide={slide}/></div><PaperLayers/>
 </section>;
}
export function LoadingPaper({progress=0,status='正在铺展纸面',failed=0}:{progress?:number;status?:string;failed?:number}){
 const slide=slideById('P0-01');
 return <div className="loading-paper production-slide production-cover production-prelude" data-scene-ink="light" style={productionStyle(slide)}>
   <StoryView slide={slide} staticMode/>
   <div className="loading-progress"><div className="loading-track" role="progressbar" aria-label={status} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><i style={{transform:`scaleX(${progress/100})`}}/></div><span className="mono">{status} · {Math.round(progress)}%{failed?` · ${failed} 项待重试`:''}</span></div>
 </div>;
}
