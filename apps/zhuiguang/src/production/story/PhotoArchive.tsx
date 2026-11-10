import type gsap from 'gsap';
import './photo-archive.css';

export interface ArchivePhoto {
  src: string;
  caption: string;
  description: string;
  left: number;
  top: number;
  width: number;
}

export function PhotoArchive({ photos, tone = 'paper', animate = true }: {
  photos: readonly ArchivePhoto[];
  tone?: 'paper' | 'night';
  animate?: boolean;
}) {
  return <div className={`photo-archive photo-archive-${tone}`} data-photo-archive={animate ? '' : undefined}>
    <div className="photo-archive-dimmer" aria-hidden="true" />
    {photos.map(photo => <figure
      className="photo-archive-card"
      key={photo.src}
      style={{ left: photo.left, top: photo.top, width: photo.width }}
    >
      <div className="photo-archive-frame"><img src={photo.src} alt={photo.description} loading="eager" /></div>
      <figcaption>{photo.caption}</figcaption>
    </figure>)}
  </div>;
}

/** Keep the original photo in one frame from the stage focus to the archive slot. */
export function animatePhotoArchive(timeline: gsap.core.Timeline, root: HTMLElement) {
  const archive = root.querySelector<HTMLElement>('[data-photo-archive]');
  if (!archive) return;
  const dimmer = archive.querySelector('.photo-archive-dimmer');
  const cards = [...archive.querySelectorAll<HTMLElement>('.photo-archive-card')];
  const lift = .26;
  const hold = 1.32;
  const travel = .61;
  const gap = .16;
  const largeWidth = 1040;
  timeline.set(cards, { autoAlpha: 0 }, 0);
  cards.forEach((card, index) => {
    const start = .36 + index * (lift + hold + travel + gap);
    const returnAt = start + lift + hold;
    const width = card.offsetWidth;
    timeline.set(card, {
      zIndex: 3,
      x: 960 - card.offsetLeft - width / 2,
      y: 99 - card.offsetTop,
      scale: largeWidth / width,
    }, start);
    timeline.to(dimmer, { opacity: .74, duration: lift }, start);
    timeline.to(card, { autoAlpha: 1, duration: lift, ease: 'power2.out' }, start);
    timeline.to(card, { x: 0, y: 0, scale: 1, duration: travel, ease: 'power3.inOut' }, returnAt);
    timeline.to(dimmer, { opacity: index === cards.length - 1 ? 0 : .16, duration: travel }, returnAt);
    timeline.set(card, { zIndex: 1 }, returnAt + travel);
  });
}
