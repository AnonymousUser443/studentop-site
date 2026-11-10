import { appUrl } from "../core/url";
import type { Slide } from '../core/deck';

type Layout = 'cover' | 'quote' | 'stack' | 'split' | 'media' | 'data' | 'process' | 'interactive' | 'chapter-map' | 'coda' | 'custom';
export type Motion = 'unfurl' | 'rise' | 'stagger' | 'focus' | 'line' | 'glow' | 'orbit' | 'pulse' | 'still';
export interface PageDesign {
  layout: Layout;
  tone: 'paper' | 'shade' | 'scene';
  motion: Motion;
  intent: string;
  side?: 'left' | 'right' | 'center';
  art?: string;
  reuseReason?: string;
  refinement?: {
    typeSize?: number;
    vertical?: 'upper' | 'middle' | 'lower';
    artPosition?: 'left' | 'right' | 'full' | 'bottom';
    artStrength?: number;
    duration?: number;
    stagger?: number;
  };
  focal?: string;
  media?: { src: string; alt: string }[];
}
interface ChapterDesign {
  chapter: number;
  motif: string;
  palette: { paper: string; ink: string; accent: string; shade: string };
  art?: string;
  pages: Record<string, PageDesign>;
}

const files = import.meta.glob<ChapterDesign>('./chapters/p*.json', { eager: true, import: 'default' });
export const designs = new Map(Object.values(files).map((chapter) => [chapter.chapter, chapter]));
const approved = appUrl('/assets/art/approved/');
const fallbackArt: Record<number, string> = {
  0: `${approved}prologue-concept.jpg`, 1: `${approved}fe-open-screens.webp`,
  6: `${approved}ne-lake.webp`, 8: `${approved}fi-inner-echo.webp`,
};

export function designFor(slide: Slide) {
  const chapter = designs.get(slide.chapter);
  const fallback: PageDesign = {
    layout: slide.id.endsWith('-01') ? 'cover' : slide.type === 'STACK' ? 'stack' : 'quote',
    tone: slide.id.endsWith('-01') ? 'scene' : 'paper', motion: 'rise', intent: '',
  };
  const page = chapter?.pages[slide.id] ?? fallback;
  const art = page.art ? appUrl(page.art) : slide.id.endsWith('-01') ? (chapter?.art ? appUrl(chapter.art) : fallbackArt[slide.chapter]) : undefined;
  return {
    ...page,
    art,
    media: page.media?.map(medium => ({ ...medium, src: appUrl(medium.src) })),
    palette: chapter?.palette ?? { paper: '#f4e9d2', ink: '#183d35', accent: '#986628', shade: '#19453c' },
  };
}
