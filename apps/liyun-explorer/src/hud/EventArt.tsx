/**
 * 活动页立绘：使用国风二次元插画，配以金框、题签与飘叶。
 *
 * 人物插画放在 src/assets/events/，按活动配成双人立绘：
 * - 霜降雅集：庭中执笔的少年 + 亭下奉茶的少女（红柱金黄，最贴霜降主题）
 * - 多人同行：银杏下执扇的少年 + 雾中抱卷的少女
 */
import boyFan from '../assets/events/boy-fan.jpg';
import boyCalligraphy from '../assets/events/boy-calligraphy.jpg';
import girlScroll from '../assets/events/girl-scroll.jpg';
import girlTea from '../assets/events/girl-tea.jpg';

export type EventArtKey = 'festival' | 'party';

type Portrait = { src: string; alt: string; focus?: string };

type EventArt = { left: Portrait; right: Portrait; banner: string; seal: string };

export const EVENT_ART: Record<EventArtKey, EventArt> = {
  festival: {
    left: { src: boyCalligraphy, alt: '少年在庭中执笔，于卷上写下霜降二字', focus: '58% 18%' },
    right: { src: girlTea, alt: '少女在亭下奉茶，身后是秋日红叶', focus: '52% 20%' },
    banner: '霜降雅集',
    seal: '秋'
  },
  party: {
    left: { src: boyFan, alt: '少年立于银杏树下，手执折扇', focus: '58% 16%' },
    right: { src: girlScroll, alt: '少女抱着书卷，立于雾中楼阁前', focus: '50% 18%' },
    banner: '多人同行',
    seal: '友'
  }
};

/** 双人立绘版：两张插画并置，边缘化进宣纸底色，右上挂题签。 */
export function EventDuo({ art, large = false }: { art: EventArt; large?: boolean }) {
  return (
    <div className={`event-duo ${large ? 'is-large' : ''}`}>
      <figure className="event-portrait left">
        <img src={art.left.src} alt={art.left.alt} style={{ objectPosition: art.left.focus }} loading="lazy" decoding="async" />
      </figure>
      <figure className="event-portrait right">
        <img src={art.right.src} alt={art.right.alt} style={{ objectPosition: art.right.focus }} loading="lazy" decoding="async" />
      </figure>
      <span className="event-banner" aria-hidden="true">
        <span className="event-banner-text">{art.banner}</span>
        <span className="event-banner-seal">{art.seal}</span>
      </span>
      <span className="event-leaves" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => <i key={i} style={{ animationDelay: `${i * 1.3}s`, left: `${8 + i * 15}%` }} />)}
      </span>
    </div>
  );
}

/** 列表里的圆形小像。 */
export function EventThumb({ art, side = 'left', alt }: { art: EventArt; side?: 'left' | 'right'; alt: string }) {
  const portrait = side === 'left' ? art.left : art.right;
  return <img className="event-thumb" src={portrait.src} alt={alt} style={{ objectPosition: portrait.focus }} loading="lazy" decoding="async" />;
}
