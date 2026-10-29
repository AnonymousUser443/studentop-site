/**
 * 活动页横向长卷：SVG 现场绘制山水（远山、湖面、银杏、红枫、雾、飘叶），
 * 人物用立绘图叠加在画面前景，并带轻微浮动与呼吸动效。
 *
 * - festival 霜降雅集：少女抱信坐在岸边（大立绘，左侧前景）
 * - party 多人同行：少年执扇 + 少女抱卷，两人一前一后
 */
import { useId } from 'react';

import charBoy from '../assets/events/char-boy.webp';
import charGirlB from '../assets/events/char-girl-b.webp';
import charGirl from '../assets/events/char-girl.webp';

export type ScrollKind = 'festival' | 'party';

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

function Branch({ d, width, color }: { d: string; width: number; color: string }) {
  return <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" />;
}

function Scene({ kind }: { kind: ScrollKind }) {
  const tone = TONES[kind];
  const id = useId();
  const festival = kind === 'festival';

  return (
    <svg className="pano-svg" viewBox="0 0 1200 460" preserveAspectRatio="xMidYMid slice" role="img"
      aria-label={festival ? '霜降雅集长卷：秋日湖山、银杏与红枫' : '多人同行长卷：青绿山水与薄雾小径'}>
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
          <stop offset="0%" stopColor={tone.rock} stopOpacity="0.9" />
          <stop offset="100%" stopColor={tone.rock} stopOpacity="1" />
        </linearGradient>
        <filter id={`${id}-blur`} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <filter id={`${id}-blurSoft`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="16" />
        </filter>
      </defs>

      <rect width="1200" height="460" fill={`url(#${id}-sky)`} />
      <circle cx="760" cy="104" r="150" fill={`url(#${id}-sun)`} />
      <circle cx="760" cy="104" r="32" fill={tone.sun} opacity="0.8" />

      {/* 远山三层 */}
      <path d="M-20 300c90-70 170-96 260-70 70 20 130 8 200-24 90-42 180-30 260 18 60 36 130 44 220 24v190H-20Z" fill={tone.far} opacity="0.5" filter={`url(#${id}-blur)`} />
      <path d="M-20 322c110-58 190-64 280-34 74 24 148 12 224-20 84-36 168-20 250 26 48 26 108 32 186 18v168H-20Z" fill={tone.mid} opacity="0.72" />
      <path d="M-20 344c120-40 210-34 300-6 74 22 150 10 230-16 82-26 160-8 234 30 40 20 96 24 176 14v104H-20Z" fill={tone.near} opacity="0.9" />

      {/* 湖面 */}
      <path d="M-20 336h1240v96H-20Z" fill={`url(#${id}-water)`} opacity="0.95" />
      <g className="pano-water" opacity="0.7">
        <ellipse cx="760" cy="368" rx="140" ry="5" fill="#ffffff" opacity="0.35" />
        <ellipse cx="940" cy="386" rx="96" ry="4" fill="#ffffff" opacity="0.28" />
        <ellipse cx="620" cy="392" rx="120" ry="4" fill="#ffffff" opacity="0.22" />
        <path d="M700 376h60M820 400h44M980 402h56" stroke="#ffffff" strokeWidth="2" opacity="0.35" strokeLinecap="round" />
      </g>

      {/* 岸与石 */}
      <path d="M-20 404c120-18 220-6 320 10 96 16 200 12 300-4 110-18 220-12 340 14 60 12 120 14 180 8v50H-20Z" fill={`url(#${id}-rock)`} />
      {/* 左下前景坡石：给人物一个坐处 */}
      <path d="M-20 460c40-58 120-86 200-92 54-4 96 8 120 30-40 26-80 44-140 52-70 10-140 12-180 10Z" fill={tone.rock} opacity="0.96" />
      <path d="M-20 452c52-40 118-62 182-66" fill="none" stroke={tone.mist} strokeWidth="3" opacity="0.25" />

      {/* 左上银杏大枝 */}
      <g>
        <Branch d="M-30 26c120 26 214 76 268 150" width={13} color="#5c5343" />
        <Branch d="M60 40c56 30 92 66 112 106" width={7} color="#5c5343" />
        <Branch d="M150 80c30 26 46 48 54 74" width={5} color="#5c5343" />
        {[
          [30, 22, -18, 1.5], [70, 36, 8, 1.3], [108, 48, -8, 1.4], [140, 70, 18, 1.2],
          [64, 70, 26, 1.2], [96, 92, -14, 1.1], [190, 114, 12, 1.5], [220, 142, -6, 1.2],
          [40, 80, 34, 1.1], [130, 128, 22, 1.0], [176, 88, -24, 1.0], [252, 168, 14, 1.0]
        ].map(([x, y, r, s], i) => (
          <FanLeaf key={i} x={x as number} y={y as number} r={r as number} s={s as number} color={tone.leaf} stroke={tone.leafLight} />
        ))}
      </g>

      {/* 右上红枫 */}
      <g>
        <Branch d="M1230 22c-96 18-168 58-206 108" width={9} color="#5c4a3e" />
        <Branch d="M1130 40c-46 26-76 56-92 92" width={5} color="#5c4a3e" />
        {[[1156, 36, 0.6], [1112, 58, 0.55], [1068, 88, 0.5], [1190, 58, 0.55], [1032, 116, 0.45], [1122, 102, 0.5]].map(([x, y, s], i) => (
          <MapleLeaf key={i} x={x} y={y} r={i * 34} s={s} color={tone.accent} />
        ))}
      </g>

      {/* 雾气 */}
      <g className="pano-mist" opacity="0.75">
        <ellipse cx="640" cy="352" rx="240" ry="16" fill={tone.mist} filter={`url(#${id}-blurSoft)`} />
        <ellipse cx="960" cy="332" rx="200" ry="13" fill={tone.mist} filter={`url(#${id}-blurSoft)`} />
      </g>

      {/* 飘落叶片 */}
      {[
        [300, 120, 0, 'a'], [430, 190, 2.4, 'b'], [560, 90, 4.2, 'a'], [700, 150, 1.2, 'b'],
        [880, 120, 3.4, 'a'], [1010, 200, 5.2, 'b'], [470, 260, 6.2, 'a'], [790, 240, 2.0, 'b']
      ].map(([x, y, delay, kind2], i) => (
        <g key={i} className={`pano-leaf pano-leaf-${kind2}`} style={{ animationDelay: `${delay}s` }}>
          {kind2 === 'a'
            ? <FanLeaf x={x as number} y={y as number} r={i * 47} s={0.7} color={tone.leafLight} stroke={tone.leaf} />
            : <MapleLeaf x={x as number} y={y as number} r={i * 53} s={0.7} color={tone.accent} />}
        </g>
      ))}

      {/* 光点 */}
      <g className="pano-motes" opacity="0.8">
        {[[620, 220], [780, 180], [1000, 240], [430, 250], [1120, 300]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 2 ? 2.4 : 3.2} fill={tone.sun} opacity="0.85" />
        ))}
      </g>
    </svg>
  );
}

type CharArt = { src: string; alt: string; className?: string };

const CHARS: Record<ScrollKind, CharArt[]> = {
  festival: [{ src: charGirl, alt: '少女抱着信笺，坐在湖岸的坡石上' }],
  party: [
    { src: charBoy, alt: '少年立于银杏树下，手执折扇' },
    { src: charGirlB, alt: '少女抱着书卷，与他同行', className: 'secondary' }
  ]
};

/** 横向长卷画心：山水 + 立绘人物。 */
export function EventScroll({ kind }: { kind: ScrollKind }) {
  return (
    <div className={`pano ${kind}`}>
      <Scene kind={kind}/>
      {CHARS[kind].map((item, index) => (
        <img
          key={index}
          className={`pano-char ${item.className ?? ''}`}
          src={item.src}
          alt={item.alt}
          loading="lazy"
          decoding="async"
          style={{ animationDelay: `${index * 1.6}s` }}
        />
      ))}
    </div>
  );
}
