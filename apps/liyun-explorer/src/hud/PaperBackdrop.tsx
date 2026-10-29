/**
 * 纸层背景：用和底部边饰同一套"纸浪"语言铺满整幅——
 * 层层波浪纸片，从奶油到竹绿逐层加深，边缘压细金线，
 * 最上面一层是淡墨远山。整幅是矢量，可与底栏纸浪无缝衔接。
 */

type Band = { d: string; fill: string; opacity?: number };

const W = 1920;
const H = 1080;

/** 逐层下沉的纸浪（下层更绿更深）。 */
const BANDS: Band[] = [
  {
    fill: '#c9d6bb',
    opacity: 0.55,
    d: 'M0 300 C220 262 380 340 620 322 C860 304 1010 246 1240 272 C1440 294 1600 348 1780 332 C1860 324 1900 316 1920 310 L1920 1080 L0 1080 Z'
  },
  {
    fill: '#b9cbb0',
    opacity: 0.6,
    d: 'M0 400 C200 366 360 430 600 414 C840 398 1000 340 1230 366 C1430 388 1590 448 1770 430 C1856 421 1900 412 1920 406 L1920 1080 L0 1080 Z'
  },
  {
    fill: '#a7bda3',
    opacity: 0.62,
    d: 'M0 512 C230 476 400 548 640 528 C880 508 1040 450 1260 478 C1460 502 1620 566 1790 546 C1870 536 1900 526 1920 520 L1920 1080 L0 1080 Z'
  },
  {
    fill: '#dfd2ab',
    opacity: 0.9,
    d: 'M0 636 C240 600 420 668 660 650 C900 632 1060 574 1280 600 C1480 624 1640 690 1810 668 C1880 658 1906 650 1920 644 L1920 1080 L0 1080 Z'
  },
  {
    fill: '#ece0bc',
    opacity: 0.95,
    d: 'M0 762 C250 726 430 792 670 776 C910 760 1070 702 1290 728 C1490 752 1650 818 1820 796 C1886 787 1908 778 1920 772 L1920 1080 L0 1080 Z'
  },
  {
    fill: '#f4ebd2',
    opacity: 0.96,
    d: 'M0 890 C260 852 440 918 680 902 C920 886 1080 830 1300 856 C1500 880 1660 944 1830 922 C1890 914 1910 906 1920 900 L1920 1080 L0 1080 Z'
  }
];

/** 天际淡墨远山（压在最上层纸浪之上，只留剪影）。 */
const RIDGE =
  'M0 268 C140 232 250 196 380 214 C500 230 560 268 690 262 C820 256 900 208 1030 216 C1160 224 1240 272 1370 276 C1500 280 1600 236 1720 232 C1820 228 1880 250 1920 258';

export function PaperBackdrop() {
  return (
    <div className="paper-backdrop" aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="pb-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f7f0da" />
            <stop offset="42%" stopColor="#f1e8cd" />
            <stop offset="100%" stopColor="#e6dcc0" />
          </linearGradient>
          <radialGradient id="pb-glow" cx="50%" cy="40%" r="58%">
            <stop offset="0%" stopColor="#fffdf0" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#fffdf0" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="pb-ridge" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8aa392" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#8aa392" stopOpacity="0.12" />
          </linearGradient>
        </defs>

        <rect width={W} height={H} fill="url(#pb-sky)" />
        <rect width={W} height={H} fill="url(#pb-glow)" />

        {/* 淡墨远山 */}
        <path d={`${RIDGE} L1920 420 L0 420 Z`} fill="url(#pb-ridge)" />
        <path d={RIDGE} fill="none" stroke="#8ba891" strokeWidth="2" opacity="0.45" />

        {/* 纸浪层层 */}
        {BANDS.map((band, i) => (
          <g key={i}>
            <path d={band.d} fill={band.fill} opacity={band.opacity} />
            <path d={band.d} fill="none" stroke="#d8c08e" strokeWidth="1.6" opacity="0.4" />
          </g>
        ))}

        {/* 纸面颗粒 */}
        <rect width={W} height={H} fill="#8a7c54" opacity="0.05" />
      </svg>
    </div>
  );
}
