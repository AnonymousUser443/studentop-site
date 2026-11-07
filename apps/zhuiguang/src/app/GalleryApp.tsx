import { appUrl } from "../core/url";
import { useState } from 'react';
import { chapterById, chapters, deck } from '../core/deck';
import { SlideView } from '../components/SlideView';
import { Stage } from '../components/Stage';

const sheetSize = 12;
export default function GalleryApp() {
  const params = new URLSearchParams(location.search);
  const proof = params.get('proof') === '1';
  const totalSheets = Math.ceil(deck.length / sheetSize);
  const sheet = Math.max(0, Math.min(totalSheets - 1, Number(params.get('sheet')) || 0));
  const [chapter, setChapter] = useState(-1);
  const [selected, setSelected] = useState<string | null>(null);
  const slides = proof ? deck.slice(sheet * sheetSize, (sheet + 1) * sheetSize) : deck.filter((slide) => chapter === -1 || slide.chapter === chapter);
  const open = selected ? deck.find((slide) => slide.id === selected) : undefined;

  return <div className={`gallery-app ${proof ? 'proof-sheet' : ''}`}>
    <header><div><span className="eyebrow">睿信之星 · 2026</span><h1>追光者</h1><p>全片画册 <span className="mono">{proof ? `${sheet + 1} / ${totalSheets}` : `${slides.length} 页`}</span></p></div><a className="text-link" href="/?rehearsal=1">进入排练 ↗</a></header>
    {!proof && <nav><button className={chapter === -1 ? 'active' : ''} onClick={() => setChapter(-1)}>全部篇章</button>{chapters.map((entry) => <button key={entry.id} className={chapter === entry.id ? 'active' : ''} onClick={() => setChapter(entry.id)}>{entry.code} {entry.name}</button>)}</nav>}
    <main>{slides.map((slide) => <article key={slide.id}><button className="gallery-frame" onClick={() => setSelected(slide.id)} aria-label={`查看 ${slide.id}`}><Stage><SlideView slide={slide} staticMode compact/></Stage></button><div className="gallery-frame-caption"><a className="mono" href={appUrl(`/?preview=${slide.id}&clean=1`)}>{slide.id}</a><span>{slide.title}</span><small>{slide.layer}</small></div></article>)}</main>
    {open && <div className="gallery-lightbox" onClick={() => setSelected(null)}><Stage><SlideView slide={open} staticMode/></Stage><button className="gallery-close" aria-label="关闭预览">×</button><a className="lightbox-caption mono" href={appUrl(`/?preview=${open.id}&clean=1`)} onClick={(event) => event.stopPropagation()}>{open.id} / {chapterById(open.chapter).name} · 查看动效 ↗</a></div>}
  </div>;
}
