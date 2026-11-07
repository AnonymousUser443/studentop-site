import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import type { SlideViewProps } from '../../components/SlideView';
import { chapterById } from '../../core/deck';
import { storyFor } from './registry';
import { settleScene, targetFor } from './perform';
import { Story0 } from './Story0';
import { Story12 } from './Story12';
import { Story34 } from './Story34';
import { Story5 } from './Story5';
import { Story678 } from './Story678';
import './story.css';

export function StoryView(props: SlideViewProps) {
  const root = useRef<HTMLElement>(null);
  const scene = storyFor(props.slide.id)!;
  const beat = scene.beats.indexOf(props.slide.id);
  const c = chapterById(props.slide.chapter);
  const messageSignature=(props.messages??[]).map(m=>`${m.id}:${m.selected}:${m.hidden}`).join('|');
  const previousMessages=useRef(messageSignature);
  useLayoutEffect(()=>{if(root.current&&(props.staticMode||props.compact))settleScene(root.current)},[props.slide.id,props.staticMode,props.compact,props.messages?.length]);
  useLayoutEffect(()=>{
    if(previousMessages.current===messageSignature)return;
    previousMessages.current=messageSignature;
    if(!root.current||props.staticMode||props.compact)return;
    const newActors=[...root.current.querySelectorAll<HTMLElement>('[data-perform]:not([data-performed="yes"])')];
    newActors.forEach(node=>node.dataset.performed='yes');
    const tl=gsap.timeline();
    newActors.forEach((node,i)=>{const target=targetFor(node);tl.fromTo(node,{...target,opacity:0,y:target.y+70},{...target,duration:.85,ease:'power3.out'},i*.04)});
    return()=>{tl.kill()};
  },[messageSignature,props.staticMode,props.compact]);
  const Renderer = props.slide.chapter===0?Story0:props.slide.chapter<3?Story12:props.slide.chapter<5?Story34:props.slide.chapter===5?Story5:Story678;
  return <section ref={root} className={`slide story-stage story-chapter-${props.slide.chapter} ${props.staticMode?'story-static':''}`} data-story-scene={scene.id} data-story-beat={beat} data-page-id={props.slide.id}>
    <Renderer {...props} scene={scene} beat={beat}/>
    <div className="story-page-mark"><span>{props.slide.chapter?`${c.code} · ${c.name}`:'追光者'}</span><span>{props.slide.id}</span></div>
    <div className="story-grain" aria-hidden="true"/>
  </section>;
}
