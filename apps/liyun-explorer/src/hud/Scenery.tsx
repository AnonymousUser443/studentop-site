/**
 * 地图左右空带的国风山水（照「一笺霜信」的画法重绘）。
 *
 * 画法要点：
 * - 平涂色块 + 明暗两级绿拉开层次，不靠渐变堆细节
 * - 岩石轮廓走一圈金色勾边，这是国风插画最有质感的一笔
 * - 松冠是云朵状的分层扇面，冠下留一条奶油色空隙
 * - 朱红枫叶、金叶丛做点缀，奶油底子留白
 * - 只铺左右两条竖带，内侧用蒙版化开，不遮挡地图
 */
import { useId } from 'react';

const C = {
  deep: '#2b5447',
  green: '#3e6d58',
  mid: '#5b8770',
  light: '#88ae86',
  gold: '#d9bd85',
  goldFill: '#d3b263',
  goldDeep: '#ab8a3f',
  maple: '#dd4a2b',
  mapleLight: '#ef7b45',
  cream: '#f3ead0',
  teal: '#4f9f96',
  tealLight: '#98c9ba',
  ink: '#23443a',
  trunk: '#5b4a37'
};

/** 云朵状松冠：扇面轮廓 + 金色冠底线。 */
function Canopy({ y, w = 1, fill = C.deep, light = C.light }: { y: number; w?: number; fill?: string; light?: string }) {
  return (
    <g transform={`translate(0 ${y}) scale(${w})`}>
      <path
        d="M-54 2c-12-3-20-15-17-28 3-14 16-23 30-21 0-16 14-28 30-28 14 0 26 9 29 22 15-3 29 8 30 23 1 13-9 24-22 26-24 7-58 8-80 6Z"
        fill={fill}
      />
      <path
        d="M-46 -4c-7-2-11-9-10-17 1-9 9-16 18-16-2-12 8-21 20-21 9 0 17 6 20 15"
        fill="none" stroke={light} strokeWidth="3.2" opacity="0.7" strokeLinecap="round"
      />
      <path d="M-56 4c24 8 66 9 92 2" fill="none" stroke={C.gold} strokeWidth="2.2" opacity="0.85" strokeLinecap="round" />
    </g>
  );
}

/** 一棵松：树干 + 三层冠。 */
function Pine({ x, y, s = 1, flip = 1 }: { x: number; y: number; s?: number; flip?: 1 | -1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip * s} ${s})`}>
      <path d="M0 0c4-26 4-50 0-74" stroke={C.trunk} strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M-2 -44c-10 4-18 12-22 22M2 -34c10 4 18 10 24 20" stroke={C.trunk} strokeWidth="3.4" fill="none" strokeLinecap="round" />
      <Canopy y={-66} w={1} fill={C.deep} />
      <Canopy y={-112} w={0.76} fill={C.green} />
      <Canopy y={-150} w={0.52} fill={C.deep} />
    </g>
  );
}

/** 岩石块：平涂 + 金边 + 亮面。 */
function Cliff({ d, fill, shine }: { d: string; fill: string; shine?: string }) {
  return (
    <g>
      <path d={d} fill={fill} />
      {shine && <path d={shine} fill={C.light} opacity="0.3" />}
      <path d={d} fill="none" stroke={C.gold} strokeWidth="2.6" strokeLinejoin="round" opacity="0.92" />
    </g>
  );
}

/** 金叶丛：扇贝状的一团。 */
function GoldBush({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-34 2c-9-7-11-20-3-29 4-13 19-20 32-16 8-10 25-10 34 1 13-2 24 8 25 21 1 11-8 20-20 22-20 5-49 4-68 1Z" fill={C.goldFill} />
      <path d="M-26 -6c-5-4-7-11-3-16" fill="none" stroke={C.goldDeep} strokeWidth="2" opacity="0.55" strokeLinecap="round" />
      <path d="M-32 4c18 6 46 6 64 1" fill="none" stroke={C.goldDeep} strokeWidth="1.8" opacity="0.6" strokeLinecap="round" />
    </g>
  );
}

/** 五角枫叶。 */
function MapleLeaf({ x, y, r = 0, s = 1, color = C.maple }: { x: number; y: number; r?: number; s?: number; color?: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <path d="M0 -13 4 -4 13 -7 8 0 14 5 5 5 5 13 0 8-5 13-5 5-14 5-8 0-13 -7-4 -4Z" fill={color} />
      <path d="M0 8v7" stroke={C.trunk} strokeWidth="1.6" strokeLinecap="round" />
    </g>
  );
}

function Defs({ id }: { id: string }) {
  return (
    <defs>
      <filter id={`${id}-soft`} x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="13" />
      </filter>
    </defs>
  );
}

function LeftArt({ id }: { id: string }) {
  return (
    <g>
      <Defs id={id}/>
      {/* 顶部探出的大枝 */}
      <path d="M0 92c52 8 96 32 128 70" stroke={C.trunk} strokeWidth="9" fill="none" strokeLinecap="round" />
      <path d="M56 108c16-10 30-24 40-42" stroke={C.trunk} strokeWidth="5" fill="none" strokeLinecap="round" />
      <g transform="translate(80 120)"><Canopy y={0} w={1.5} fill={C.deep} /></g>
      <g transform="translate(132 172)"><Canopy y={0} w={1.05} fill={C.green} /></g>
      <MapleLeaf x={150} y={128} r={18} s={1.1} />
      <MapleLeaf x={126} y={104} r={-8} s={0.9} color={C.mapleLight} />
      {/* 顶部探出的大枝 */}
      <path d="M240 74c-54 10-98 36-130 76" stroke={C.trunk} strokeWidth="9" fill="none" strokeLinecap="round" />
      <path d="M182 92c-16-10-30-24-40-42" stroke={C.trunk} strokeWidth="5" fill="none" strokeLinecap="round" />
      <g transform="translate(158 104)"><Canopy y={0} w={1.45} fill={C.deep} /></g>
      <g transform="translate(108 158)"><Canopy y={0} w={1} fill={C.green} /></g>
      <MapleLeaf x={92} y={112} r={-18} s={1.05} />
      <MapleLeaf x={118} y={88} r={10} s={0.9} color={C.mapleLight} />
      {/* 远层山影 */}
      <path d="M0 0h96c-18 86-14 172 8 254 16 60 12 118-12 168L0 452Z" fill={C.mid} opacity="0.42" />
      {/* 后层岩体 */}
      <Cliff
        fill={C.green}
        d="M0 146c58 6 98 40 110 98 12 62-8 120-46 158-30 32-46 74-40 120 6 44 30 78 62 100v166H0Z"
        shine="M0 180c40 10 70 36 84 72-30 10-60 2-84-16Z"
      />
      {/* 前层岩体（金边） */}
      <Cliff
        fill={C.deep}
        d="M0 412c72 14 108 64 114 134 6 66-22 122-64 158-34 30-50 72-42 118 8 46 34 80 66 104v154H0Z"
        shine="M0 448c44 12 74 44 84 88-30 8-58 0-84-18Z"
      />
      {/* 松与金叶 */}
      <Pine x={90} y={556} s={1.02} />
      <Pine x={124} y={700} s={0.66} flip={-1} />
      <GoldBush x={96} y={634} s={0.92} />
      <GoldBush x={70} y={862} s={1.08} />
      {/* 枫枝 */}
      <path d="M0 754c46-16 88-10 124 14" stroke={C.trunk} strokeWidth="4.2" fill="none" strokeLinecap="round" />
      <path d="M62 748c6-12 8-24 6-36" stroke={C.trunk} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <MapleLeaf x={118} y={780} r={14} s={1.6} />
      <MapleLeaf x={92} y={754} r={-16} s={1.25} />
      <MapleLeaf x={140} y={790} r={26} s={1.15} color={C.mapleLight} />
      <MapleLeaf x={70} y={726} r={8} s={0.95} />
      {/* 水 */}
      <path d="M0 1004h156c-20 26-32 54-36 76H0Z" fill={C.teal} opacity="0.9" />
      <path d="M0 1018c42 8 84 24 118 46" stroke={C.tealLight} strokeWidth="2.4" fill="none" opacity="0.8" />
      <path d="M0 1048c30 6 62 18 90 32" stroke={C.tealLight} strokeWidth="2" fill="none" opacity="0.55" />
      {/* 奶油卷 */}
      <path d="M0 972c28 10 46 32 50 58-18 8-38 4-50-8Z" fill={C.cream} opacity="0.9" />
      {/* 雾 */}
      <g className="scn-mist-v" opacity="0.7" filter={`url(#${id}-soft)`}>
        <ellipse cx="88" cy="326" rx="96" ry="26" fill={C.cream} />
        <ellipse cx="58" cy="824" rx="86" ry="24" fill={C.cream} />
      </g>
    </g>
  );
}

function RightArt({ id }: { id: string }) {
  return (
    <g>
      <Defs id={id}/>
      {/* 远层山影 */}
      <path d="M240 0h-92c18 90 14 176-8 258-16 58-12 116 12 166l88 30Z" fill={C.mid} opacity="0.4" />
      {/* 后层岩体 */}
      <Cliff
        fill={C.green}
        d="M240 128c-54 8-92 44-102 102-10 60 10 116 46 154 30 32 46 74 40 120-6 44-30 78-62 100v168h78Z"
        shine="M240 164c-36 12-64 40-76 78 28 8 56 0 76-18Z"
      />
      {/* 前层岩体（金边） */}
      <Cliff
        fill={C.deep}
        d="M240 470c-66 16-100 66-106 136-6 64 22 118 62 154 34 30 50 72 42 118-8 44-34 78-66 102v100h68Z"
        shine="M240 506c-40 14-68 46-78 90 28 8 54 0 78-18Z"
      />
      {/* 松与金叶 */}
      <Pine x={148} y={404} s={0.95} flip={-1} />
      <Pine x={112} y={636} s={0.72} />
      <GoldBush x={148} y={596} s={1} />
      <GoldBush x={128} y={846} s={0.9} />
      {/* 枫枝（偏上） */}
      <path d="M240 214c-46-14-88-6-122 20" stroke={C.trunk} strokeWidth="4.2" fill="none" strokeLinecap="round" />
      <path d="M176 232c-6-12-8-24-6-36" stroke={C.trunk} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <MapleLeaf x={112} y={238} r={-18} s={1.5} />
      <MapleLeaf x={140} y={214} r={12} s={1.2} color={C.mapleLight} />
      <MapleLeaf x={96} y={214} r={30} s={1.05} />
      <MapleLeaf x={160} y={250} r={-6} s={0.9} />
      {/* 水 */}
      <path d="M240 1008h-150c18 26 30 52 34 72h116Z" fill={C.teal} opacity="0.9" />
      <path d="M240 1022c-42 8-82 22-114 44" stroke={C.tealLight} strokeWidth="2.4" fill="none" opacity="0.8" />
      <path d="M240 1050c-30 6-60 16-88 30" stroke={C.tealLight} strokeWidth="2" fill="none" opacity="0.55" />
      {/* 奶油卷 */}
      <path d="M240 976c-28 10-46 32-50 58 18 8 38 4 50-8Z" fill={C.cream} opacity="0.9" />
      {/* 雾 */}
      <g className="scn-mist-v" opacity="0.7" filter={`url(#${id}-soft)`}>
        <ellipse cx="152" cy="352" rx="96" ry="26" fill={C.cream} />
        <ellipse cx="182" cy="812" rx="86" ry="24" fill={C.cream} />
      </g>
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
