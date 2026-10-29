/**
 * 地图左右空带的国风山水（第二版：受光侧金边、冠形变化、纸面颗粒）。
 *
 * - 四种云朵冠形轮流使用，树冠不再像盖章重复
 * - 岩石金边改为渐变描边，只亮受光侧，不是均匀一圈
 * - 每个色块先铺一圈偏移深色，形成内部暗部，画面有厚度
 * - 全幅叠一层 feTurbulence 颗粒，去掉纯矢量的塑料感
 * - 只铺左右两条竖带，内侧蒙版化开
 */
import { useId } from 'react';

const C = {
  deep: '#28513f',
  deepShadow: '#1c3d33',
  green: '#3e6d58',
  mid: '#5c8871',
  hazy: '#8fb097',
  light: '#9dc196',
  gold: '#d9bd85',
  goldFill: '#d3b263',
  goldDeep: '#a8873c',
  maple: '#d9451f',
  mapleLight: '#ef7b45',
  cream: '#f4ecd6',
  teal: '#4f9f96',
  tealLight: '#a3d2c2',
  ink: '#1f3d34',
  trunk: '#54463a'
};

/** 四种云朵冠形，轮流用，避免重复。 */
const CROWNS = [
  'M-56 2c-13-2-22-15-18-29 4-14 17-23 31-21 0-16 15-29 31-29 15 0 27 10 30 23 16-3 30 9 31 24 1 13-9 24-23 26-25 7-60 8-82 6Z',
  'M-58 4c-14 0-24-12-21-26 3-15 17-25 32-23-1-16 13-29 30-30 16-1 29 9 32 23 16-4 31 8 32 24 1 14-10 25-24 27-26 7-60 7-81 5Z',
  'M-54 3c-13-3-21-16-17-29 4-13 16-22 30-21 1-16 15-28 31-28 15 0 26 9 29 22 15-2 28 9 29 23 1 13-9 24-22 26-24 7-58 9-80 7Z',
  'M-56 3c-14-1-23-14-19-28 3-14 16-23 30-22-1-15 14-28 30-28 16-1 28 9 31 22 16-3 30 8 31 23 1 13-9 24-23 26-25 8-60 9-80 7Z'
];

function Canopy({ y, w = 1, v = 0, fill = C.deep, shadow = C.deepShadow }: { y: number; w?: number; v?: number; fill?: string; shadow?: string }) {
  const d = CROWNS[v % CROWNS.length];
  return (
    <g transform={`translate(0 ${y}) scale(${w})`}>
      {/* 内阴影：同形下移，露在下缘形成厚度 */}
      <g transform="translate(2 7) scale(0.95)">
        <path d={d} fill={shadow} />
      </g>
      <path d={d} fill={fill} />
      {/* 冠面高光 */}
      <path d="M-44 -6c-6-3-9-9-7-16 2-8 9-13 17-13-2-11 8-19 19-19 8 0 15 5 18 13" fill="none" stroke={C.light} strokeWidth="3" opacity="0.55" strokeLinecap="round" />
      {/* 冠底线（金） */}
      <path d="M-58 4c26 9 70 9 96 1" fill="none" stroke={C.gold} strokeWidth="2.2" opacity="0.9" strokeLinecap="round" />
      {/* 叶簇质感点 */}
      <g fill={C.light} opacity="0.28">
        <circle cx="-30" cy="-16" r="2.2" />
        <circle cx="-6" cy="-30" r="2.6" />
        <circle cx="22" cy="-14" r="2.2" />
        <circle cx="6" cy="-6" r="1.8" />
      </g>
    </g>
  );
}

function Pine({ x, y, s = 1, flip = 1, seed = 0 }: { x: number; y: number; s?: number; flip?: 1 | -1; seed?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip * s} ${s})`}>
      <path d="M0 0c5-28 5-52 0-76" stroke={C.trunk} strokeWidth="7.5" fill="none" strokeLinecap="round" />
      <path d="M-1 -48c-11 5-19 13-23 24M1 -36c11 5 19 12 25 22" stroke={C.trunk} strokeWidth="3.6" fill="none" strokeLinecap="round" />
      <Canopy y={-70} w={1.02} v={seed} fill={C.deep} />
      <Canopy y={-116} w={0.78} v={seed + 1} fill={C.green} />
      <Canopy y={-154} w={0.54} v={seed + 2} fill={C.deep} />
    </g>
  );
}

function Cliff({ d, fill, rim }: { d: string; fill: string; rim: string }) {
  return (
    <g>
      <path d={d} fill={fill} />
      {/* 内部暗面 */}
      <g transform="translate(-6 -4) scale(0.985)" opacity="0.35">
        <path d={d} fill={C.deepShadow} />
      </g>
      <path d={d} fill="none" stroke={`url(#${rim})`} strokeWidth="3" strokeLinejoin="round" />
    </g>
  );
}

function GoldBush({ x, y, s = 1, rot = 0 }: { x: number; y: number; s?: number; rot?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s}) rotate(${rot})`}>
      <g transform="translate(2 5) scale(0.95)"><path d={CROWNS[1]} fill={C.goldDeep} opacity="0.5" /></g>
      <g transform="scale(0.64)"><path d={CROWNS[0]} fill={C.goldFill} /></g>
      <path d="M-40 6c20 7 52 7 72 0" fill="none" stroke={C.goldDeep} strokeWidth="1.8" opacity="0.6" strokeLinecap="round" />
      <g fill={C.cream} opacity="0.5">
        <circle cx="-14" cy="-4" r="1.8" />
        <circle cx="10" cy="-10" r="1.6" />
        <circle cx="24" cy="0" r="1.4" />
      </g>
    </g>
  );
}

function MapleLeaf({ x, y, r = 0, s = 1, color = C.maple }: { x: number; y: number; r?: number; s?: number; color?: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <path d="M0 -13 4 -4 13 -7 8 0 14 5 5 5 5 13 0 8-5 13-5 5-14 5-8 0-13 -7-4 -4Z" fill={color} />
      <path d="M-2 -6 0 8" stroke={C.mapleLight} strokeWidth="1.2" opacity="0.7" strokeLinecap="round" />
      <path d="M0 8v7" stroke={C.trunk} strokeWidth="1.6" strokeLinecap="round" />
    </g>
  );
}

/** 草丛：几笔尖叶。 */
function Grass({ x, y, s = 1, flip = 1 }: { x: number; y: number; s?: number; flip?: 1 | -1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip * s} ${s})`} stroke={C.ink} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.75">
      <path d="M0 0c2-10 1-18-2-26M6 0c3-12 7-20 12-26M-6 0c-2-9-6-15-11-20" />
    </g>
  );
}

function Defs({ id, side }: { id: string; side: 'l' | 'r' }) {
  return (
    <defs>
      <linearGradient id={`${id}-rim`} x1={side === 'l' ? '0' : '1'} y1="0" x2={side === 'l' ? '1' : '0'} y2="0.2">
        <stop offset="0%" stopColor={C.gold} stopOpacity="0" />
        <stop offset="45%" stopColor={C.gold} stopOpacity="0.5" />
        <stop offset="100%" stopColor={C.gold} stopOpacity="1" />
      </linearGradient>
      <filter id={`${id}-soft`} x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="13" />
      </filter>
      <filter id={`${id}-grain`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
    </defs>
  );
}

function Grain({ id }: { id: string }) {
  return <rect width="240" height="1080" filter={`url(#${id}-grain)`} opacity="0.12" style={{ mixBlendMode: 'multiply' }} />;
}

function LeftArt({ id }: { id: string }) {
  return (
    <g>
      <Defs id={id} side="l"/>
      {/* 远山淡影 */}
      <path d="M0 0h84c-16 92-12 182 8 268 14 60 8 118-16 166L0 470Z" fill={C.hazy} opacity="0.45" />
      {/* 顶部探出大枝 */}
      <path d="M0 88c54 10 98 36 130 76" stroke={C.trunk} strokeWidth="10" fill="none" strokeLinecap="round" />
      <path d="M58 106c18-10 32-26 42-44" stroke={C.trunk} strokeWidth="5.4" fill="none" strokeLinecap="round" />
      <Pine x={70} y={132} s={1.28} seed={0}/>
      <Pine x={150} y={196} s={0.8} seed={2} flip={-1}/>
      <MapleLeaf x={168} y={132} r={18} s={1.15}/>
      <MapleLeaf x={140} y={104} r={-8} s={0.9} color={C.mapleLight}/>
      {/* 后层岩体 */}
      <Cliff fill={C.green} rim={`${id}-rim`}
        d="M0 150c60 6 100 42 112 100 12 62-8 120-46 158-30 32-46 74-40 120 6 44 30 78 62 100v166H0Z" />
      {/* 前层岩体 */}
      <Cliff fill={C.deep} rim={`${id}-rim`}
        d="M0 416c74 14 110 66 116 136 6 66-22 122-64 158-34 30-50 72-42 118 8 46 34 80 66 104v148H0Z" />
      <Pine x={96} y={568} s={1.06} seed={1}/>
      <Pine x={136} y={716} s={0.7} seed={3} flip={-1}/>
      <GoldBush x={104} y={642} s={1.05}/>
      <GoldBush x={64} y={880} s={1.15} rot={-6}/>
      <Grass x={44} y={928} s={1.1}/>
      <Grass x={112} y={600} s={0.9} flip={-1}/>
      {/* 枫枝 */}
      <path d="M0 758c48-16 90-10 126 16" stroke={C.trunk} strokeWidth="4.4" fill="none" strokeLinecap="round" />
      <path d="M64 752c6-12 8-24 6-36" stroke={C.trunk} strokeWidth="2.8" fill="none" strokeLinecap="round" />
      <MapleLeaf x={120} y={784} r={14} s={1.7}/>
      <MapleLeaf x={94} y={756} r={-16} s={1.3}/>
      <MapleLeaf x={142} y={794} r={26} s={1.2} color={C.mapleLight}/>
      <MapleLeaf x={72} y={728} r={8} s={0.95}/>
      {/* 水与奶油卷 */}
      <path d="M0 1006h158c-20 26-32 54-36 74H0Z" fill={C.teal} opacity="0.92" />
      <path d="M0 1020c42 8 84 24 118 46" stroke={C.tealLight} strokeWidth="2.4" fill="none" opacity="0.85" />
      <path d="M0 1050c30 6 62 18 90 30" stroke={C.tealLight} strokeWidth="2" fill="none" opacity="0.6" />
      <path d="M0 972c28 10 46 32 50 58-18 8-38 4-50-8Z" fill={C.cream} opacity="0.92" />
      <g className="scn-mist-v" opacity="0.68" filter={`url(#${id}-soft)`}>
        <ellipse cx="88" cy="330" rx="96" ry="26" fill={C.cream} />
        <ellipse cx="58" cy="826" rx="86" ry="24" fill={C.cream} />
      </g>
      <Grain id={id}/>
    </g>
  );
}

function RightArt({ id }: { id: string }) {
  return (
    <g>
      <Defs id={id} side="r"/>
      <path d="M240 0h-80c16 96 12 186-8 272-14 58-8 116 16 164l72 34Z" fill={C.hazy} opacity="0.42" />
      {/* 顶部探出大枝 */}
      <path d="M240 70c-56 12-100 40-132 80" stroke={C.trunk} strokeWidth="10" fill="none" strokeLinecap="round" />
      <path d="M184 88c-18-10-32-26-42-44" stroke={C.trunk} strokeWidth="5.4" fill="none" strokeLinecap="round" />
      <Pine x={168} y={112} s={1.24} seed={2} flip={-1}/>
      <Pine x={96} y={178} s={0.78} seed={0}/>
      <MapleLeaf x={78} y={124} r={-18} s={1.1}/>
      <MapleLeaf x={108} y={96} r={10} s={0.9} color={C.mapleLight}/>
      {/* 后层岩体 */}
      <Cliff fill={C.green} rim={`${id}-rim`}
        d="M240 132c-56 8-94 46-104 104-10 60 10 116 46 154 30 32 46 74 40 120-6 44-30 78-62 100v164h80Z" />
      {/* 前层岩体 */}
      <Cliff fill={C.deep} rim={`${id}-rim`}
        d="M240 474c-68 16-102 68-108 138-6 64 22 118 62 154 34 30 50 72 42 118-8 44-34 78-66 102v94h70Z" />
      <Pine x={144} y={420} s={1} seed={1} flip={-1}/>
      <Pine x={110} y={652} s={0.72} seed={3}/>
      <GoldBush x={146} y={608} s={1.1} rot={4}/>
      <GoldBush x={132} y={858} s={0.95} rot={-4}/>
      <Grass x={196} y={900} s={1.1} flip={-1}/>
      <Grass x={130} y={686} s={0.85}/>
      {/* 枫枝（偏上） */}
      <path d="M240 206c-48-14-90-6-124 22" stroke={C.trunk} strokeWidth="4.4" fill="none" strokeLinecap="round" />
      <path d="M178 224c-6-12-8-24-6-36" stroke={C.trunk} strokeWidth="2.8" fill="none" strokeLinecap="round" />
      <MapleLeaf x={114} y={230} r={-18} s={1.55}/>
      <MapleLeaf x={142} y={206} r={12} s={1.25} color={C.mapleLight}/>
      <MapleLeaf x={98} y={206} r={30} s={1.1}/>
      <MapleLeaf x={162} y={242} r={-6} s={0.95}/>
      {/* 水与奶油卷 */}
      <path d="M240 1010h-152c18 26 30 52 34 70h118Z" fill={C.teal} opacity="0.92" />
      <path d="M240 1024c-42 8-82 22-114 44" stroke={C.tealLight} strokeWidth="2.4" fill="none" opacity="0.85" />
      <path d="M240 1052c-30 6-60 16-88 28" stroke={C.tealLight} strokeWidth="2" fill="none" opacity="0.6" />
      <path d="M240 976c-28 10-46 32-50 58 18 8 38 4 50-8Z" fill={C.cream} opacity="0.92" />
      <g className="scn-mist-v" opacity="0.68" filter={`url(#${id}-soft)`}>
        <ellipse cx="152" cy="356" rx="96" ry="26" fill={C.cream} />
        <ellipse cx="182" cy="816" rx="86" ry="24" fill={C.cream} />
      </g>
      <Grain id={id}/>
    </g>
  );
}

export function Scenery() {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <div className="scenery" aria-hidden="true">
      <div className="scenery-side side-left">
        <svg className="side-svg" viewBox="0 0 240 1080" preserveAspectRatio="xMidYMid slice">
          <LeftArt id={`l${id}`}/>
        </svg>
      </div>
      <div className="scenery-side side-right">
        <svg className="side-svg" viewBox="0 0 240 1080" preserveAspectRatio="xMidYMid slice">
          <RightArt id={`r${id}`}/>
        </svg>
      </div>
    </div>
  );
}
