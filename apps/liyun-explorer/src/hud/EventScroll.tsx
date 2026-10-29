/**
 * 活动页横向长卷：整幅国风山水由 SVG 现场绘制，角色坐在画里，四周有飘叶、雾带、
 * 水光与呼吸微动。人物用背影/侧背画法（面朝画中景物），不画正脸，风格统一。
 *
 * - festival 霜降雅集：暖金天色、银杏与红枫，少女抱信坐在岸边
 * - party 多人同行：青绿山水、薄雾小径，少年少女结伴走向湖畔
 */
import { useId } from 'react';

export type ScrollKind = 'festival' | 'party';

const SKIN = '#f6dfc6';
const HAIR = '#33403a';
const HAIR_LIGHT = '#5b6b5f';
const CLOTH = '#f6f0df';
const CLOTH_SHADE = '#ddd3b8';
const JADE = '#33644f';
const JADE_LIGHT = '#4d8368';
const GOLD = '#c6a052';
const SEAL = '#a8503a';

type Tone = {
  skyTop: string;
  skyBottom: string;
  sun: string;
  far: string;
  mid: string;
  near: string;
  water: string;
  waterDeep: string;
  rock: string;
  leaf: string;
  leafLight: string;
  accent: string;
  mist: string;
};

const TONES: Record<ScrollKind, Tone> = {
  festival: {
    skyTop: '#f8e9c2',
    skyBottom: '#eed6a0',
    sun: '#fff3d4',
    far: '#a8bda4',
    mid: '#83a08a',
    near: '#5d7d65',
    water: '#9dbbac',
    waterDeep: '#5f8c85',
    rock: '#3f5849',
    leaf: '#d8ae52',
    leafLight: '#efd489',
    accent: '#b8563a',
    mist: '#f7edd6'
  },
  party: {
    skyTop: '#eef3e2',
    skyBottom: '#d9e3c8',
    sun: '#f7fae8',
    far: '#a9c0aa',
    mid: '#87a894',
    near: '#5f8571',
    water: '#a3c2b6',
    waterDeep: '#5f9089',
    rock: '#3c5a4c',
    leaf: '#7fa87f',
    leafLight: '#b6d0a8',
    accent: '#9d5b4a',
    mist: '#f2f6e6'
  }
};

/** 团扇形银杏叶。 */
function FanLeaf({ x, y, r = 0, s = 1, color, stroke }: { x: number; y: number; r?: number; s?: number; color: string; stroke: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <path d="M0 6c-7 0-12-4-12-9 0-6 6-11 12-11s12 5 12 11c0 5-5 9-12 9Z" fill={color} stroke={stroke} strokeWidth="0.8" />
      <path d="M0 -13v18" stroke={stroke} strokeWidth="0.7" opacity="0.55" />
      <path d="M-6 -9 0 4M6 -9 0 4" stroke={stroke} strokeWidth="0.6" opacity="0.4" />
    </g>
  );
}

/** 五角枫叶。 */
function MapleLeaf({ x, y, r = 0, s = 1, color }: { x: number; y: number; r?: number; s?: number; color: string }) {
  return (
    <path
      transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}
      d="M0 -11 3 -4 10 -6 6 0 11 4 4 5 4 11 0 7-4 11-4 5-11 4-6 0-11-6-3-4Z"
      fill={color}
      opacity="0.92"
    />
  );
}

/** 树枝：主枝 + 侧枝，配叶簇。 */
function Branch({ d, width, color }: { d: string; width: number; color: string }) {
  return <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" />;
}

/** 远山剪影。 */
function Peaks({ layers, tone }: { layers: { d: string; color: string; opacity: number }[]; tone: Tone }) {
  return (
    <g>
      {layers.map((layer, i) => (
        <path key={i} d={layer.d} fill={layer.color || tone.mid} opacity={layer.opacity} />
      ))}
    </g>
  );
}

/** 坐着的少女（背影，面朝画中）。脚点在 (0,0)。 */
function SeatedGirl({ tone }: { tone: Tone }) {
  return (
    <g className="pano-breathe">
      {/* 裙摆散开 */}
      <path d="M-52 2c-4-16 6-34 26-42l16-4 26 6c18 8 26 24 22 40-16 6-30 8-45 8s-31-3-45-8Z" fill={CLOTH} stroke={JADE} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M-40 -8c10 6 22 9 34 9s26-4 36-10" fill="none" stroke={CLOTH_SHADE} strokeWidth="1.6" opacity="0.85" />
      <path d="M-18 -44c8 12 8 28 4 44" fill="none" stroke={CLOTH_SHADE} strokeWidth="1.4" opacity="0.7" />
      <path d="M14 -44c-6 12-6 28-2 44" fill="none" stroke={CLOTH_SHADE} strokeWidth="1.4" opacity="0.7" />
      {/* 上衣 */}
      <path d="M-22 -46c-2-22 6-38 22-42 16 4 24 20 22 42-14 6-30 6-44 0Z" fill={CLOTH} stroke={JADE} strokeWidth="1.4" strokeLinejoin="round" />
      {/* 腰带与飘带 */}
      <path d="M-23 -50h46l-2 9h-42Z" fill={JADE} />
      <g className="pano-ribbon">
        <path d="M-6 -46c-14 6-24 18-30 34 0 3 3 5 6 4 8-12 16-20 26-24Z" fill={JADE_LIGHT} opacity="0.95" />
        <path d="M6 -46c12 8 20 20 24 34 1 3-2 5-5 4-6-12-13-20-23-24Z" fill={JADE} opacity="0.85" />
      </g>
      {/* 手臂：抱着信 */}
      <path d="M-20 -78c-12 4-22 12-26 22" fill="none" stroke={CLOTH} strokeWidth="10" strokeLinecap="round" />
      <path d="M20 -78c-8 8-16 14-24 18" fill="none" stroke={CLOTH} strokeWidth="9" strokeLinecap="round" />
      <path d="M-20 -78c-12 4-22 12-26 22" fill="none" stroke={JADE} strokeWidth="1.2" opacity="0.5" />
      {/* 信笺 */}
      <g transform="translate(-44 -60) rotate(-14)">
        <rect x="-11" y="-8" width="22" height="16" rx="1.5" fill="#fffaf0" stroke={GOLD} strokeWidth="1" />
        <path d="M-7 -3h14M-7 1h14M-7 5h9" stroke="#c9b89a" strokeWidth="0.9" />
        <rect x="4" y="-6" width="5" height="5" fill={SEAL} opacity="0.9" />
      </g>
      {/* 头（背影） */}
      <g transform="translate(2 -96)">
        <path d="M-15 4c-3-16 4-27 15-27s18 11 15 27c-2 9-8 15-15 15s-13-6-15-15Z" fill={HAIR} />
        <path d="M-11 -8c3-8 9-12 16-11-6 2-10 6-12 12Z" fill={HAIR_LIGHT} opacity="0.55" />
        {/* 双髻 */}
        <circle cx="-11" cy="-22" r="7.5" fill={HAIR} />
        <circle cx="13" cy="-23" r="6.5" fill={HAIR} />
        <circle cx="-11" cy="-22" r="3" fill={HAIR_LIGHT} opacity="0.5" />
        {/* 发簪 */}
        <path d="M-16 -26 16 -30" stroke={GOLD} strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="17" cy="-30.5" r="2.2" fill={tone.accent} />
        {/* 垂发 */}
        <path d="M-14 8c-4 14-2 26 2 34-6-6-10-20-9-32Z" fill={HAIR} />
        <path d="M14 8c4 14 2 26-2 34 6-6 10-20 9-32Z" fill={HAIR} />
      </g>
    </g>
  );
}

/** 结伴而行的两人（背影，向画里走）。 */
function WalkingPair({ tone }: { tone: Tone }) {
  const girl = (
    <g className="pano-breathe">
      <path d="M-16 0c-2-18 2-34 6-44l10-2 10 3c5 11 8 27 6 43-10 3-22 3-32 0Z" fill={CLOTH} stroke={JADE} strokeWidth="1.2" />
      <path d="M-14 -46h28l-1 8h-26Z" fill={JADE} />
      <path d="M-9 -5v-38M8 -5v-38" stroke={CLOTH_SHADE} strokeWidth="1.2" opacity="0.7" />
      <g transform="translate(1 -62)">
        <circle r="11" fill={HAIR} />
        <circle cx="-9" cy="-9" r="5" fill={HAIR} />
        <circle cx="9" cy="-9" r="5" fill={HAIR} />
        <path d="M-12 -12 12 -14" stroke={GOLD} strokeWidth="1.2" />
      </g>
      {/* 手牵 */}
      <path d="M16 -52c8 2 14 6 18 12" fill="none" stroke={SKIN} strokeWidth="4" strokeLinecap="round" />
      <g className="pano-ribbon">
        <path d="M-6 -44c-10 8-16 18-18 30 0 3 3 4 5 3 4-11 9-18 17-23Z" fill={JADE_LIGHT} opacity="0.9" />
      </g>
    </g>
  );
  const boy = (
    <g transform="translate(44 0)">
      <g className="pano-breathe">
      <path d="M-17 0c-1-20 2-38 7-50l10-2 10 3c5 12 8 31 7 49-12 3-22 3-34 0Z" fill="#e9e4d0" stroke={JADE} strokeWidth="1.2" />
      <path d="M-15 -52h30l-1 9h-28Z" fill={JADE} />
      <path d="M-10 -6v-40M9 -6v-40" stroke={CLOTH_SHADE} strokeWidth="1.2" opacity="0.65" />
      <g transform="translate(1 -70)">
        <circle r="11.5" fill={HAIR} />
        <path d="M-11 -6c2-9 7-13 13-12-5 2-9 6-11 12Z" fill={HAIR_LIGHT} opacity="0.5" />
        <path d="M-3 -13c1-4 4-6 7-6" stroke={HAIR_LIGHT} strokeWidth="1.4" fill="none" opacity="0.5" />
      </g>
      <path d="M-16 -52c-8 2-14 6-18 12" fill="none" stroke={SKIN} strokeWidth="4" strokeLinecap="round" />
      <path d="M17 -50c6 8 9 16 9 24" fill="none" stroke={tone.accent} strokeWidth="3" strokeLinecap="round" opacity="0.55" />
      </g>
    </g>
  );
  return (
    <g>
      {girl}
      {boy}
    </g>
  );
}

function Scene({ kind }: { kind: ScrollKind }) {
  const tone = TONES[kind];
  const id = useId();
  const festival = kind === 'festival';

  return (
    <svg className="pano-svg" viewBox="0 0 1200 460" preserveAspectRatio="xMidYMid slice" role="img"
      aria-label={festival ? '霜降雅集长卷：秋日湖山间，少女抱信而坐，银杏与红枫点缀' : '多人同行长卷：青绿山水间，少年少女结伴走向湖畔'}>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tone.skyTop} />
          <stop offset="100%" stopColor={tone.skyBottom} />
        </linearGradient>
        <radialGradient id={`${id}-sun`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={tone.sun} stopOpacity="0.95" />
          <stop offset="55%" stopColor={tone.sun} stopOpacity="0.4" />
          <stop offset="100%" stopColor={tone.sun} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-water`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tone.water} />
          <stop offset="100%" stopColor={tone.waterDeep} />
        </linearGradient>
        <linearGradient id={`${id}-rock`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tone.rock} stopOpacity="0.92" />
          <stop offset="100%" stopColor={tone.rock} stopOpacity="1" />
        </linearGradient>
        <filter id={`${id}-blur`} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <filter id={`${id}-blurSoft`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="16" />
        </filter>
      </defs>

      {/* 天与日 */}
      <rect width="1200" height="460" fill={`url(#${id}-sky)`} />
      <circle cx="250" cy="118" r="150" fill={`url(#${id}-sun)`} />
      <circle cx="250" cy="118" r="34" fill={tone.sun} opacity="0.85" />

      {/* 远山三层 */}
      <path d="M-20 300c90-70 170-96 260-70 70 20 130 8 200-24 90-42 180-30 260 18 60 36 130 44 220 24v190H-20Z" fill={tone.far} opacity="0.5" filter={`url(#${id}-blur)`} />
      <path d="M-20 322c110-58 190-64 280-34 74 24 148 12 224-20 84-36 168-20 250 26 48 26 108 32 186 18v168H-20Z" fill={tone.mid} opacity="0.72" />
      <path d="M-20 344c120-40 210-34 300-6 74 22 150 10 230-16 82-26 160-8 234 30 40 20 96 24 176 14v104H-20Z" fill={tone.near} opacity="0.9" />

      {/* 湖面 */}
      <path d="M-20 336h1240v96H-20Z" fill={`url(#${id}-water)`} opacity="0.95" />
      <g className="pano-water" opacity="0.7">
        <ellipse cx="700" cy="368" rx="140" ry="5" fill="#ffffff" opacity="0.35" />
        <ellipse cx="880" cy="386" rx="96" ry="4" fill="#ffffff" opacity="0.28" />
        <ellipse cx="560" cy="392" rx="120" ry="4" fill="#ffffff" opacity="0.22" />
        <ellipse cx="980" cy="360" rx="70" ry="3" fill="#ffffff" opacity="0.3" />
        <path d="M640 376h60M760 400h44M920 402h56" stroke="#ffffff" strokeWidth="2" opacity="0.35" strokeLinecap="round" />
      </g>

      {/* 岸与石 */}
      <path d="M-20 404c120-18 220-6 320 10 96 16 200 12 300-4 110-18 220-12 340 14 60 12 120 14 180 8v50H-20Z" fill={`url(#${id}-rock)`} />
      <ellipse cx="810" cy="428" rx="180" ry="22" fill={tone.rock} opacity="0.35" />

      {/* 左上银杏大枝 */}
      <g>
        <Branch d="M-30 30c120 26 214 76 268 150" width={13} color="#5c5343" />
        <Branch d="M60 44c56 30 92 66 112 106" width={7} color="#5c5343" />
        <Branch d="M150 84c30 26 46 48 54 74" width={5} color="#5c5343" />
        {[
          [30, 26, -18, 1.5], [70, 40, 8, 1.3], [108, 52, -8, 1.4], [140, 74, 18, 1.2],
          [64, 74, 26, 1.2], [96, 96, -14, 1.1], [190, 118, 12, 1.5], [220, 146, -6, 1.2],
          [40, 84, 34, 1.1], [130, 132, 22, 1.0], [176, 92, -24, 1.0]
        ].map(([x, y, r, s], i) => (
          <FanLeaf key={i} x={x as number} y={y as number} r={r as number} s={s as number} color={tone.leaf} stroke={tone.leafLight} />
        ))}
      </g>

      {/* 右上红枫 */}
      <g>
        <Branch d="M1230 26c-96 18-168 58-206 108" width={9} color="#5c4a3e" />
        <Branch d="M1130 44c-46 26-76 56-92 92" width={5} color="#5c4a3e" />
        {[[1156, 40, 0.6], [1112, 62, 0.55], [1068, 92, 0.5], [1190, 62, 0.55], [1032, 120, 0.45], [1122, 106, 0.5]].map(([x, y, s], i) => (
          <MapleLeaf key={i} x={x} y={y} r={i * 34} s={s} color={tone.accent} />
        ))}
      </g>

      {/* 角色 */}
      <g transform={festival ? 'translate(806 430) scale(1.16) scale(-1 1)' : 'translate(760 432) scale(1.1)'}>
        {festival ? <SeatedGirl tone={tone} /> : <WalkingPair tone={tone} />}
      </g>

      {/* 雾气 */}
      <g className="pano-mist" opacity="0.75">
        <ellipse cx="420" cy="352" rx="240" ry="16" fill={tone.mist} filter={`url(#${id}-blurSoft)`} />
        <ellipse cx="860" cy="332" rx="200" ry="13" fill={tone.mist} filter={`url(#${id}-blurSoft)`} />
      </g>

      {/* 飘落叶片 */}
      {[
        [180, 120, 0, 'a'], [320, 190, 2.4, 'b'], [470, 90, 4.2, 'a'], [640, 150, 1.2, 'b'],
        [900, 120, 3.4, 'a'], [1040, 200, 5.2, 'b'], [380, 260, 6.2, 'a'], [720, 240, 2.0, 'b']
      ].map(([x, y, delay, kind2], i) => (
        <g key={i} className={`pano-leaf pano-leaf-${kind2}`} style={{ animationDelay: `${delay}s` }}>
          {kind2 === 'a'
            ? <FanLeaf x={x as number} y={y as number} r={i * 47} s={0.7} color={tone.leafLight} stroke={tone.leaf} />
            : <MapleLeaf x={x as number} y={y as number} r={i * 53} s={0.7} color={tone.accent} />}
        </g>
      ))}

      {/* 光点 */}
      <g className="pano-motes" opacity="0.8">
        {[[520, 220], [700, 180], [980, 240], [300, 250], [1120, 300]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 2 ? 2.4 : 3.2} fill={tone.sun} opacity="0.85" />
        ))}
      </g>
    </svg>
  );
}

/** 横向长卷画心。 */
export function EventScroll({ kind }: { kind: ScrollKind }) {
  return <div className={`pano ${kind}`}><Scene kind={kind} /></div>;
}
