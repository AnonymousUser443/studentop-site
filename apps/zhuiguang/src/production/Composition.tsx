import { appUrl } from "../core/url";
import type { CSSProperties, ReactNode } from 'react';
import { chapterById, type Slide } from '../core/deck';
import { designFor } from './design';

const titles = ['序章', '第一章', '第二章', '第三章', '第四章', '第五章', '第六章', '第七章', '第八章'];

export function productionStyle(slide: Slide): CSSProperties {
  const { palette, refinement } = designFor(slide);
  return {
    '--prod-paper': palette.paper, '--prod-ink': palette.ink, '--prod-accent': palette.accent,
    '--prod-shade': palette.shade, '--ch': palette.accent,
    ...(refinement?.artStrength !== undefined ? { '--page-art-strength': refinement.artStrength } : {}),
  } as CSSProperties;
}

export function ArtLayers({ slide }: { slide: Slide }) {
  const design = designFor(slide);
  const cover = slide.id.endsWith('-01');
  const position = design.refinement?.artPosition ?? (cover ? 'full' : design.side === 'right' ? 'left' : design.side === 'center' ? 'bottom' : 'right');
  return <div className="prod-art" data-art-position={position} aria-hidden="true">
    {design.art && <img className="prod-art-image" src={design.art} alt="" data-production-art loading="eager" />}
    {!cover && !['P7-14','P8-19'].includes(slide.id) && <img className="prod-current" src={appUrl('/assets/art/approved/gold-current.png')} alt="" />}
    <div className="prod-paper-fibre" />
  </div>;
}

export function ProductionCover({ slide }: { slide: Slide }) {
  const chapter = chapterById(slide.chapter);
  const isFe = slide.id === 'P1-01';
  const isFi = slide.id === 'P8-01';
  const side = isFi ? 'right' : designFor(slide).side ?? 'left';
  const name = slide.chapter === 0 ? '追光者' : chapter.name;
  const intro = isFe ? slide.content[3] || '有时候，我们只需要先迈出一步。' : isFi ? '你还愿意为什么事情，\n认真地付出自己的时间？' : slide.chapter === 0 ? '睿信之星 · 追光者演讲' : chapter.subtitle;
  return <div className={`prod-cover cover-${side} cover-p${slide.chapter}`}>
    {(isFe || isFi) && <img className="prod-companion" src={appUrl(`/assets/art/approved/${isFe ? 'lanyan-hug' : 'lanyan-listen'}.png`)} alt={isFe ? '蓝砚张开双臂' : '蓝砚闭眼合十'} data-production-figure />}
    <div className="prod-cover-copy">
      <div className="prod-cover-kicker" data-detail>追光者 <i/> {titles[slide.chapter]}</div>
      {slide.chapter > 0 && <div className="prod-cover-code" data-detail>{chapter.code} <small>／ {String(slide.chapter).padStart(2, '0')}</small></div>}
      <h1 data-chapter-title>{name}</h1>
      <p data-detail>{intro}</p>
      {slide.chapter===0&&<span className="prod-cover-date mono" data-detail>{slide.content[2]}</span>}
    </div>
  </div>;
}

function emphasized(text: string, focal?: string): ReactNode {
  if (!focal || focal === text || !text.includes(focal)) return focal === text ? <em>{text}</em> : text;
  const start = text.indexOf(focal);
  return <>{text.slice(0, start)}<em>{focal}</em>{text.slice(start + focal.length)}</>;
}

export function Composition({ slide }: { slide: Slide }) {
  const design = designFor(slide);
  const chapter = chapterById(slide.chapter);
  const blocks = slide.content.filter((text) => text.trim());
  const lines = blocks.length ? blocks : [slide.title];
  const chars = Math.max(...lines.flatMap((s) => s.split('\n')).map((s) => s.length));
  const compact = chars >= 28 || lines.length > 4;
  const label = design.layout === 'coda' ? chapter.name : undefined;
  return <div className={`prod-composition layout-${design.layout} align-${design.side || 'left'} ${compact ? 'has-dense-copy' : ''}`} data-vertical={design.refinement?.vertical ?? 'middle'}>
    {label && <span className="prod-overline" data-detail>{chapter.code} · {label}</span>}
    <div className="prod-copy" style={design.refinement?.typeSize ? {fontSize: design.refinement.typeSize} : undefined}>
      {lines.map((line, index) => <div className="prod-block" key={index} data-production-text>
        {(design.layout === 'process' || design.layout === 'data') && lines.length > 1 && <span className="prod-step">{String(index + 1).padStart(2, '0')}</span>}
        <div>{emphasized(line, design.focal)}</div>
      </div>)}
    </div>
    <div className="prod-rule" data-line />
  </div>;
}
