/**
 * 活动页卷中画：把人物立绘柔边合成进水墨山水，配合挂轴书卷版式。
 *
 * 山水背景由脚本 _compose_scenes.py 生成（人物四周渐隐 + 罩色），
 * 图片位于 src/assets/events/event-scene-*.jpg。
 */
import boyFan from '../assets/events/boy-fan.jpg';
import boyCalligraphy from '../assets/events/boy-calligraphy.jpg';
import girlScroll from '../assets/events/girl-scroll.jpg';
import girlTea from '../assets/events/girl-tea.jpg';
import festivalScene from '../assets/events/event-scene-festival.jpg';
import partyScene from '../assets/events/event-scene-party.jpg';

export type EventArtKey = 'festival' | 'party';

type Portrait = { src: string; alt: string; focus?: string };

export type EventArt = {
  left: Portrait;
  right: Portrait;
  banner: string;
  seal: string;
  scene: { src: string; alt: string };
};

export const EVENT_ART: Record<EventArtKey, EventArt> = {
  festival: {
    left: { src: boyCalligraphy, alt: '少年在庭中执笔，于卷上写下霜降二字', focus: '58% 18%' },
    right: { src: girlTea, alt: '少女在亭下奉茶，身后是秋日红叶', focus: '52% 20%' },
    banner: '霜降雅集',
    seal: '秋',
    scene: { src: festivalScene, alt: '秋日湖山，银杏与少年少女同游的霜降雅集图卷' }
  },
  party: {
    left: { src: boyFan, alt: '少年立于银杏树下，手执折扇', focus: '58% 16%' },
    right: { src: girlScroll, alt: '少女抱着书卷，立于雾中楼阁前', focus: '50% 18%' },
    banner: '多人同行',
    seal: '友',
    scene: { src: partyScene, alt: '青绿山水间，同学们结伴同行的图卷' }
  }
};

/** 卷中画：整幅山水图铺满画心，右上挂题签，叶影飘落。 */
export function EventScene({ art, large = false }: { art: EventArt; large?: boolean }) {
  return (
    <div className={`event-scene-wrap ${large ? 'is-large' : ''}`}>
      <img className="event-scene-img" src={art.scene.src} alt={art.scene.alt} loading="lazy" decoding="async" />
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
