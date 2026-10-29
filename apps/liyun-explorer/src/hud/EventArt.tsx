/**
 * 活动人物小像：取自四张国风插画，用于活动标签与列表缩略。
 * 长卷本体由 EventScroll.tsx 现场绘制。
 */
import boyFan from '../assets/events/boy-fan.jpg';
import boyCalligraphy from '../assets/events/boy-calligraphy.jpg';
import girlScroll from '../assets/events/girl-scroll.jpg';
import girlTea from '../assets/events/girl-tea.jpg';

export type EventArtKey = 'festival' | 'party';

type Portrait = { src: string; alt: string; focus?: string };

export type EventArt = { left: Portrait; right: Portrait };

export const EVENT_ART: Record<EventArtKey, EventArt> = {
  festival: {
    left: { src: boyCalligraphy, alt: '少年在庭中执笔', focus: '58% 18%' },
    right: { src: girlTea, alt: '少女在亭下奉茶', focus: '52% 20%' }
  },
  party: {
    left: { src: boyFan, alt: '少年立于银杏树下', focus: '58% 16%' },
    right: { src: girlScroll, alt: '少女抱着书卷', focus: '50% 18%' }
  }
};

/** 圆形小像。 */
export function EventThumb({ art, side = 'left', alt }: { art: EventArt; side?: 'left' | 'right'; alt: string }) {
  const portrait = side === 'left' ? art.left : art.right;
  return <img className="event-thumb" src={portrait.src} alt={alt} style={{ objectPosition: portrait.focus }} loading="lazy" decoding="async" />;
}
