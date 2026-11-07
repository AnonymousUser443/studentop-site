import gsap from 'gsap';
import { storyFor } from '../production/story/registry';
import { storyTimeline } from '../production/story/perform';
import { addSceneImpacts, addStageImpact } from './stage-impact';
import { animate34Exit } from '../production/story/Story34';
import { audio } from './audio';
import { reducedMotion, type Slide } from './deck';
import { designFor } from '../production/design';
export interface SceneClock { t:number }
export type ClockCanvas=HTMLCanvasElement&{sceneClock?:SceneClock};
const EASE={enter:'power3.out',soft:'power2.out',exit:'power2.in',ritual:'power2.inOut',stamp:'back.out(1.4)',breathe:'sine.inOut'};
function elements(root:HTMLElement,selector:string){return gsap.utils.toArray<HTMLElement>(root.querySelectorAll(selector))}
/** The five entry materials. Every tween belongs to the page root timeline. */
export const entry={
 reveal(tl:gsap.core.Timeline,nodes:HTMLElement[],at=0,duration=.72){tl.from(nodes,{yPercent:105,duration,ease:EASE.enter,stagger:Math.min(.09,.8/Math.max(1,nodes.length))},at)},
 depth(tl:gsap.core.Timeline,nodes:HTMLElement[],at=0,duration=.6){tl.from(nodes,{y:28,scale:.972,filter:'blur(6px)',opacity:0,duration,ease:EASE.enter,stagger:.07},at)},
 ink(tl:gsap.core.Timeline,nodes:HTMLElement[],at=0,duration=1.1){tl.from(nodes,{filter:'blur(12px)',clipPath:'inset(0 100% 0 0)',duration,ease:EASE.soft,stagger:.14},at)},
 gather(tl:gsap.core.Timeline,nodes:HTMLElement[],at=0,duration=2.4){tl.from(nodes,{x:i=>Math.cos(i*.87)*1100,y:i=>Math.sin(i*.87)*750,rotation:i=>i%2?24:-28,filter:'blur(5px)',duration,ease:'power2.out',stagger:.06},at)},
 photo(tl:gsap.core.Timeline,nodes:HTMLElement[],at=0,duration=1.1){tl.from(nodes,{filter:'blur(10px) brightness(.5)',clipPath:'inset(0 100% 0 0)',duration,ease:EASE.soft,stagger:.12},at)},
};
function productionEntry(tl: gsap.core.Timeline, root: HTMLElement, slide: Slide) {
 const {motion, refinement} = designFor(slide);
 const duration = refinement?.duration;
 const stagger = refinement?.stagger;
 const art = elements(root, 'img[data-production-art]');
 const words = elements(root, '[data-production-text]');
 const figures = elements(root, '[data-production-figure]');
 if (motion==='still') return;
 if (motion==='unfurl') { if (art.length) tl.from(art,{clipPath:'inset(0 0 0 100%)',duration:duration??1.2,ease:EASE.ritual},0); if(words.length) entry.ink(tl,words,.2,.76); }
 if (motion==='rise' && words.length) tl.from(words,{y:44,opacity:0,duration:duration??.7,stagger:stagger??.075,ease:EASE.enter},0);
 if (motion==='stagger' && words.length) tl.from(words,{y:28,scale:.972,filter:'blur(6px)',opacity:0,duration:duration??.56,stagger:stagger??.07,ease:EASE.enter},0);
 if (motion==='focus') { if (art.length) tl.from(art,{filter:'blur(12px)',duration:duration??.82},0); if(words.length) tl.from(words,{opacity:0,duration:duration??.75,stagger:stagger??.12},.12); }
 if (motion==='line' && words.length) tl.from(words,{opacity:0,x:-37,clipPath:'inset(0 100% 0 0)',duration:duration??.74,stagger:stagger??.13},0);
 if (motion==='glow') { if (art.length) tl.from(art,{filter:'brightness(.38)',duration:duration??1.6,ease:EASE.ritual},0); if(words.length) tl.from(words,{opacity:0,duration:.8,stagger:stagger??.1},.34); }
 if (motion==='orbit' && art.length) tl.from(art,{scale:1.072,rotation:-1.45,transformOrigin:'60% 62%',duration:duration??1.45,ease:EASE.soft},0);
 if (motion==='pulse' && words.length) tl.from(words,{opacity:0,scale:.965,duration:duration??.76,stagger:stagger??.07},0);
 if (figures.length) tl.from(figures,{y:slide.chapter===1?54:20,opacity:0,duration:slide.chapter===1?1.15:1.8,ease:EASE.soft},.28);
}
export function pageTimeline(root:HTMLElement,slide:Slide,onReady:()=>void,previousId?:string){if(storyFor(slide.id))return storyTimeline(root,slide,onReady,previousId);const tl=gsap.timeline({paused:true});if(reducedMotion){audio.cue(slide.id,slide.chapter);onReady();return tl}const chapter=slide.chapter;const opening=slide.id.endsWith('-01');const ending=!!root.querySelector('[data-stamp]');let readyAt=slide.type==='HERO'?.9:1.2;const reveals=elements(root,'[data-reveal]'),details=elements(root,'[data-detail]'),depth=elements(root,'[data-depth]'),photos=elements(root,'[data-photo]'),ink=elements(root,'[data-ink]'),lines=elements(root,'[data-line]');const breath=chapter===8?1.4:1;
 const { refinement, motion } = designFor(slide);
 const pace = refinement?.duration ? gsap.utils.clamp(.55, 1.65, refinement.duration) : 1;
 productionEntry(tl,root,slide);
 // Chapter light is the source of the composition, not a colored background.
 if(opening){const headings=elements(root,'[data-chapter-title]');if(headings.length)tl.from(headings,{clipPath:'inset(50% 0 50% 0)',scaleY:1.06,duration:.88*breath,ease:EASE.ritual},.58);if(details.length)entry.depth(tl,details,.64,.35);tl.call(()=>audio.cue(slide.id,chapter),[],.32);tl.call(()=>audio.play(chapter===8?'match':'light-on'),[],.4);readyAt=2.25*breath}
 else if(motion!=='still'){if(reveals.length)entry.reveal(tl,reveals,0,(slide.type==='STACK'?.32:.64)*breath*pace);if(depth.length)entry.depth(tl,depth,.1,(slide.type==='GRID'?.32:.6)*breath*pace);if(photos.length)entry.photo(tl,photos,0,1.1*breath*pace);if(ink.length)entry.ink(tl,ink,.1,1.1*breath*pace);if(details.length)entry.reveal(tl,details,.2,.32*pace);tl.call(()=>audio.play('paper-slide'),[],0)}
 if(lines.length)tl.from(lines,{scaleX:0,duration:.7,ease:EASE.ritual,stagger:.06},opening?1.2:.2);
 elements(root,'[data-draw]').forEach((node)=>{const path=node as unknown as SVGGeometryElement;if(typeof path.getTotalLength==='function'){const len=path.getTotalLength();tl.fromTo(node,{strokeDasharray:len,strokeDashoffset:len},{strokeDashoffset:0,duration:1.2,ease:EASE.ritual},.15)}});
 if(ending){const nodes=elements(root,'[data-stamp]');tl.from(nodes,{x:42,y:38,scale:1.35,opacity:0,duration:.26,ease:'power4.in'},.1);tl.to(nodes,{scale:.94,duration:.08,ease:'power4.in'},.36);tl.to(nodes,{scale:1,duration:.24,ease:EASE.stamp},.44);tl.from(elements(root,'.seal text'),{filter:'blur(8px)',duration:.3},.7);addStageImpact(tl,root,.36);readyAt=1.4}
 addSceneImpacts(tl,root);
 if(slide.id==='P0-01')readyAt=2.6;
 if(slide.id==='P4-04'){root.querySelectorAll<HTMLElement>('[data-number]').forEach((node,i)=>{const n={value:0};const end=Number(node.dataset.number);tl.to(n,{value:end,duration:1.8,ease:EASE.soft,onUpdate:()=>{node.textContent=Math.round(n.value).toString()}},i*.1)});tl.call(()=>audio.play('light-on'),[],0);readyAt=2.1}
 if(slide.id==='P2-03'){tl.to(elements(root,'.curriculum-left'),{x:-40,rotationY:-8,opacity:.3,duration:1,ease:EASE.ritual},.9);tl.to(elements(root,'.curriculum-right'),{x:40,rotationY:8,opacity:.3,duration:1,ease:EASE.ritual},.9);tl.from(elements(root,'[data-curriculum-light]'),{scaleX:0,opacity:0,duration:1.4},.4);tl.call(()=>audio.play('tear'),[],.3);readyAt=2.4}
 if(slide.id==='P2-07'){tl.fromTo(elements(root,'[data-tear-crack]'),{strokeDasharray:1300,strokeDashoffset:1300},{strokeDashoffset:0,duration:.5,ease:'none'},.4);tl.to(elements(root,'[data-tear-left]'),{x:-1300,rotation:-5,duration:1.3,ease:'power2.inOut'},.9);tl.to(elements(root,'[data-tear-right]'),{x:950,rotation:7,duration:1.3,ease:'power2.inOut'},.9);tl.to(elements(root,'[data-tear-before]'),{filter:'blur(9px)',opacity:0,y:30,duration:.5},.9);tl.from(elements(root,'[data-swallow]'),{x:-800,y:40,duration:.6,ease:EASE.ritual},1.8);tl.call(()=>audio.play('tear'),[],.4);tl.call(()=>audio.play('shatter'),[],.9);tl.call(()=>audio.play('guqin-open'),[],1.4);readyAt=3.2}
 if(slide.id==='P2-09'){readyAt=3;tl.call(()=>audio.play('guqin-open'),[],.6)}
 if(slide.id==='P4-14'){const fault=elements(root,'[data-glitch]');tl.to(fault,{x:5,duration:.03,repeat:3,yoyo:true},1);tl.call(()=>audio.play('shatter'),[],1);readyAt=1.3}
 if(slide.id==='P6-17'){tl.fromTo(elements(root,'[data-door]'),{rotationY:0},{rotationY:-85,duration:.6,ease:'power2.in'},.8);tl.to(elements(root,'[data-door]'),{rotationY:-55,duration:.16,ease:EASE.soft},1.4);tl.to(elements(root,'[data-door-frame]'),{x:4,duration:.05,yoyo:true,repeat:3},1.4);tl.call(()=>audio.play('bonk'),[],1.4);readyAt=1.8}
 if(slide.id==='P7-11')readyAt=1.8;
 if(slide.id==='P8-05'||slide.id==='P7-14')readyAt=3;
 if(slide.id==='P8-08'){tl.from(elements(root,'.lantern'),{clipPath:'inset(100% 0 0 0)',duration:2.4,ease:EASE.soft},.6);tl.call(()=>audio.play('match'),[],.6);readyAt=3}
 if(slide.id==='P8-12'){tl.call(()=>audio.play('chime'),[],.8);readyAt=2.4}
 if(slide.id==='P8-16'){entry.gather(tl,elements(root,'[data-collect]'),0,2.4);chaptersSealSounds(tl);readyAt=5}
 if(slide.id==='P0-16')tl.from(elements(root,'.ring-node'),{opacity:0,scale:.8,duration:.42,stagger:.095,ease:EASE.soft},.25);
 if(slide.id==='P0-18')tl.to(elements(root,'.ring-node:not(.active)'),{x:(_i,node)=>320-parseFloat(node.style.left),y:(_i,node)=>320-parseFloat(node.style.top),opacity:0,duration:.68,stagger:.035,ease:EASE.ritual},.25);
 if(slide.id==='P8-19'){tl.to(elements(root,'.finale-memory'),{scale:0,duration:1.5,ease:EASE.soft},0);tl.fromTo(elements(root,'.finale-dot'),{opacity:0},{opacity:1,duration:.16},1.5);tl.to(elements(root,'.finale-dot'),{opacity:0,duration:.74},1.66);tl.fromTo(elements(root,'.finale-wish'),{opacity:0,y:16},{opacity:1,y:0,duration:.6,ease:EASE.soft},1.8);tl.to(elements(root,'.finale-wish'),{opacity:0,duration:.55},4.4);tl.from(elements(root,'.finale'),{clipPath:'inset(0 100% 0 0)',filter:'blur(20px)',duration:1.7,ease:EASE.soft},4.8);readyAt=6.5}
 if(!opening)tl.call(()=>audio.cue(slide.id,chapter),[],0);
 // Queue readiness follows the last finite entry, including every stagger.
 readyAt=Math.max(readyAt,tl.duration());
 // The missing club film is replaced by six real images. Only this photo playback crossfades.
 if(slide.id==='P2-13'){const frames=elements(root,'[data-reel-frame]');readyAt=1.2;frames.forEach((node,i)=>{tl.fromTo(node.querySelector('img'),{scale:1.06,y:0},{scale:1.14,y:-20,duration:4,ease:'none'},i*4);if(i>0){tl.to(node,{opacity:1,duration:1.2,ease:'none'},i*4-1.2);tl.to(frames[i-1],{opacity:0,duration:1.2,ease:'none'},i*4-1.2)}})}
 // A slow canvas clock is owned by this same root. Readiness excludes ambient loops.
 root.querySelectorAll<ClockCanvas>('canvas.peak-canvas').forEach(canvas=>{if(canvas.sceneClock)tl.to(canvas.sceneClock,{t:1200,duration:1200,ease:'none'},0)});
 if(slide.id==='P7-11')tl.to(elements(root,'[data-stream]'),{y:-680,duration:i=>1.4+(i%4)*.4,repeat:-1,ease:'none',stagger:.013},readyAt);
 tl.call(onReady,[],readyAt);return tl;
}
function chaptersSealSounds(tl:gsap.core.Timeline){for(let i=0;i<8;i++)tl.call(()=>audio.play('seal-stamp',1+i*.015),[],2.4+i*.06);tl.call(()=>audio.play('chime'),[],3)}
export type TransitionKind='blackout'|'ink'|'sweep'|'dissolve'|'cut';
export function transitionKind(from: Slide, to: Slide): TransitionKind {
 if (storyFor(from.id)?.id && storyFor(from.id)?.id === storyFor(to.id)?.id) return 'cut';
 if (from.chapter !== to.chapter && [2,4,5].includes(to.chapter)) return 'blackout';
 if (from.chapter !== to.chapter || to.id === 'P0-18' || to.id === 'P8-16') return 'ink';
 const {motion} = designFor(to);
 if (motion === 'still') return 'cut';
 if (motion === 'line' || to.chapter === 4 && motion === 'pulse') return 'sweep';
 if (motion === 'focus' || motion === 'glow' || to.chapter === 8) return 'dissolve';
 return 'ink';
}
export function transitionTimeline(host:HTMLElement,from:Slide,to:Slide,swap:()=>void){const kind=transitionKind(from,to);const tl=gsap.timeline({paused:true});const shade=host.querySelector('.transition-shade'),ink=host.querySelector('.transition-ink'),sweep=host.querySelector('.transition-sweep'),body=host.querySelector('.slide-body');host.dataset.transition=kind;if(reducedMotion){tl.call(swap,[],.001);return tl}
 if(kind==='cut'){const lead=animate34Exit(tl,host,from,to);tl.call(swap,[],Math.max(.001,lead));return tl}
 if(kind==='blackout'){tl.set(shade,{backgroundColor:'#07090a'},0);tl.to(body,{y:24,filter:'blur(8px)',duration:.32,ease:EASE.exit},0);tl.set(shade,{autoAlpha:1},.32);tl.call(()=>audio.silence(),[],.32);tl.call(swap,[],1.52);tl.to(shade,{autoAlpha:0,duration:.4,ease:EASE.soft},1.62)}
 else if(kind==='dissolve'){const design=designFor(to);tl.set(shade,{backgroundColor:design.tone==='paper'?design.palette.paper:design.palette.shade},0);tl.to(shade,{autoAlpha:1,duration:.27,ease:EASE.soft},0);tl.call(swap,[],.27);tl.to(shade,{autoAlpha:0,duration:.43,ease:EASE.ritual},.29)}
 else if(kind==='sweep'){tl.set(sweep,{autoAlpha:1,x:0},0);tl.to(sweep,{x:2440,duration:.38,ease:'power4.in'},0);tl.to(body,{filter:'blur(5px)',duration:.18},0);tl.call(()=>audio.play('paper-whip'),[],.1);tl.call(swap,[],.24);tl.set(sweep,{autoAlpha:0,x:0},.4)}
 else {tl.set(ink,{visibility:'visible'},0);tl.fromTo(ink,{y:1400},{y:0,duration:.48,ease:'power2.in'},0);tl.to(body,{filter:'blur(6px)',y:18,duration:.32,ease:EASE.exit},0);tl.call(swap,[],.48);tl.to(ink,{y:-1400,duration:.5,ease:EASE.soft},.54);tl.set(ink,{visibility:'hidden',y:1400},1.04)}
 const withExit=gsap.timeline({paused:true});
 const lead=animate34Exit(withExit,host,from,to);
 return lead>0?withExit.add(tl.paused(false),lead):tl;
}
