import rawDeck from '../content/deck.json';
import rawChapters from '../content/chapters.json';
export { reducedMotion } from './url';
export type SlideType = 'HERO'|'STACK'|'SPLIT'|'GRID'|'FULL'|'DATA'|'CANVAS'|'INTER'|'VIDEO';
export interface Interaction { id:string; mode:'public'|'private'|'poll'|'idea'|'hands'; prompt:string; options?:string[]; seconds:number; }
export interface Slide { id:string; chapter:number; type:SlideType; layer:'MAIN'|'FLEX'|'HOLD'; dur:number; title:string; content:string[]; note:string; speakerNotes:string; motion:string; audio:string[]; peak:boolean; interaction?:Interaction; }
export interface Chapter { id:number; code:string; name:string; subtitle:string; accent:string; }
export const deck = rawDeck as Slide[];
export const chapters = rawChapters as Chapter[];
export const slideById = (id:string) => deck.find(s => s.id===id) ?? deck[1];
export const chapterById = (id:number) => chapters.find(c => c.id===id) ?? chapters[0];
export const chapterSlides = (id:number) => deck.filter(s => s.chapter===id);
export const params = new URLSearchParams(location.search);
