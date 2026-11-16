import { memo, useLayoutEffect, useRef, type CSSProperties } from 'react';
import { motion, useIsPresent } from 'framer-motion';
import { fretTiming, glyphTiming, paperEdge, scrollPart } from './motion';
import './scroll-dialog.css';

const fretStyle = (delay: number, frame = false) => {
  const timing = fretTiming(delay, frame);
  return { '--fret-in': `${timing.enter}s`, '--fret-duration': `${timing.enterDuration}s`, '--fret-out': `${timing.exit}s` } as CSSProperties;
};
const frameStyle = fretStyle(.14, true);
const corners = ['tl', 'tr', 'bl', 'br'].map((position, index) => ({ position, style: fretStyle(.18 + index * .035) }));

export const ScrollFurniture = memo(function ScrollFurniture({ reduced, framed = true }: { reduced: boolean; framed?: boolean }) {
  const edge = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const surface = edge.current?.closest<HTMLElement>('.scroll-surface');
    if (!surface || reduced) return;
    // Commit the rolled style before starting the shared ink transition. CSS
    // reverses from the currently painted values if the sheet closes early.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => { surface.dataset.letterReady = 'true'; });
    });
    return () => { cancelAnimationFrame(frame); delete surface.dataset.letterReady; };
  }, [reduced]);
  return <>
    {framed && <div className="letter-fretwork" data-draw={!reduced || undefined} aria-hidden="true">
      <svg className="letter-fret-outline" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d="M .5 .5 H 99.5 V 99.5 H .5 Z" vectorEffect="non-scaling-stroke" pathLength="1" strokeDasharray="1 1" style={frameStyle} />
      </svg>
      {corners.map(({ position, style }) => <svg key={position} className={`letter-fret-corner letter-fret-${position}`} viewBox="0 0 28 28">
        <path d="M3 18V7H15V3H22V11H11V18H18V14H7V22" pathLength="1" strokeDasharray="1 1" style={style} />
      </svg>)}
    </div>}
    <motion.span ref={edge} className="scroll-paper-edge" aria-hidden="true" custom={reduced} variants={paperEdge} />
  </>;
});

const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('zh', { granularity: 'grapheme' }) : null;
const glyphs = (text: string) => segmenter ? Array.from(segmenter.segment(text), value => value.segment) : Array.from(text);

/** Full text stays intact for assistive technology; only the presentation breaks into glyphs. */
export const ScrollText = memo(function ScrollText({ text, reduced, delay = .17, limit = 22 }: { text: string; reduced: boolean; delay?: number; limit?: number }) {
  const units = glyphs(text);
  if (reduced || units.length > limit) return <motion.span className="scroll-copy-whole" custom={reduced} variants={scrollPart(delay, -4, 6)}>{text}</motion.span>;
  const spacing = Math.min(.052, .38 / Math.max(1, units.length - 1));

  return <>
    <span className="sr-only">{text}</span>
    <span className="scroll-copy-visual" aria-hidden="true">{units.map((glyph, index) => {
      if (/^\s$/u.test(glyph)) return glyph;
      const timing = glyphTiming(delay + index * spacing);
      const style = { '--glyph-in': `${timing.enter}s`, '--glyph-out': `${timing.exit}s` } as CSSProperties;
      return <span key={index} className="scroll-glyph" style={style}>{glyph}</span>;
    })}</span>
  </>;
});

export function useScrollState() {
  return useIsPresent() ? 'open' : 'closing';
}
