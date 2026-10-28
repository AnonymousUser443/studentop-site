/**
 * 活动页插图：纸剪风格的 SVG 场景。
 *
 * 全部用几何形状拼，不引外部图片：
 * - 少年 / 少女用墨绿剪影 + 米白细节，避免五官，符合剪纸质感
 * - 背景放北理工元素：东校门牌坊、齿轮、星轨（航天）、银杏
 */
import { useId } from 'react';

const INK = '#2d5444';
const INK_SOFT = '#48685a';
const GOLD = '#b98f43';
const GOLD_LIGHT = '#d8b76a';
const CREAM = '#f7ecd0';
const SEAL = '#a8503a';

type SceneProps = { className?: string };

/** 东校门牌坊：两根立柱 + 横梁 + 瓦檐，作为两幕共用的背景。 */
function CampusGate({ x, y, scale = 1, opacity = 0.28 }: { x: number; y: number; scale?: number; opacity?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} fill="none" stroke={GOLD} strokeWidth="2" opacity={opacity}>
      <path d="M0 0h150" strokeWidth="2.4" />
      <path d="M-8 0h166" strokeWidth="1.2" opacity="0.7" />
      <path d="M6 6h138" strokeWidth="1" opacity="0.5" />
      <path d="M14 8v72M136 8v72" />
      <path d="M22 8v72M128 8v72" opacity="0.55" />
      <path d="M14 40h122" strokeWidth="1.4" opacity="0.8" />
      <path d="M44 20h62" strokeWidth="1" opacity="0.45" />
    </g>
  );
}

/** 银杏树：三团树冠 + 树干，叶子另用金色菱形点缀。 */
function Ginkgo({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 56c4-14 2-26-2-38" stroke={INK_SOFT} strokeWidth="4" fill="none" strokeLinecap="round" />
      <circle cx="-2" cy="-6" r="30" fill={INK} opacity="0.82" />
      <circle cx="-27" cy="8" r="21" fill={INK} opacity="0.74" />
      <circle cx="22" cy="6" r="24" fill={INK} opacity="0.78" />
      <circle cx="4" cy="-26" r="17" fill={INK} opacity="0.7" />
    </g>
  );
}

function Leaf({ x, y, r = 0, s = 1 }: { x: number; y: number; r?: number; s?: number }) {
  return <path transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`} d="M0 -5 L5 0 L0 5 L-5 0 Z" fill={GOLD_LIGHT} opacity="0.85" />;
}

/** 少年：短发、立领外套、单肩包，手持卷轴。 */
function Boy({ x, y, flip = 1 }: { x: number; y: number; flip?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip} 1)`}>
      <circle cx="0" cy="-46" r="12" fill={INK} />
      <path d="M-12 -48c1-9 5-13 12-13s11 4 12 13c-4-3-8-4-12-4s-8 1-12 4Z" fill={INK} />
      <path d="M-13 -34h26l6 44c-4 4-9 6-19 6s-15-2-19-6Z" fill={INK} />
      <path d="M-13 -34h26v8h-26Z" fill={CREAM} opacity="0.35" />
      <path d="M-2 -34v46" stroke={CREAM} strokeWidth="1" opacity="0.28" />
      <path d="M13 -30c6 4 10 10 12 18" stroke={INK} strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M-13 -30c-6 4-9 10-10 17" stroke={INK} strokeWidth="6" fill="none" strokeLinecap="round" />
      <rect x="22" y="-14" width="7" height="26" rx="2" fill={CREAM} stroke={GOLD} strokeWidth="1.4" transform="rotate(16 25 -1)" />
      <path d="M-9 14v18M7 14v18" stroke={INK} strokeWidth="7" strokeLinecap="round" />
      <path d="M-12 32h8M4 32h8" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <rect x="-26" y="-26" width="11" height="16" rx="3" fill={INK_SOFT} />
    </g>
  );
}

/** 少女：双马尾、长裙、提灯。 */
function Girl({ x, y, flip = 1 }: { x: number; y: number; flip?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip} 1)`}>
      <circle cx="0" cy="-46" r="12" fill={INK} />
      <path d="M-12 -48c1-9 5-13 12-13s11 4 12 13c-4-3-8-4-12-4s-8 1-12 4Z" fill={INK} />
      <path d="M-13 -44c-8 2-12 8-12 16 5 2 9 0 11-4Z" fill={INK} />
      <path d="M13 -44c8 2 12 8 12 16-5 2-9 0-11-4Z" fill={INK} />
      <path d="M-13 -34h26l9 50h-44Z" fill={INK} />
      <path d="M-10 -34h20v7h-20Z" fill={CREAM} opacity="0.32" />
      <path d="M-4 -34v44" stroke={CREAM} strokeWidth="1" opacity="0.22" />
      <path d="M13 -30c7 5 10 12 10 19" stroke={INK} strokeWidth="5.5" fill="none" strokeLinecap="round" />
      <path d="M-13 -30c-7 5-11 12-11 19" stroke={INK} strokeWidth="5.5" fill="none" strokeLinecap="round" />
      <g transform="translate(-24 4)">
        <path d="M0 -10v-6" stroke={GOLD} strokeWidth="1.4" />
        <path d="M-6 -10h12l3 16h-18Z" fill={CREAM} stroke={GOLD} strokeWidth="1.3" />
        <circle cx="0" cy="0" r="3" fill={GOLD_LIGHT} />
      </g>
      <path d="M-7 16v16M7 16v16" stroke={INK} strokeWidth="6" strokeLinecap="round" />
      <path d="M-10 32h7M3 32h7" stroke={INK} strokeWidth="3.6" strokeLinecap="round" />
    </g>
  );
}

/** 齿轮：北理工“军工”意象。 */
function Gear({ x, y, r = 46, opacity = 0.4 }: { x: number; y: number; r?: number; opacity?: number }) {
  const teeth = Array.from({ length: 10 }, (_, i) => (i * 360) / 10);
  return (
    <g transform={`translate(${x} ${y})`} opacity={opacity} fill="none" stroke={GOLD} strokeWidth="2">
      <circle r={r} />
      <circle r={r * 0.62} strokeWidth="1.2" />
      <circle r={r * 0.22} strokeWidth="1.2" />
      {teeth.map((deg) => (
        <rect key={deg} x={-4} y={-r - 6} width="8" height="10" rx="1.5" transform={`rotate(${deg})`} fill={GOLD} stroke="none" />
      ))}
    </g>
  );
}

/** 星轨 + 小星：航天意象。 */
function StarTrail({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} fill="none" stroke={GOLD} strokeWidth="1.2" opacity="0.45">
      <path d="M-120 40c40-46 120-58 196-28" />
      <path d="M-96 56c34-34 96-44 152-24" strokeWidth="0.9" opacity="0.7" />
      <path d="M10 -30l3 9 9 3-9 3-3 9-3-9-9-3 9-3Z" fill={GOLD_LIGHT} stroke="none" opacity="0.9" />
      <path d="M-70 -6l2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" fill={GOLD_LIGHT} stroke="none" opacity="0.7" />
    </g>
  );
}

/** 霜降雅集：银杏下的少年少女，背景是东校门。 */
export function FestivalScene({ className = '' }: SceneProps) {
  const id = useId();
  return (
    <svg className={`event-scene ${className}`} viewBox="0 0 460 210" role="img" aria-label="霜降雅集：银杏树下，少年与少女在校园里游园">
      <defs>
        <radialGradient id={`${id}-glow`} cx="50%" cy="58%" r="62%">
          <stop offset="0%" stopColor="#f6e3ae" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#f6e3ae" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="460" height="210" fill={`url(#${id}-glow)`} />
      <CampusGate x={150} y={34} scale={1.05} opacity={0.24} />
      <Ginkgo x={368} y={150} />
      {[[318, 96, 14], [340, 76, -8], [396, 88, 30], [412, 118, 12], [300, 128, -20], [430, 74, 5], [356, 132, 40], [386, 140, -14]].map(([x, y, r], i) => (
        <Leaf key={i} x={x} y={y} r={r} s={i % 3 === 0 ? 1.25 : 1} />
      ))}
      <path d="M40 182h380" stroke={INK_SOFT} strokeWidth="1.6" opacity="0.4" />
      <Boy x={186} y={176} />
      <Girl x={240} y={176} flip={-1} />
      <path d="M150 150c14 6 30 8 46 8" stroke={GOLD_LIGHT} strokeWidth="1.2" fill="none" opacity="0.5" />
      <g transform="translate(58 40)">
        <rect x="-16" y="-12" width="32" height="24" rx="2" fill={SEAL} opacity="0.9" />
        <text x="0" y="4" textAnchor="middle" fontSize="12" fill={CREAM} fontFamily="'Ma Shan Zheng', serif">理</text>
      </g>
    </svg>
  );
}

/** 多人同行：三位同学结伴走向校门，背景齿轮与星轨。 */
export function CompanyScene({ className = '' }: SceneProps) {
  const id = useId();
  return (
    <svg className={`event-scene ${className}`} viewBox="0 0 460 210" role="img" aria-label="多人同行：同学们结伴走过校园，背景是齿轮与星轨">
      <defs>
        <radialGradient id={`${id}-glow2`} cx="52%" cy="60%" r="60%">
          <stop offset="0%" stopColor="#cfe0c6" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#cfe0c6" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="460" height="210" fill={`url(#${id}-glow2)`} />
      <Gear x={86} y={92} r={44} opacity={0.35} />
      <StarTrail x={258} y={54} />
      <CampusGate x={286} y={96} scale={0.82} opacity={0.2} />
      <path d="M34 182h392" stroke={INK_SOFT} strokeWidth="1.6" opacity="0.4" />
      <Boy x={132} y={176} />
      <Girl x={186} y={176} flip={-1} />
      <Boy x={238} y={176} flip={-1} />
      <g opacity="0.5" stroke={GOLD} strokeWidth="1.4" fill="none">
        <path d="M270 150c30-4 52 2 70 14" />
        <path d="M300 138l4 10 10 4-10 4-4 10-4-10-10-4 10-4Z" fill={GOLD_LIGHT} stroke="none" />
      </g>
      <g transform="translate(58 152)">
        <rect x="-26" y="-10" width="52" height="20" rx="2" fill={INK} opacity="0.12" />
        <text x="0" y="5" textAnchor="middle" fontSize="10" letterSpacing="2" fill={INK_SOFT} fontFamily="'Noto Serif SC', serif">同行</text>
      </g>
    </svg>
  );
}
