/**
 * 地图左右空带的绿水青山：两条竖直的山水带贴在屏幕两侧（z8，低于 HUD），
 * 内侧用渐变蒙版化开，不会盖住地图。上下不放置任何内容。
 *
 * - 左侧：峭壁两层、松枝探出、山亭、雾气缓流、飞鸟
 * - 右侧：峭壁两层、红枫、雾气缓流、飞鸟
 * - 全部矢量、低饱和；减少动态时动效停止
 */
import { useId } from 'react';

function SideSvg({ id, side }: { id: string; side: 'left' | 'right' }) {
  const left = side === 'left';
  const mirror = left ? '' : ' scale(-1 1) translate(-260 0)';
  return (
    <svg className="side-svg" viewBox="0 0 260 1080" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`ss-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#3a5c4e" />
          <stop offset="100%" stopColor="#64826e" />
        </linearGradient>
        <linearGradient id={`ss2-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#4d7060" />
          <stop offset="100%" stopColor="#7d9a86" />
        </linearGradient>
        <filter id={`ssf-${id}`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
      </defs>
      <g transform={mirror}>
        {/* 远层峭壁 */}
        <path
          d="M0 0v1080l96-44 30-86-18-84 40-92-24-86 34-96-22-80 30-88-18-74 26-84-14-72 24-80-10-70 20-64-12-60Z"
          fill={`url(#ss2-${id})`} opacity="0.88"
        />
        {/* 近层峭壁 */}
        <path
          d="M0 0v1080l120-72 34-104-30-92 44-96-26-88 38-100-24-82 36-92-22-76 32-84-18-70 28-72-12-52Z"
          fill={`url(#ss-${id})`} opacity="0.95"
        />
        {/* 崖壁纹理 */}
        <g stroke="#24453a" strokeWidth="2" fill="none" opacity="0.5">
          <path d="M46 170l24 60M54 320l28 66M48 500l30 62M56 700l26 70M50 880l30 66" />
          <path d="M96 260l20 44M100 420l24 52M98 620l26 50M104 800l22 46" />
        </g>
        {/* 崖顶草树 */}
        <g fill="#2c5043" opacity="0.95">
          <path d="M120 84c-14-20-10-40 0-56 8-16 24-26 44-28-10 22-8 42 0 60 8 16-18 24-44 24Z" />
          <path d="M118 320c-12-18-8-36 0-50 7-15 22-24 40-26-9 20-7 38 0 54 7 14-17 22-40 22Z" />
          <path d="M122 620c-12-16-8-34 0-46 7-14 20-22 36-24-8 18-6 34 0 48 6 12-15 20-36 22Z" />
          <path d="M116 900c-14-20-9-38 0-52 8-14 24-24 44-26-10 20-8 38 0 54 7 14-18 24-44 24Z" />
        </g>
        {/* 松枝（探向地图一侧） */}
        <g stroke="#2c5043" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.9">
          <path d="M130 210c28 6 52 16 70 30" />
          <path d="M146 224c18-8 36-10 54-8" />
          <path d="M130 760c30 8 56 20 76 36" />
          <path d="M148 776c20-10 40-12 58-10" />
        </g>
        <g fill="#38594b" opacity="0.92">
          <path d="M190 236l-16-30h11l-12-24h10l-12-22h9l24 44h-14Zm0 0 17-27h-10l13-21h-9l13-20h8l-19 39h-13Z" />
          <path d="M198 792l-16-30h11l-12-24h10l-12-22h9l24 44h-14Zm0 0 17-27h-10l13-21h-9l13-20h8l-19 39h-13Z" />
        </g>
        {/* 山亭 */}
        <g transform="translate(52 470)" opacity="0.92">
          <path d="M-18 66V28h36v38l7-7-7-5-5-6v-12h-26v12l-5 6-7 5Z" fill="#2f5246" />
          <path d="M-24 28c9-13 23-19 48-19s39 6 48 19l-7 4c-10-9-24-13-41-13s-31 4-41 13Z" fill="#2f5246" />
          <path d="M0 15V0" stroke="#2f5246" strokeWidth="2.4" />
          <rect x="-9" y="-6" width="18" height="6" fill="#2f5246" />
        </g>
        {/* 红枫（右侧） */}
        <g fill="#a8513a" opacity="0.9">
          <path d="M120 130c-16-10-24-24-24-42 0-2 2-3 4-2 6 14 13 22 24 28Z" />
          <path d="M120 130c14-12 20-26 18-44 0-2-2-3-4-2-4 15-9 25-18 32Z" />
        </g>
        {/* 雾气 */}
        <g className="scn-mist-v" filter={`url(#ssf-${id})`} opacity="0.8">
          <ellipse cx="120" cy="150" rx="110" ry="34" fill="#eef0dc" />
          <ellipse cx="96" cy="430" rx="100" ry="30" fill="#eef0dc" />
          <ellipse cx="126" cy="690" rx="110" ry="32" fill="#eef0dc" />
          <ellipse cx="100" cy="960" rx="100" ry="30" fill="#eef0dc" />
        </g>
        {/* 飞鸟 */}
        <g stroke="#48645a" strokeWidth="2.5" fill="none" opacity="0.55" strokeLinecap="round">
          <path d="M180 60q8-8 16 0q8-8 16 0" />
          <path d="M205 34q6-6 12 0q6-6 12 0" />
          <path d="M185 1000q8-8 16 0q8-8 16 0" />
        </g>
      </g>
    </svg>
  );
}

export function Scenery() {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <div className="scenery" aria-hidden="true">
      <div className="scenery-side side-left"><SideSvg id={`l-${id}`} side="left" /></div>
      <div className="scenery-side side-right"><SideSvg id={`r-${id}`} side="right" /></div>
    </div>
  );
}
