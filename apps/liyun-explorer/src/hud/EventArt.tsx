/**
 * 活动页插画：二次元赛璐璐风格的人物 + 北理工元素背景。
 *
 * 全部用 SVG 画，不依赖外部图片：
 * - 人物是动漫画法：大眼睛、分层刘海、平涂 + 一层暗部
 * - 线稿墨绿，皮肤暖白，校服取青绿 + 奶油色，点缀朱砂
 * - 背景：东校门牌坊、银杏、齿轮、星轨（军工 / 航天意象）
 */
import { useId, type ReactNode } from 'react';

const LINE = '#2b4a3c';
const SKIN = '#f9e8d4';
const SKIN_SHADE = '#eccfb6';
const HAIR = '#3b594b';
const HAIR_SHADE = '#294234';
const HAIR_LIGHT = '#7d9a83';
const UNIFORM = '#2f5747';
const UNIFORM_SHADE = '#234235';
const TRIM = '#f3e6c4';
const TRIM_SHADE = '#ded0a6';
const GOLD = '#c39a4c';
const GOLD_LIGHT = '#e2c47e';
const RIBBON = '#a8503a';
const CREAM = '#f9f0d8';

type FigureKind = 'girl' | 'boy';
type HairKind = 'twin' | 'long' | 'short';

/** 一只眼睛：虹膜 + 高光 + 上下睫毛。 */
function Eye({ x, y, flip = 1 }: { x: number; y: number; flip?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip} 1)`}>
      <ellipse cx="0" cy="0" rx="3.2" ry="4" fill="#1f4437" />
      <ellipse cx="0" cy="0.6" rx="2.2" ry="3.1" fill="#5d8d72" />
      <circle cx="-0.9" cy="-1.5" r="1.2" fill={CREAM} opacity="0.95" />
      <circle cx="1" cy="1.6" r="0.6" fill={CREAM} opacity="0.55" />
      <path d="M-3.5 -1.6c1.2-2 3.2-2.7 5.4-2.3" stroke={LINE} strokeWidth="1.15" fill="none" opacity="0.9" strokeLinecap="round" />
      <path d="M-3.7 3.2c1.5 1.2 3.5 1.3 5.1 0.2" stroke={LINE} strokeWidth="0.7" fill="none" opacity="0.4" strokeLinecap="round" />
    </g>
  );
}

/** 脸：下巴收窄的动漫脸型 + 五官。锚点在两眼之间。 */
function Face() {
  return (
    <g>
      <path d="M-10.4 -6.2c-.6 7 3.4 13.4 10.4 13.4s11-6.4 10.4-13.4c-3.4 1.6-7 2-10.4 2s-7-.4-10.4-2Z" fill={SKIN} stroke={LINE} strokeWidth="0.9" strokeLinejoin="round" />
      <path d="M-10.2 -4.2c.3 6.2 3.8 11.2 9.2 11.8-4.6.6-9.6-2.4-10.6-7.4-.4-2 -.2-3 .6-4.4Z" fill={SKIN_SHADE} opacity="0.6" />
      <Eye x={-5.4} y={3.2} />
      <Eye x={5.4} y={3.2} flip={-1} />
      <path d="M-7.8 -1.4c1.6-1 3.8-1 5.2 0" stroke={LINE} strokeWidth="0.95" fill="none" opacity="0.75" strokeLinecap="round" />
      <path d="M2.6 -1.4c1.4-1 3.6-1 5.2 0" stroke={LINE} strokeWidth="0.95" fill="none" opacity="0.75" strokeLinecap="round" />
      <ellipse cx="-8.6" cy="7.4" rx="2.8" ry="1.6" fill="#e59b8b" opacity="0.32" />
      <ellipse cx="8.6" cy="7.4" rx="2.8" ry="1.6" fill="#e59b8b" opacity="0.32" />
      <path d="M-0.8 8.2h1.6" stroke={LINE} strokeWidth="0.7" opacity="0.3" strokeLinecap="round" />
      <path d="M-1.8 10.6c1.2 1.1 2.4 1.1 3.6 0" stroke={LINE} strokeWidth="0.85" fill="none" strokeLinecap="round" />
    </g>
  );
}

function Hair({ kind }: { kind: HairKind }) {
  if (kind === 'short') {
    return (
      <g>
        <path d="M-13.6 -2.4c-1.4-9.6 4.4-16 13.6-16s15 6.4 13.6 16c-1.4-4-3.2-6.4-5.4-7.8-3 3.2-13.4 3.6-16.8.6-2.2 1.4-4 3.6-5 7.2Z" fill={HAIR} stroke={LINE} strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M-11.2 -10.4c2-5 6.2-7.8 11.8-8-4.8 2-7.6 4.6-9.2 8.4Z" fill={HAIR_LIGHT} opacity="0.32" />
        <path d="M-5.4 -14.6c1.8-3.2 4.6-4.8 8.4-5" stroke={HAIR_LIGHT} strokeWidth="1.1" fill="none" opacity="0.4" strokeLinecap="round" />
      </g>
    );
  }
  const twin = kind === 'twin';
  return (
    <g>
      {/* 后方长发 */}
      <path d="M-14 -4c-1-10.6 5.4-17.6 14-17.6s15 7 14 17.6l-1.8 20c-.5 5.6-3.2 8.6-6 9 1.6-5.6 1.8-11.6 1-17.6-4.4 2.2-11.4 2.2-16.4 0-.8 6-.4 12 1.2 17.6-2.8-.4-5.5-3.4-6-9Z" fill={HAIR} stroke={LINE} strokeWidth="0.9" strokeLinejoin="round" />
      <path d="M-12.6 -10.6c2.2-5.6 6.8-9 13-9-6 2.4-9.4 5.8-11 10.6Z" fill={HAIR_LIGHT} opacity="0.3" />
      {twin ? (
        <>
          <path d="M-14.2 -6c-4.6 1.2-7 5.8-6.4 12 .4 4.6 2.4 8.4 5.2 10 1.2-4.6 1.6-10.8 1.2-22Z" fill={HAIR} stroke={LINE} strokeWidth="0.9" />
          <path d="M14.2 -6c4.6 1.2 7 5.8 6.4 12-.4 4.6-2.4 8.4-5.2 10-1.2-4.6-1.6-10.8-1.2-22Z" fill={HAIR} stroke={LINE} strokeWidth="0.9" />
          <path d="M-16.4 2.4c-1.4 3.2-1.8 6.6-1.2 9.4" stroke={HAIR_LIGHT} strokeWidth="1" fill="none" opacity="0.35" strokeLinecap="round" />
          <path d="M16.4 2.4c1.4 3.2 1.8 6.6 1.2 9.4" stroke={HAIR_LIGHT} strokeWidth="1" fill="none" opacity="0.35" strokeLinecap="round" />
        </>
      ) : (
        <path d="M-14.4 -2c-1.4 8-1 18.4 1.6 26.4-4.6-1.6-7.4-7.4-7.4-14 0-6.6 2-10.6 5.8-12.4Z" fill={HAIR} opacity="0.92" />
      )}
      {/* 刘海 */}
      <path d="M-13.4 -5.4c1.2-7.6 6-12 13.4-12s12.2 4.4 13.4 12c-2.6-1.8-4.4-4.4-5.4-7.4-2 3.6-5.2 4.4-8.8 2.4-1.6 2.6-4.4 3.6-7 2.2-2.4 1.6-4.4 2.4-6.6 2.8Z" fill={HAIR} stroke={LINE} strokeWidth="0.8" strokeLinejoin="round" />
      <path d="M-8.6 -13.6c2.4-2.8 5.6-4.2 9.6-4.2" stroke={HAIR_LIGHT} strokeWidth="1.2" fill="none" opacity="0.45" strokeLinecap="round" />
    </g>
  );
}

/** 校服。肩线 -86，腰 -52，膝 -24，脚踝 -2。 */
function Outfit({ kind, swing }: { kind: FigureKind; swing: number }) {
  if (kind === 'boy') {
    return (
      <g>
        {/* 腿 */}
        <path d={`M-7 -44c0 10-.6 18-1 ${20 - swing * 6}`} stroke={UNIFORM_SHADE} strokeWidth="7.4" fill="none" strokeLinecap="round" />
        <path d={`M7 -44c0 10 .6 18 1 ${20 + swing * 6}`} stroke={UNIFORM_SHADE} strokeWidth="7.4" fill="none" strokeLinecap="round" />
        <path d="M-11 -2.4h7.6M4 -2.4h7.6" stroke={LINE} strokeWidth="3.2" strokeLinecap="round" />
        {/* 外套 */}
        <path d="M-13 -86h26l2.4 42c-3.4 2.6-9 3.8-15.2 3.8s-11.8-1.2-15.2-3.8Z" fill={UNIFORM} stroke={LINE} strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M7 -86h6l2.4 42c-2.4 1.8-5.6 3-10 3.4Z" fill={UNIFORM_SHADE} opacity="0.55" />
        {/* 立领 */}
        <path d="M-13 -86h26l-2.6 8h-20.8Z" fill={TRIM} stroke={LINE} strokeWidth="0.7" strokeLinejoin="round" />
        <path d="M-6.6 -86 0 -72l6.6-14" fill="none" stroke={LINE} strokeWidth="0.9" />
        <path d="M-2.2 -78h4.4" stroke={GOLD} strokeWidth="1.1" />
        {/* 手臂 */}
        <path d={`M-11 -82c-3 8-4 16-4 ${22 - swing * 7}`} stroke={UNIFORM} strokeWidth="6.6" fill="none" strokeLinecap="round" />
        <path d={`M11 -82c3 8 4 16 4 ${22 + swing * 7}`} stroke={UNIFORM} strokeWidth="6.6" fill="none" strokeLinecap="round" />
        <circle cx="-15" cy={-60 + swing * 7} r="2.6" fill={SKIN} stroke={LINE} strokeWidth="0.6" />
        <circle cx="15" cy={-60 - swing * 7} r="2.6" fill={SKIN} stroke={LINE} strokeWidth="0.6" />
      </g>
    );
  }
  return (
    <g>
      {/* 腿 */}
      <path d={`M-5.6 -26c0 8-.4 14-.8 ${10 - swing * 5}`} stroke={SKIN_SHADE} strokeWidth="5.6" fill="none" strokeLinecap="round" />
      <path d={`M5.6 -26c0 8 .4 14 .8 ${10 + swing * 5}`} stroke={SKIN_SHADE} strokeWidth="5.6" fill="none" strokeLinecap="round" />
      <path d="M-9.4 -2.2h7.2M2.2 -2.2h7.2" stroke={UNIFORM_SHADE} strokeWidth="3" strokeLinecap="round" />
      {/* 裙 */}
      <path d="M-12 -54h24l7.6 22c-6.2 4.2-12.6 6-19.8 6S-15.4 -27.8-19.6 -32Z" fill={UNIFORM} stroke={LINE} strokeWidth="0.9" strokeLinejoin="round" />
      <path d="M-6 -54l-2.4 26M0 -54v26M6 -54l2.4 26" stroke={UNIFORM_SHADE} strokeWidth="0.9" opacity="0.5" />
      <path d="M0 -54h12l7.6 22c-3.2 2.2-7 3.8-11.6 4.6Z" fill={UNIFORM_SHADE} opacity="0.4" />
      {/* 上衣 */}
      <path d="M-12 -86h24l1.6 34h-27.2Z" fill={TRIM} stroke={LINE} strokeWidth="0.9" strokeLinejoin="round" />
      <path d="M2 -86h10l1.6 34h-13Z" fill={TRIM_SHADE} opacity="0.65" />
      {/* 水手领 */}
      <path d="M-12 -86h24l-4 6-8 9-8-9Z" fill={UNIFORM} stroke={LINE} strokeWidth="0.9" strokeLinejoin="round" />
      <path d="M-8 -86 0 -71l8-15" fill="none" stroke={GOLD} strokeWidth="0.9" opacity="0.85" />
      <path d="M-4.8 -73.6 0 -70l4.8-3.6-1.1 6.6L0 -65.6l-3.7-1.4Z" fill={RIBBON} stroke={LINE} strokeWidth="0.6" />
      {/* 手臂 */}
      <path d={`M-11 -82c-3 8-4 16-4 ${22 - swing * 7}`} stroke={TRIM} strokeWidth="6.6" fill="none" strokeLinecap="round" />
      <path d={`M11 -82c3 8 4 16 4 ${22 + swing * 7}`} stroke={TRIM} strokeWidth="6.6" fill="none" strokeLinecap="round" />
      <path d={`M-14.4 -67c-.9 .9-1.5 2.2-1.6 3.6`} stroke={TRIM_SHADE} strokeWidth="1.6" fill="none" opacity="0.5" />
      <circle cx="-15" cy={-60 + swing * 7} r="2.6" fill={SKIN} stroke={LINE} strokeWidth="0.6" />
      <circle cx="15" cy={-60 - swing * 7} r="2.6" fill={SKIN} stroke={LINE} strokeWidth="0.6" />
    </g>
  );
}

/** 一个角色：脚底在 (0,0)，头顶约 -127。 */
function Figure({ kind, hair, swing = 0 }: { kind: FigureKind; hair: HairKind; swing?: number }) {
  return (
    <g>
      <Outfit kind={kind} swing={swing} />
      {/* 脖子 */}
      <path d="M-3.4 -96h6.8v10h-6.8Z" fill={SKIN_SHADE} />
      <path d="M-3.4 -96h6.8v3.4h-6.8Z" fill={SKIN} opacity="0.45" />
      {/* 头 */}
      <g transform="translate(0 -106)">
        <Hair kind={hair} />
        <Face />
      </g>
    </g>
  );
}

function Placed({ x, y, scale = 1, flip = 1, children }: { x: number; y: number; scale?: number; flip?: 1 | -1; children: ReactNode }) {
  return <g transform={`translate(${x} ${y}) scale(${flip * scale} ${scale})`}>{children}</g>;
}

function CampusGate({ x, y, scale = 1, opacity = 0.3 }: { x: number; y: number; scale?: number; opacity?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} fill="none" stroke={GOLD} strokeWidth="2" opacity={opacity}>
      <path d="M0 0h150" strokeWidth="2.6" />
      <path d="M-9 -4h168" strokeWidth="1.4" opacity="0.75" />
      <path d="M6 6h138" strokeWidth="1" opacity="0.5" />
      <path d="M14 8v72M136 8v72" />
      <path d="M22 8v72M128 8v72" opacity="0.5" />
      <path d="M14 40h122" strokeWidth="1.4" opacity="0.8" />
      <path d="M44 20h62" strokeWidth="1" opacity="0.4" />
    </g>
  );
}

function Ginkgo({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 56c4-14 2-26-2-38" stroke={HAIR_SHADE} strokeWidth="4.4" fill="none" strokeLinecap="round" />
      <circle cx="-2" cy="-6" r="30" fill={HAIR} opacity="0.85" />
      <circle cx="-27" cy="8" r="21" fill={HAIR} opacity="0.75" />
      <circle cx="22" cy="6" r="24" fill={HAIR} opacity="0.8" />
      <circle cx="4" cy="-26" r="17" fill={HAIR} opacity="0.7" />
      <path d="M-18 -18c6-8 16-11 26-8" stroke={HAIR_LIGHT} strokeWidth="2" fill="none" opacity="0.35" strokeLinecap="round" />
    </g>
  );
}

function Leaf({ x, y, r = 0, s = 1 }: { x: number; y: number; r?: number; s?: number }) {
  return <path transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`} d="M0 -5 L5 0 L0 5 L-5 0 Z" fill={GOLD_LIGHT} opacity="0.9" stroke={GOLD} strokeWidth="0.5" />;
}

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

/** 霜降雅集：银杏下的少年少女。 */
export function FestivalScene({ className = '' }: { className?: string }) {
  const id = useId();
  return (
    <svg className={`event-scene ${className}`} viewBox="0 0 460 210" role="img" aria-label="霜降雅集：银杏树下，少年执卷、少女提灯，一同游园">
      <defs>
        <radialGradient id={`${id}-glow`} cx="50%" cy="64%" r="66%">
          <stop offset="0%" stopColor="#f7e2ab" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#f7e2ab" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="460" height="210" fill={`url(#${id}-glow)`} />
      <CampusGate x={128} y={26} scale={1.06} opacity={0.2} />
      <Ginkgo x={372} y={150} />
      {[[314, 92, 14], [338, 66, -8], [398, 84, 30], [414, 120, 12], [298, 122, -20], [430, 66, 5], [350, 130, 40], [388, 140, -14], [322, 146, 22]].map(([x, y, r], i) => (
        <Leaf key={i} x={x} y={y} r={r} s={i % 3 === 0 ? 1.25 : 1} />
      ))}
      <path d="M28 192h404" stroke={LINE} strokeWidth="1.4" opacity="0.26" />
      <ellipse cx="212" cy="192" rx="74" ry="7" fill={LINE} opacity="0.1" />
      <Placed x={184} y={192} scale={1.12}>
        <Figure kind="boy" hair="short" />
      </Placed>
      <Placed x={248} y={192} scale={1.12} flip={-1}>
        <Figure kind="girl" hair="twin" />
      </Placed>
      <g transform="translate(56 32)">
        <rect x="-19" y="-15" width="38" height="30" rx="2" fill={RIBBON} opacity="0.92" />
        <text x="0" y="5" textAnchor="middle" fontSize="13" fill={CREAM} fontFamily="'Ma Shan Zheng', serif">霜降</text>
      </g>
    </svg>
  );
}

/** 多人同行：三位同学结伴前行。 */
export function CompanyScene({ className = '' }: { className?: string }) {
  const id = useId();
  return (
    <svg className={`event-scene ${className}`} viewBox="0 0 460 210" role="img" aria-label="多人同行：同学们结伴走过校园，背景是齿轮与星轨">
      <defs>
        <radialGradient id={`${id}-glow2`} cx="52%" cy="66%" r="62%">
          <stop offset="0%" stopColor="#cfe0c6" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#cfe0c6" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="460" height="210" fill={`url(#${id}-glow2)`} />
      <Gear x={74} y={86} r={40} opacity={0.3} />
      <StarTrail x={258} y={50} />
      <CampusGate x={292} y={90} scale={0.78} opacity={0.16} />
      <path d="M26 192h408" stroke={LINE} strokeWidth="1.4" opacity="0.26" />
      <ellipse cx="214" cy="192" rx="96" ry="8" fill={LINE} opacity="0.1" />
      <Placed x={146} y={192} scale={1.0}>
        <Figure kind="boy" hair="short" swing={0.5} />
      </Placed>
      <Placed x={204} y={192} scale={1.04} flip={-1}>
        <Figure kind="girl" hair="long" swing={-0.4} />
      </Placed>
      <Placed x={258} y={192} scale={1.0} flip={-1}>
        <Figure kind="boy" hair="short" swing={-0.3} />
      </Placed>
      <g opacity="0.5" stroke={GOLD} strokeWidth="1.3" fill="none">
        <path d="M282 156c26-4 46 2 62 12" />
        <path d="M306 144l4 9 9 4-9 4-4 9-4-9-9-4 9-4Z" fill={GOLD_LIGHT} stroke="none" />
      </g>
      <g transform="translate(58 156)">
        <rect x="-28" y="-11" width="56" height="22" rx="2" fill={RIBBON} opacity="0.9" />
        <text x="0" y="5" textAnchor="middle" fontSize="11" letterSpacing="2" fill={CREAM} fontFamily="'Noto Serif SC', serif">同行</text>
      </g>
    </svg>
  );
}
