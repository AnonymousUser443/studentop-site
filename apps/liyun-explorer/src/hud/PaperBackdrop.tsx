/**
 * 纸本山水背景：剪纸风格的层叠山峦 + 湖面 + 纸浪，与底部边饰同一套语言。
 *
 * 山的做法：平涂色块 + 山脊压一条细金线，层与层之间用明度递进拉开纵深；
 * 水面平涂 + 两道浅色波纹；最下方仍是逐层的纸浪，与 .edge-bottom 无缝相接。
 */

const W = 1920;
const H = 1080;

/** 左侧山峦（三层递进） */
const LEFT = {
  far: 'M0 470 C90 430 150 352 214 300 C268 256 318 250 366 288 C404 318 430 356 470 392 L520 430 L520 1080 L0 1080 Z',
  mid: 'M0 620 C70 566 128 470 196 404 C258 344 322 336 384 392 C436 440 462 494 512 546 L520 1080 L0 1080 Z',
  near: 'M0 790 C60 720 108 606 176 530 C240 458 310 448 380 512 C440 568 470 640 520 700 L520 1080 L0 1080 Z'
};

/** 右侧山峦（三层递进） */
const RIGHT = {
  far: 'M1920 470 C1830 430 1770 352 1706 300 C1652 256 1602 250 1554 288 C1516 318 1490 356 1450 392 L1400 430 L1400 1080 L1920 1080 Z',
  mid: 'M1920 620 C1850 566 1792 470 1724 404 C1662 344 1598 336 1536 392 C1484 440 1458 494 1408 546 L1400 1080 L1920 1080 Z',
  near: 'M1920 790 C1860 720 1812 606 1744 530 C1680 458 1610 448 1540 512 C1480 568 1450 640 1400 700 L1400 1080 L1920 1080 Z'
};

type Ridge = { d: string; fill: string; line: string };

function Mountain({ d, fill, line }: Ridge) {
  return (
    <g>
      <path d={d} fill={fill} />
      <path d={d} fill="none" stroke={line} strokeWidth="2.2" strokeOpacity="0.55" strokeLinejoin="round" />
    </g>
  );
}

export function PaperBackdrop() {
  return (
    <div className="paper-backdrop" aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="pb-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f8f1dc" />
            <stop offset="46%" stopColor="#f2e9cf" />
            <stop offset="100%" stopColor="#e8dec3" />
          </linearGradient>
          <radialGradient id="pb-glow" cx="50%" cy="34%" r="52%">
            <stop offset="0%" stopColor="#fffdf1" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#fffdf1" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="pb-lake" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a9c6b9" />
            <stop offset="100%" stopColor="#7fa79b" />
          </linearGradient>
          <linearGradient id="pb-nearfade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5f8571" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#4a6b59" stopOpacity="0.98" />
          </linearGradient>
        </defs>

        {/* 天 */}
        <rect width={W} height={H} fill="url(#pb-sky)" />
        <rect width={W} height={H} fill="url(#pb-glow)" />
        {/* 天上远景：一道淡山脊 */}
        <path d="M0 176 C150 146 260 118 390 136 C500 152 560 186 700 182 C840 178 910 132 1050 142 C1180 150 1260 196 1400 200 C1530 204 1640 158 1760 156 C1840 154 1890 168 1920 176 L1920 300 L0 300 Z" fill="#c6d3bb" opacity="0.5" />
        <path d="M0 196 C150 168 260 142 390 158 C500 172 560 204 700 200 C840 196 910 154 1050 162 C1180 170 1260 212 1400 216 C1530 220 1640 178 1760 176 C1840 174 1890 186 1920 194" fill="none" stroke="#cdb887" strokeWidth="1.8" opacity="0.5" />

        {/* 湖面 */}
        <path d="M0 430 H1920 V900 H0 Z" fill="url(#pb-lake)" opacity="0.92" />
        <g stroke="#eaf1e2" strokeWidth="2.4" fill="none" opacity="0.55">
          <path d="M420 520 C560 512 700 524 840 520 M980 560 C1100 552 1220 564 1340 558 M520 640 C640 632 760 644 880 638 M1060 700 C1180 692 1300 704 1420 698" />
        </g>

        {/* 左右山峦：远 → 中 → 近 */}
        <Mountain d={LEFT.far} fill="#c3d1b8" line="#d9c48f" />
        <Mountain d={LEFT.mid} fill="#9fb79c" line="#d9c48f" />
        <Mountain d={LEFT.near} fill="url(#pb-nearfade)" line="#cbb37e" />
        <Mountain d={RIGHT.far} fill="#c3d1b8" line="#d9c48f" />
        <Mountain d={RIGHT.mid} fill="#9fb79c" line="#d9c48f" />
        <Mountain d={RIGHT.near} fill="url(#pb-nearfade)" line="#cbb37e" />

        {/* 近岸纸浪（与底部边饰同形语言） */}
        <path d="M0 902 C240 866 420 930 660 916 C900 902 1060 848 1280 872 C1480 894 1640 956 1810 936 C1880 928 1906 920 1920 914 L1920 1080 L0 1080 Z" fill="#ece0bc" opacity="0.96" />
        <path d="M0 960 C250 926 430 988 670 974 C910 960 1070 908 1290 932 C1490 954 1650 1014 1820 994 C1886 986 1908 978 1920 972 L1920 1080 L0 1080 Z" fill="#f4ebd2" opacity="0.97" />
        <path d="M0 902 C240 866 420 930 660 916 C900 902 1060 848 1280 872 C1480 894 1640 956 1810 936 C1880 928 1906 920 1920 914" fill="none" stroke="#d8c08e" strokeWidth="1.8" opacity="0.5" />
        <path d="M0 960 C250 926 430 988 670 974 C910 960 1070 908 1290 932 C1490 954 1650 1014 1820 994 C1886 986 1908 978 1920 972" fill="none" stroke="#d8c08e" strokeWidth="1.6" opacity="0.45" />

        {/* 顶层薄雾 */}
        <path d="M0 380 C260 356 520 392 780 384 C1040 376 1300 344 1560 364 C1740 378 1856 392 1920 400 L1920 470 L0 470 Z" fill="#f7efd9" opacity="0.42" />

        {/* 纸面颗粒 */}
        <rect width={W} height={H} fill="#8a7c54" opacity="0.05" />
      </svg>
    </div>
  );
}
