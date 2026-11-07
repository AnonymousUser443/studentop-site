import gsap from 'gsap';
import { audio } from '../../core/audio';
import { addSceneImpacts } from '../../core/stage-impact';
import { reducedMotion, type Slide } from '../../core/deck';
import { animate34 } from './Story34';
import { animate678 } from './Story678';
import { animatePhotoArchive } from './PhotoArchive';

function n(node: HTMLElement, name: string, fallback: number) {
  const value = node.getAttribute(`data-${name}`);
  return value === null || !Number.isFinite(Number(value)) ? fallback : Number(value);
}
export function targetFor(node: HTMLElement) {
  return { x: n(node,'x',0), y: n(node,'y',0), rotation: n(node,'rotate',0), scale: n(node,'scale',1), opacity: n(node,'alpha',1), filter: `blur(${n(node,'blur',0)}px)` };
}
export function settleScene(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[data-perform]').forEach(node => gsap.set(node, targetFor(node)));
}
/** A scene's objects persist; only new objects receive an entrance. Backward jumps restore exact states. */
export function storyTimeline(root: HTMLElement, slide: Slide, onReady: () => void, previousId?: string) {
  const tl = gsap.timeline({paused:true});
  if (reducedMotion) { settleScene(root); audio.cue(slide.id,slide.chapter); onReady(); return tl; }
  const actors = root.querySelectorAll<HTMLElement>('[data-perform]');
  actors.forEach(node => {
    const target = targetFor(node);
    if (node.dataset.performed !== 'yes') {
      gsap.set(node, slide.id==='P0-01' ? target : { ...target, x: target.x + n(node,'enter-x',0), y: target.y + n(node,'enter-y',34), scale: target.scale * n(node,'enter-scale',.97), opacity:0 });
      node.dataset.performed='yes';
    }
    tl.to(node, {...target, duration:n(node,'duration',.95), delay:n(node,'delay',0), ease:'power3.inOut', overwrite:'auto'},0);
  });
  const copy = root.querySelectorAll('[data-story-copy]');
  const copyAt = slide.id==='P0-02' && previousId==='P0-01' ? .79 : .12;
  if (copy.length) tl.fromTo(copy,{opacity:0,y:20},{opacity:1,y:0,duration:.55,stagger:.055,ease:'power2.out'},copyAt);
  const shutter = root.querySelector('[data-film-shutter]');
  if (shutter) tl.fromTo(shutter, { scaleX: 1, opacity: 1 }, { scaleX: 0, opacity: 0, duration: .72, ease: 'power3.inOut' }, 0);
  if (slide.id==='P5-04' && previousId==='P5-03') {
    tl.fromTo(root.querySelectorAll('.s5-circuit path'), {strokeDasharray:1,strokeDashoffset:1}, {strokeDashoffset:0,duration:.8,stagger:.15,ease:'power2.out',clearProps:'strokeDasharray,strokeDashoffset'},.17);
  }
  if (slide.id==='P5-05' && previousId==='P5-04') {
    tl.fromTo(root.querySelectorAll('.s5-speed-lines i'),{x:-90,opacity:0},{x:240,opacity:.9,stagger:{amount:.34,from:'random'},duration:.47,ease:'power2.in'},.16);
    tl.to(root.querySelectorAll('.s5-speed-lines i'),{opacity:.38,duration:.32},.89);
  }
  if (slide.id==='P5-17' && previousId==='P5-16') {
    tl.fromTo(root.querySelectorAll('.s5-scroll-reveal'),{clipPath:'inset(0 99% 0 0)'},{clipPath:'inset(0 0% 0 0)',duration:1.28,ease:'power3.inOut',clearProps:'clipPath'},.18);
  }
  if (slide.chapter===4) animate34(tl, root, slide, previousId);
  if (slide.chapter>=6) animate678(tl, root, slide, previousId);
  if (slide.id==='P0-06') tl.call(()=>audio.play('paper-whip'),[],.25);
  addSceneImpacts(tl, root);
  tl.call(()=>audio.cue(slide.id,slide.chapter),[],0);
  animatePhotoArchive(tl, root);
  tl.call(onReady,[],Math.max(.75,tl.duration()));
  return tl;
}
