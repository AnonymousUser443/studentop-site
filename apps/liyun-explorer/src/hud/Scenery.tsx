/**
 * 地图左右空带的国风山水（第三版：照「一笺霜信」那张参考图的结构重画）。
 *
 * 参考图的四件套：
 * 1. 墨绿山体，山脊上压两三条**金色勾线**（不是描边，是画在里面的线）
 * 2. **大片金色银杏枝**从画外探进来，扇形叶一簇簇
 * 3. **奶油云卷**贴边打卷，给画面留白与层次
 * 4. 朱红点缀（流苏、枫叶），并与米白纸面留白呼应
 *
 * 依旧只铺左右两条竖带，内侧用蒙版化开，不遮挡地图上下。
 */
import { useId, useState } from 'react';

const V = {
  ink: '#1d3b32',
  deep: '#274e40',
  mid: '#3a6a55',
  pale: '#6f9d7f',
  sky: '#8fb097',
  gold: '#e0c179',
  goldLine: '#d8b065',
  goldDeep: '#b98f3f',
  cream: '#f7f0da',
  red: '#c2452c',
  redLight: '#e2703f',
  teal: '#4f9f96',
  tealLight: '#a6d3c3',
  trunk: '#4a3c2c',
  paper: 'transparent'
};

/** 扇形银杏叶。 */
function FanLeaf({ x, y, r = 0, s = 1, fill = V.gold, line = V.goldDeep }: { x: number; y: number; r?: number; s?: number; fill?: string; line?: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <path d="M0 11c-15-3-21-14-17-24 4-11 17-16 17-16s13 5 17 16c4 10-2 21-17 24Z" fill={fill} stroke={line} strokeWidth="0.9" />
      <path d="M0 11V-22M0 4-10-10M0 4 10-10M0 -6-5-18M0 -6 5-18" stroke={line} strokeWidth="0.7" opacity="0.55" fill="none" />
    </g>
  );
}

/** 一簇银杏：三到五片，错落角度。 */
function FanCluster({ x, y, s = 1, flip = 1 }: { x: number; y: number; s?: number; flip?: 1 | -1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip * s} ${s})`}>
      <FanLeaf x={-16} y={6} r={-22} s={0.95} />
      <FanLeaf x={14} y={4} r={20} s={0.9} />
      <FanLeaf x={0} y={-8} r={2} s={1.05} />
      <FanLeaf x={-2} y={16} r={-4} s={0.75} fill={V.goldLine} />
    </g>
  );
}

/** 云朵状松冠。 */
function Canopy({ y, w = 1, fill = V.deep, shadow = V.ink }: { y: number; w?: number; fill?: string; shadow?: string }) {
  const d = 'M-56 2c-13-2-22-15-18-29 4-14 17-23 31-21 0-16 15-29 31-29 15 0 27 10 30 23 16-3 30 9 31 24 1 13-9 24-23 26-25 7-60 8-82 6Z';
  return (
    <g transform={`translate(0 ${y}) scale(${w})`}>
      <g transform="translate(2 7) scale(0.95)"><path d={d} fill={shadow} /></g>
      <path d={d} fill={fill} />
      <path d="M-44 -6c-6-3-9-9-7-16 2-8 9-13 17-13-2-11 8-19 19-19 8 0 15 5 18 13" fill="none" stroke={V.pale} strokeWidth="3" opacity="0.5" strokeLinecap="round" />
      <path d="M-58 4c26 9 70 9 96 1" fill="none" stroke={V.goldLine} strokeWidth="2" opacity="0.85" strokeLinecap="round" />
    </g>
  );
}

function Pine({ x, y, s = 1, flip = 1 }: { x: number; y: number; s?: number; flip?: 1 | -1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip * s} ${s})`}>
      <path d="M0 0c5-28 5-52 0-76" stroke={V.trunk} strokeWidth="8" fill="none" strokeLinecap="round" />
      <path d="M-1 -48c-11 5-19 13-23 24M1 -36c11 5 19 12 25 22" stroke={V.trunk} strokeWidth="3.6" fill="none" strokeLinecap="round" />
      <Canopy y={-70} w={1.04} fill={V.deep} />
      <Canopy y={-118} w={0.78} fill={V.mid} />
      <Canopy y={-156} w={0.54} fill={V.deep} />
    </g>
  );
}

/** 山体：主面 + 暗面 + 山脊上的金色勾线。 */
function Mountain({ d, fill, lines }: { d: string; fill: string; lines: string[] }) {
  return (
    <g>
      <path d={d} fill={fill} />
      <g transform="translate(-7 -5) scale(0.982)" opacity="0.4"><path d={d} fill={V.ink} /></g>
      {lines.map((line, i) => (
        <path key={i} d={line} fill="none" stroke={V.goldLine} strokeWidth={i === 0 ? 2.4 : 1.4} opacity={i === 0 ? 0.95 : 0.6} strokeLinecap="round" />
      ))}
    </g>
  );
}

/** 奶油云卷。 */
function CloudCurl({ x, y, s = 1, flip = 1 }: { x: number; y: number; s?: number; flip?: 1 | -1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip * s} ${s})`}>
      <path d="M0 0c46-18 96-8 124 24 20 24 16 56-10 74-28 20-68 18-114 4Z" fill={V.cream} />
      <path d="M0 8c42-14 86-4 110 24 16 18 12 42-8 56" fill="none" stroke={V.gold} strokeWidth="1.6" opacity="0.7" />
      <path d="M18 40c22-10 46-4 58 14" fill="none" stroke={V.gold} strokeWidth="1.2" opacity="0.45" />
    </g>
  );
}

function Grass({ x, y, s = 1, flip = 1 }: { x: number; y: number; s?: number; flip?: 1 | -1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip * s} ${s})`} stroke={V.ink} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.7">
      <path d="M0 0c2-10 1-18-2-26M6 0c3-12 7-20 12-26M-6 0c-2-9-6-15-11-20" />
    </g>
  );
}

function MapleLeaf({ x, y, r = 0, s = 1, color = V.red }: { x: number; y: number; r?: number; s?: number; color?: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <path d="M0 -13 4 -4 13 -7 8 0 14 5 5 5 5 13 0 8-5 13-5 5-14 5-8 0-13 -7-4 -4Z" fill={color} />
      <path d="M0 8v7" stroke={V.trunk} strokeWidth="1.6" strokeLinecap="round" />
    </g>
  );
}

function Defs({ id }: { id: string }) {
  return (
    <defs>
      <filter id={`${id}-soft`} x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="14" />
      </filter>
      <filter id={`${id}-grain`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
    </defs>
  );
}

function Grain({ id }: { id: string }) {
  return <rect width="240" height="1080" filter={`url(#${id}-grain)`} opacity="0.13" style={{ mixBlendMode: 'multiply' }} />;
}

function LeftArt({ id }: { id: string }) {
  return (
    <g>
      <Defs id={id}/>
      {/* 远山淡影 */}
      <path d="M0 0h92c-20 96-16 190 6 278 16 62 8 122-18 172L0 486Z" fill={V.sky} opacity="0.4" />

      {/* 顶部金色银杏大枝 */}
      <path d="M-10 26c64 18 118 52 158 104" stroke={V.trunk} strokeWidth="11" fill="none" strokeLinecap="round" />
      <path d="M44 44c26 4 48 18 64 38M96 74c22 2 42 12 58 28" stroke={V.trunk} strokeWidth="5" fill="none" strokeLinecap="round" />
      <FanCluster x={58} y={58} s={1.25} />
      <FanCluster x={112} y={86} s={1.1} flip={-1} />
      <FanCluster x={158} y={128} s={0.95} />
      <FanCluster x={28} y={92} s={1.0} flip={-1} />
      <FanCluster x={196} y={172} s={0.8} flip={-1} />

      {/* 后层山体 */}
      <Mountain fill={V.mid}
        d="M0 148c58 10 96 48 108 108 12 60-8 116-44 154-30 32-46 74-40 118 6 44 30 78 62 100v150H0Z"
        lines={['M8 178c44 16 74 52 84 102', 'M14 214c36 18 60 48 70 88']} />
      {/* 前层山体 */}
      <Mountain fill={V.deep}
        d="M0 412c74 16 110 68 116 138 6 64-22 120-64 156-34 30-50 72-42 118 8 46 34 80 66 104v152H0Z"
        lines={['M6 448c50 18 84 60 94 118', 'M12 492c44 20 72 56 82 104', 'M2 540c40 18 66 50 76 92']} />

      {/* 朱红流苏 */}
      <path d="M0 258c42 16 70 46 82 88" stroke={V.red} strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M0 300c26 14 44 34 54 60" stroke={V.redLight} strokeWidth="3.4" fill="none" strokeLinecap="round" opacity="0.85" />

      {/* 松与金叶 */}
      <Pine x={104} y={560} s={1.08} />
      <Pine x={48} y={742} s={0.74} flip={-1} />
      <GoldCluster x={108} y={624} s={0.95} />
      <GoldCluster x={70} y={856} s={1.1} flip={-1} />
      <Grass x={40} y={906} s={1.05} />
      <Grass x={132} y={596} s={0.8} flip={-1} />

      {/* 枫枝 */}
      <path d="M0 786c46-14 88-6 124 22" stroke={V.trunk} strokeWidth="4.4" fill="none" strokeLinecap="round" />
      <MapleLeaf x={118} y={812} r={14} s={1.6} />
      <MapleLeaf x={92} y={786} r={-16} s={1.25} />
      <MapleLeaf x={142} y={822} r={26} s={1.15} color={V.redLight} />

      {/* 奶油云卷 */}
      <CloudCurl x={-16} y={930} s={1.05} />
      <CloudCurl x={-10} y={352} s={0.62} flip={-1} />

      {/* 水 */}
      <path d="M0 1010h150c-18 24-28 50-32 70H0Z" fill={V.teal} opacity="0.9" />
      <path d="M0 1022c40 8 80 24 112 44" stroke={V.tealLight} strokeWidth="2.4" fill="none" opacity="0.8" />

      {/* 雾 */}
      <g className="scn-mist-v" opacity="0.6" filter={`url(#${id}-soft)`}>
        <ellipse cx="92" cy="330" rx="92" ry="24" fill={V.cream} />
        <ellipse cx="56" cy="690" rx="80" ry="22" fill={V.cream} />
      </g>
      <Grain id={id}/>
    </g>
  );
}

function RightArt({ id }: { id: string }) {
  return (
    <g>
      <Defs id={id}/>
      <path d="M240 0h-86c20 100 16 194-6 282-16 60-8 120 18 170l74 34Z" fill={V.sky} opacity="0.38" />

      {/* 顶部金色银杏大枝 */}
      <path d="M250 20c-64 20-116 56-154 108" stroke={V.trunk} strokeWidth="11" fill="none" strokeLinecap="round" />
      <path d="M196 40c-26 4-48 18-64 38M144 72c-22 2-42 12-58 28" stroke={V.trunk} strokeWidth="5" fill="none" strokeLinecap="round" />
      <FanCluster x={182} y={54} s={1.22} flip={-1} />
      <FanCluster x={128} y={84} s={1.08} />
      <FanCluster x={84} y={124} s={0.92} flip={-1} />
      <FanCluster x={212} y={90} s={0.98} />
      <FanCluster x={48} y={168} s={0.78} />

      {/* 后层山体 */}
      <Mountain fill={V.mid}
        d="M240 136c-54 10-90 48-100 106-10 60 10 114 44 150 30 32 46 74 40 118-6 44-30 78-62 100v156h78Z"
        lines={['M232 168c-42 18-70 54-80 104', 'M226 206c-34 18-58 48-68 88']} />
      {/* 前层山体 */}
      <Mountain fill={V.deep}
        d="M240 470c-66 18-100 70-106 140-6 62 22 116 62 152 34 30 50 72 42 118-8 44-34 78-66 102v98h68Z"
        lines={['M234 506c-48 20-80 62-90 120', 'M228 550c-42 22-70 58-80 106', 'M238 598c-38 20-64 52-74 94']} />

      {/* 朱红流苏 */}
      <path d="M240 246c-40 16-68 46-80 88" stroke={V.red} strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M240 288c-26 14-44 34-54 60" stroke={V.redLight} strokeWidth="3.4" fill="none" strokeLinecap="round" opacity="0.85" />

      {/* 松与金叶 */}
      <Pine x={140} y={560} s={1.02} flip={-1} />
      <Pine x={188} y={742} s={0.7} />
      <GoldCluster x={136} y={626} s={0.95} flip={-1} />
      <GoldCluster x={172} y={862} s={1.05} />
      <Grass x={202} y={912} s={1} flip={-1} />
      <Grass x={112} y={600} s={0.8} />

      {/* 枫枝偏上 */}
      <path d="M240 762c-46-14-88-6-124 22" stroke={V.trunk} strokeWidth="4.4" fill="none" strokeLinecap="round" />
      <MapleLeaf x={120} y={788} r={-14} s={1.55} />
      <MapleLeaf x={146} y={762} r={16} s={1.2} color={V.redLight} />
      <MapleLeaf x={96} y={798} r={-26} s={1.1} />

      {/* 奶油云卷 */}
      <CloudCurl x={256} y={946} s={1.05} flip={-1} />
      <CloudCurl x={250} y={366} s={0.6} />

      {/* 水 */}
      <path d="M240 1012h-146c18 24 28 48 32 68h114Z" fill={V.teal} opacity="0.9" />
      <path d="M240 1024c-40 8-78 22-110 42" stroke={V.tealLight} strokeWidth="2.4" fill="none" opacity="0.8" />

      <g className="scn-mist-v" opacity="0.6" filter={`url(#${id}-soft)`}>
        <ellipse cx="148" cy="344" rx="92" ry="24" fill={V.cream} />
        <ellipse cx="184" cy="700" rx="80" ry="22" fill={V.cream} />
      </g>
      <Grain id={id}/>
    </g>
  );
}

/** 金色叶丛：参考图里成片的黄叶。 */
function GoldCluster({ x, y, s = 1, flip = 1 }: { x: number; y: number; s?: number; flip?: 1 | -1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip * s} ${s})`}>
      <path d="M-36 4c-8-8-8-22 2-30 4-14 20-22 34-17 9-9 25-8 33 3 14 0 24 12 23 25-1 12-12 20-24 21-22 3-48 1-68-2Z" fill={V.gold} stroke={V.goldDeep} strokeWidth="1.2" />
      <path d="M-30 -4c-4-4-4-12 2-16" fill="none" stroke={V.goldDeep} strokeWidth="2" opacity="0.5" strokeLinecap="round" />
      <g fill={V.cream} opacity="0.55">
        <circle cx="-10" cy="-2" r="1.8" />
        <circle cx="10" cy="-8" r="1.6" />
        <circle cx="24" cy="2" r="1.4" />
      </g>
    </g>
  );
}

/**
 * 立绘式山水图：把 /assets/art/side-left.(webp|png|jpg) 盖在矢量山水之上。
 * 有图就用图（画质直接拉满），没图就退回矢量版，不会白屏。
 */
const EXTENSIONS = ['webp', 'png', 'jpg'] as const;

function SideImage({ side }: { side: 'left' | 'right' }) {
  const [ext, setExt] = useState(0);
  const [ready, setReady] = useState(false);
  const [dead, setDead] = useState(false);
  if (dead) return null;
  return (
    <img
      className={`side-img ${ready ? 'is-ready' : ''}`}
      src={`/assets/art/side-${side}.${EXTENSIONS[ext]}`}
      alt=""
      decoding="async"
      onLoad={() => setReady(true)}
      onError={() => {
        if (ext < EXTENSIONS.length - 1) { setReady(false); setExt(ext + 1); }
        else setDead(true);
      }}
    />
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
        <SideImage side="left"/>
      </div>
      <div className="scenery-side side-right">
        <svg className="side-svg" viewBox="0 0 240 1080" preserveAspectRatio="xMidYMid slice">
          <RightArt id={`r${id}`}/>
        </svg>
        <SideImage side="right"/>
      </div>
    </div>
  );
}
