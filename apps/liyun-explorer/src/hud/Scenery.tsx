/**
 * 地图四周的绿水青山：透明中带的山水分层画框，浮在地图之上（z8，低于 HUD）。
 *
 * - 上方：三层远山自天边层层推近，山脚一条流动的雾带，天角几朵淡云与光柱
 * - 下方：湖面、两角坡岸、水纹轻闪，滩头芦苇与一叶扁舟
 * - 两侧：细窄的雾气贴着画框边缘，中央完全透明，不影响看地图
 * - 全部矢量、低饱和；减少动态时所有动效停止
 */
import { useId } from 'react';

export function Scenery() {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <div className="scenery" aria-hidden="true">
      <svg className="scenery-svg" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={`scn-water-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a7c4b4" />
            <stop offset="100%" stopColor="#7ca596" />
          </linearGradient>
          <filter id={`scn-soft-${id}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="18" />
          </filter>
          <filter id={`scn-blur-${id}`} x="-15%" y="-15%" width="130%" height="130%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
        </defs>

        {/* 光柱（只落在上半幅） */}
        <g className="scn-light" opacity="0.07" filter={`url(#scn-soft-${id})`}>
          <path d="M40 0h300L760 430H280Z" fill="#fffbe8" />
          <path d="M430 0h150L880 430H620Z" fill="#fffbe8" />
        </g>

        {/* 远山三层：自天边推近 */}
        <path
          d="M-40 0h2000v196c-128-78-250-92-366-52-102 36-158 10-248-30-108-46-218-36-308 20-70 44-158 48-250 28-98-22-196-12-290 30-74 32-160 42-266 24-74-12-144-8-232 16-40 11-40 0 0-36Z"
          fill="#9db3a2" opacity="0.55" filter={`url(#scn-soft-${id})`}
        />
        <path
          d="M-40 0h2000v240c-112-58-210-66-306-34-86 30-164 8-248-24-92-36-184-18-266 26-66 34-150 40-242 22-92-18-186-4-272 32-70 28-150 34-244 20-74-12-150-4-224 22-90 32-156 34-198 8V0Z"
          fill="#86a18d" opacity="0.8"
        />
        <path
          d="M-40 0h2000v308c-120-46-232-40-330 8-78 38-154 16-234-16-82-32-168-10-246 26-64 30-150 34-234 12-86-20-174-6-254 28-66 28-146 34-234 16-76-16-150-6-228 20-88 30-190 22-240-10V0Z"
          fill="#62806d" opacity="0.94"
        />

        {/* 近山上的小松与山亭 */}
        <g fill="#38594b" opacity="0.92">
          <path d="M226 376l-30-64h22l-24-52h20l-24-48h18l48 96h-30Zm0 0 34-58h-20l26-46h-18l26-42h16l-38 84h-26Z" transform="translate(76 -78) scale(.9)" />
          <path d="M226 376l-30-64h22l-24-52h20l-24-48h18l48 96h-30Zm0 0 34-58h-20l26-46h-18l26-42h16l-38 84h-26Z" transform="translate(1144 -90) scale(.78)" />
          <path d="M226 376l-30-64h22l-24-52h20l-24-48h18l48 96h-30Zm0 0 34-58h-20l26-46h-18l26-42h16l-38 84h-26Z" transform="translate(1672 -68) scale(.62)" />
        </g>
        <g transform="translate(1288 216)" opacity="0.9">
          <path d="M-26 96V40h52v56l10-10-10-8-8-8v-18h-36v18l-8 8-10 8Z" fill="#2f5246" />
          <path d="M-34 40c12-18 34-26 68-26 34 0 56 8 68 26l-10 6c-14-12-34-18-58-18s-44 6-58 18Z" fill="#2f5246" />
          <path d="M0 20V0" stroke="#2f5246" strokeWidth="3" />
          <rect x="-12" y="-8" width="24" height="8" fill="#2f5246" />
        </g>

        {/* 山脚雾带 */}
        <g className="scn-mist" filter={`url(#scn-soft-${id})`} opacity="0.82">
          <ellipse cx="360" cy="352" rx="300" ry="30" fill="#f1efdb" />
          <ellipse cx="960" cy="368" rx="330" ry="32" fill="#f1efdb" />
          <ellipse cx="1560" cy="354" rx="300" ry="30" fill="#f1efdb" />
        </g>

        {/* 天角云 */}
        <g className="scn-cloud" filter={`url(#scn-soft-${id})`} opacity="0.85">
          <g fill="#f6f3e2">
            <ellipse cx="240" cy="120" rx="150" ry="38" />
            <ellipse cx="322" cy="102" rx="98" ry="28" />
            <ellipse cx="164" cy="140" rx="88" ry="24" />
          </g>
          <g fill="#f3f0de">
            <ellipse cx="1664" cy="100" rx="166" ry="42" />
            <ellipse cx="1752" cy="84" rx="108" ry="28" />
            <ellipse cx="1564" cy="120" rx="88" ry="24" />
          </g>
          <g fill="#f8f5e8" opacity="0.8">
            <ellipse cx="1212" cy="62" rx="106" ry="24" />
          </g>
        </g>

        {/* 飞鸟 */}
        <g stroke="#48645a" strokeWidth="3" fill="none" opacity="0.55" strokeLinecap="round">
          <path d="M1150 150q10-10 20 0q10-10 20 0" />
          <path d="M1220 122q8-8 16 0q8-8 16 0" />
          <path d="M700 230q7-7 14 0q7-7 14 0" />
        </g>

        {/* 两侧贴边的薄雾 */}
        <g className="scn-mist" filter={`url(#scn-soft-${id})`} opacity="0.5">
          <ellipse cx="34" cy="620" rx="120" ry="120" fill="#eef0dc" />
          <ellipse cx="1886" cy="560" rx="120" ry="130" fill="#eef0dc" />
        </g>

        {/* 下方湖面 */}
        <path d="M-40 796h2000v320H-40Z" fill={`url(#scn-water-${id})`} />
        {/* 两角坡岸 */}
        <path d="M-40 1080c40-116 150-186 262-196 88-8 140 40 96 96-52 66-110 98-196 104Z" fill="#3a5a4d" />
        <path d="M1960 1080c-46-112-156-176-258-188-88-10-142 36-100 94 50 68 106 98 186 104Z" fill="#38594b" />
        <path d="M-40 1080c60-86 168-136 260-142 74-4 116 30 84 78-36 54-98 74-196 76Z" fill="#4c705e" opacity="0.85" />
        <path d="M1960 1080c-64-82-160-132-252-138-76-4-118 28-86 76 38 56 100 74 198 76Z" fill="#466856" opacity="0.85" />

        {/* 湖面水纹 */}
        <g className="scn-water" stroke="#eef2e0" strokeWidth="2.5" fill="none" strokeLinecap="round">
          <path d="M640 860h110M860 892h88M430 910h96M1500 856h104M1720 890h84M1180 928h110" opacity="0.5" />
          <path d="M760 938h70M560 960h64M1620 950h70M1330 964h60" opacity="0.4" />
          <ellipse cx="960" cy="870" rx="150" ry="7" opacity="0.35" />
          <ellipse cx="1520" cy="928" rx="120" ry="6" opacity="0.3" />
          <ellipse cx="420" cy="886" rx="110" ry="5" opacity="0.3" />
        </g>

        {/* 滩头雾带 */}
        <g className="scn-mist" filter={`url(#scn-soft-${id})`} opacity="0.72">
          <ellipse cx="480" cy="846" rx="340" ry="34" fill="#eef0dc" />
          <ellipse cx="1440" cy="854" rx="320" ry="32" fill="#eef0dc" />
        </g>

        {/* 芦苇与扁舟 */}
        <g stroke="#2f5246" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.85">
          <path d="M180 986c2-26 6-44 14-56M196 992c4-30 8-50 16-66M212 994c0-28 2-48 8-62" />
          <path d="M1740 996c-2-26-6-42-14-54M1724 1002c-4-28-8-48-16-64M1708 1004c0-26-2-44-8-58" />
        </g>
        <g opacity="0.9">
          <path d="M880 946c14-16 40-16 56 0l6 4-6 10-14-6-14 6-16 6Z" fill="#33584c" />
          <path d="M906 956c-4-12-14-18-30-18 18-2 28 8 30 18Z" fill="#33584c" opacity="0.85" />
          <path d="M894 950c0-14-8-22-22-24" stroke="#2f5246" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.6" />
          <circle cx="906" cy="940" r="3" fill="#8fae9b" />
        </g>
      </svg>
    </div>
  );
}
