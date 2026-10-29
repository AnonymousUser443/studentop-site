/**
 * 地图外的边框（照霜降雅集的实现方式复刻架构）。
 *
 * 参考项目的做法：
 * 1. 一个 inset:0、pointer-events:none 的装饰层，压在**地图之上**
 * 2. 里面的画心固定为 1920×1080 设计画布，靠 transform 整体缩放适配窗口
 * 3. 静态部分与可动部分分层，末了叠一层纸纹与环境光
 *
 * 这里用同一套结构：`.frame-design` 是 1920×1080 的画心，中间留出透明的取景窗，
 * 四周画山水；地图在窗口里，视觉上就"嵌"进画中。
 */
import { useEffect, useState } from 'react';

const DESIGN_W = 1920;
const DESIGN_H = 1080;
/** 取景窗（画心的透明区域），地图从这里露出来 */
const WIN = { x: 300, y: 96, w: 1320, h: 888 };

const V = {
  ink: '#1b3a31',
  deep: '#26503f',
  green: '#3a6d56',
  mid: '#5c8a6d',
  pale: '#84ac86',
  sky: '#a9c3a1',
  gold: '#dcc07d',
  goldLine: '#d2ab5f',
  goldDeep: '#ae8b3c',
  cream: '#f7f0d8',
  red: '#cd4a29',
  redLight: '#ef7a41',
  teal: '#4f9f96',
  tealLight: '#a6d3c3',
  trunk: '#4a3b2a'
};

/** 扇形银杏叶 */
function FanLeaf({ x, y, r = 0, s = 1 }: { x: number; y: number; r?: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <path d="M0 14c-19-4-27-18-22-31 5-14 22-20 22-20s17 6 22 20c5 13-3 27-22 31Z" fill={V.gold} stroke={V.goldDeep} strokeWidth="1" />
      <path d="M0 14V-28M0 6-13-13M0 6 13-13M0 -8-7-23M0 -8 7-23" stroke={V.goldDeep} strokeWidth="0.8" opacity="0.5" fill="none" />
    </g>
  );
}

/** 五角枫叶 */
function MapleLeaf({ x, y, r = 0, s = 1, color = V.red }: { x: number; y: number; r?: number; s?: number; color?: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <path d="M0 -16 5 -5 16 -9 10 0 17 6 6 6 6 16 0 10-6 16-6 6-17 6-10 0-16 -9-5 -5Z" fill={color} />
      <path d="M0 10v9" stroke={V.trunk} strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}

/** 云朵状松冠 */
function Canopy({ x, y, s = 1, fill = V.deep, shadow = V.ink }: { x: number; y: number; s?: number; fill?: string; shadow?: string }) {
  const d = 'M-56 2c-13-2-22-15-18-29 4-14 17-23 31-21 0-16 15-29 31-29 15 0 27 10 30 23 16-3 30 9 31 24 1 13-9 24-23 26-25 7-60 8-82 6Z';
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g transform="translate(2 8) scale(0.95)"><path d={d} fill={shadow} /></g>
      <path d={d} fill={fill} />
      <path d="M-44 -6c-6-3-9-9-7-16 2-8 9-13 17-13-2-11 8-19 19-19 8 0 15 5 18 13" fill="none" stroke={V.pale} strokeWidth="3.2" opacity="0.5" strokeLinecap="round" />
      <path d="M-58 4c26 9 70 9 96 1" fill="none" stroke={V.goldLine} strokeWidth="2.2" opacity="0.85" strokeLinecap="round" />
    </g>
  );
}

function Pine({ x, y, s = 1, flip = 1 }: { x: number; y: number; s?: number; flip?: 1 | -1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip * s} ${s})`}>
      <path d="M0 0c6-32 6-58 0-84" stroke={V.trunk} strokeWidth="8" fill="none" strokeLinecap="round" />
      <path d="M-1 -52c-12 6-21 14-25 26M1 -38c12 6 21 13 27 24" stroke={V.trunk} strokeWidth="3.8" fill="none" strokeLinecap="round" />
      <Canopy x={0} y={-78} s={1.06} fill={V.deep} />
      <Canopy x={2} y={-130} s={0.8} fill={V.green} />
      <Canopy x={0} y={-172} s={0.56} fill={V.deep} />
    </g>
  );
}

/** 山体：平涂 + 山脊金线 */
function Mountain({ d, fill, lines }: { d: string; fill: string; lines: string[] }) {
  return (
    <g>
      <path d={d} fill={fill} />
      <g transform="translate(-8 -6) scale(0.986)" opacity="0.38"><path d={d} fill={V.ink} /></g>
      {lines.map((line, i) => (
        <path key={i} d={line} fill="none" stroke={V.goldLine} strokeWidth={i === 0 ? 2.6 : 1.5} opacity={i === 0 ? 0.95 : 0.55} strokeLinecap="round" />
      ))}
    </g>
  );
}

/** 奶油云卷 */
function CloudCurl({ x, y, s = 1, flip = 1 }: { x: number; y: number; s?: number; flip?: 1 | -1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip * s} ${s})`}>
      <path d="M0 0c52-20 108-8 138 26 22 26 18 62-10 82-30 22-76 20-128 4Z" fill={V.cream} />
      <path d="M0 10c46-16 96-4 122 26 18 20 14 46-8 62" fill="none" stroke={V.gold} strokeWidth="1.8" opacity="0.65" />
    </g>
  );
}

export function Frame() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.max(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  return (
    <div className="frame-layer" aria-hidden="true">
      <div className="frame-design" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        <svg className="frame-art" viewBox={`0 0 ${DESIGN_W} ${DESIGN_H}`} preserveAspectRatio="none">
          <defs>
            <mask id="frame-window">
              <rect width={DESIGN_W} height={DESIGN_H} fill="#fff" />
              <rect x={WIN.x} y={WIN.y} width={WIN.w} height={WIN.h} rx="26" fill="#000" />
            </mask>
            <linearGradient id="frame-leftwash" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#f8f1da" stopOpacity="0.97" />
              <stop offset="62%" stopColor="#f8f1da" stopOpacity="0.92" />
              <stop offset="88%" stopColor="#f8f1da" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#f8f1da" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="frame-top" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={V.cream} stopOpacity="0.9" />
              <stop offset="100%" stopColor={V.cream} stopOpacity="0" />
            </linearGradient>
          </defs>

          <g mask="url(#frame-window)">
            {/* 顶部奶油天光 */}
            <rect x="0" y="0" width={DESIGN_W} height="240" fill="url(#frame-top)" />

            {/* 远山三层 */}
            <path d="M-40 300c120-96 250-116 370-84 104 28 170 6 260-30 116-46 232-36 330 18 80 44 168 50 262 30 104-22 212-12 312 30 80 34 172 44 282 28 82-12 154-8 244 18v800H-40Z" fill={V.sky} opacity="0.42" />
            <path d="M-40 356c130-70 236-78 344-40 96 34 178 10 270-26 100-40 202-20 288 26 70 38 160 44 258 26 100-18 202-6 294 32 76 30 162 38 264 24 80-12 160-6 242 22v726H-40Z" fill={V.mid} opacity="0.6" />

            {/* 左侧主山体 */}
            <Mountain fill={V.green}
              d="M-40 250c150 14 250 96 286 232 30 116-8 214-96 282-64 50-96 118-78 190 14 58 56 100 118 128v118H-40Z"
              lines={['M40 300c110 34 184 116 200 232', 'M52 372c92 36 152 108 166 208']} />
            <Mountain fill={V.deep}
              d="M-40 520c168 22 268 122 296 268 22 112-30 200-132 254-66 34-104 84-96 148 6 44 30 78 68 100v60H-40Z"
              lines={['M30 572c122 36 200 130 214 268', 'M46 654c100 40 162 116 176 226', 'M20 742c92 34 148 98 162 190']} />

            {/* 右侧主山体 */}
            <Mountain fill={V.green}
              d="M1960 230c-146 18-244 102-278 236-30 116 10 212 96 280 64 50 96 118 78 190-14 58-56 100-118 128v116h222Z"
              lines={['M1880 282c-108 36-180 118-196 232', 'M1866 354c-90 38-148 110-162 208']} />
            <Mountain fill={V.deep}
              d="M1960 500c-164 26-262 126-288 270-22 110 30 198 130 252 66 34 104 84 96 148-6 44-30 78-68 100v60h230Z"
              lines={['M1892 552c-120 38-196 132-210 268', 'M1876 634c-98 40-158 116-172 224', 'M1902 724c-90 34-146 96-160 188']} />

            {/* 底部山影与水面 */}
            <path d="M-40 900c160-58 300-46 430 6 120 48 250 30 350-14 130-56 270-42 380 14 96 48 200 54 320 12 100-36 222-30 320 16v186H-40Z" fill={V.deep} opacity="0.95" />
            <path d="M-40 962c180-34 320 4 440 40 130 38 260 18 370-24 120-46 250-34 350 16 96 48 220 52 340 6 100-40 220-32 340 16v104H-40Z" fill={V.teal} opacity="0.9" />
            <g stroke={V.tealLight} strokeWidth="2.6" fill="none" opacity="0.8">
              <path d="M120 1010c120-14 250-4 360 22M700 1038c140-16 280-2 400 26M1320 1006c130-16 260-2 380 24" />
            </g>

            {/* 左侧雾面留白：给左栏导航一块亮底 */}
            <path d="M0 0h150c-18 70-14 140 12 200 22 52 18 104-12 150-24 36-28 78-10 118 20 44 56 76 104 96 34 14 52 40 46 72-6 34-34 56-78 62L0 1080Z" fill="url(#frame-leftwash)" transform="scale(1.32 1)" />

            {/* 顶部金色银杏大枝（左） */}
            <path d="M-40 30c210 34 400 118 566 250" stroke={V.trunk} strokeWidth="20" fill="none" strokeLinecap="round" />
            <path d="M120 92c86 12 158 48 210 104M360 168c74 6 140 34 190 74" stroke={V.trunk} strokeWidth="9" fill="none" strokeLinecap="round" />
            {[[120, 70, -26, 1.5], [190, 96, 8, 1.2], [258, 132, -12, 1.4], [330, 96, 20, 1.1], [410, 176, -18, 1.3], [476, 214, 14, 1.2], [250, 60, 32, 1.0], [520, 250, -6, 1.1], [170, 150, 12, 1.1], [430, 120, 26, 1.0]].map(([x, y, r, s], i) => (
              <FanLeaf key={i} x={x as number} y={y as number} r={r as number} s={s as number} />
            ))}

            {/* 顶部红枫（右） */}
            <path d="M1960 40c-190 26-352 96-500 210" stroke={V.trunk} strokeWidth="18" fill="none" strokeLinecap="round" />
            <path d="M1800 96c-80 14-146 48-196 100M1600 156c-70 8-132 34-180 72" stroke={V.trunk} strokeWidth="8" fill="none" strokeLinecap="round" />
            {[[1790, 70, -14, 1.5], [1710, 96, 12, 1.3], [1630, 130, -20, 1.2], [1870, 60, 8, 1.3], [1540, 150, 18, 1.1], [1470, 190, -8, 1.0], [1760, 140, 24, 1.0]].map(([x, y, r, s], i) => (
              <MapleLeaf key={`m${i}`} x={x as number} y={y as number} r={r as number} s={s as number} color={i % 3 === 0 ? V.redLight : V.red} />
            ))}

            {/* 左侧金叶丛与松 */}
            <Pine x={170} y={790} s={1.5} />
            <Pine x={300} y={930} s={1.0} flip={-1} />
            <Canopy x={120} y={1000} s={1.5} fill={V.goldDeep} />
            {/* 右侧松与金叶 */}
            <Pine x={1780} y={760} s={1.4} flip={-1} />
            <Pine x={1650} y={940} s={0.95} />
            <Canopy x={1840} y={1010} s={1.4} fill={V.goldDeep} />

            {/* 奶油云卷 */}
            <CloudCurl x={-40} y={620} s={1.15} />
            <CloudCurl x={1960} y={680} s={1.15} flip={-1} />
            <CloudCurl x={140} y={1010} s={0.9} flip={-1} />
            <CloudCurl x={1560} y={1020} s={0.9} />

            {/* 窗沿描金：让取景窗有一圈细金边 */}
            <rect x={WIN.x - 6} y={WIN.y - 6} width={WIN.w + 12} height={WIN.h + 12} rx="30" fill="none" stroke={V.gold} strokeWidth="2" opacity="0.5" />
          </g>
        </svg>

        {/* 纸纹与环境光（对应参考项目的 paper-grain / ambient-light） */}
        <div className="frame-grain" />
        <div className="frame-light" />
      </div>
    </div>
  );
}
