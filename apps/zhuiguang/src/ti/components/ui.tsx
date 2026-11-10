import React from "react";

/** 页面根容器 */
export function Slide({
  children,
  style,
  className = "",
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div className={`slide ${className}`} style={style}>
      {children}
    </div>
  );
}

/** 左上角编号标签：Fe / Se / … 或小节名 */
export function Kicker({
  children,
  x = 120,
  y = 96,
  color = "var(--ash-300)",
  style,
}: {
  children: React.ReactNode;
  x?: number;
  y?: number;
  color?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="label"
      style={{ position: "absolute", left: x, top: y, color, ...style }}
    >
      {children}
    </div>
  );
}

/** 底部注释 */
export function Footnote({
  children,
  x = 120,
  y = 944,
  align = "left",
}: {
  children: React.ReactNode;
  x?: number;
  y?: number;
  align?: "left" | "right";
}) {
  return (
    <div
      className="mono"
      style={{
        position: "absolute",
        left: align === "left" ? x : undefined,
        right: align === "right" ? 1920 - x - 0 : undefined,
        top: y,
        fontSize: 13,
        letterSpacing: "0.28em",
        color: "var(--ash-500)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
}

/** 八点环：章节索引 */
export function ChapterRing({
  active = 4,
  x = 1700,
  y = 860,
  size = 96,
  dim = 0.16,
}: {
  active?: number | null;
  x?: number;
  y?: number;
  size?: number;
  dim?: number;
}) {
  const COLORS = [
    "#c97d6a", // Fe
    "#7e9b6b", // Se
    "#b99a5e", // Si
    "#5e86ae", // Te
    "#c7a361", // Ti
    "#4fa89e", // Ne
    "#7c9a8e", // Ni
    "#c2554a", // Fi
  ];
  const r = size / 2;
  const radius = size * 0.36;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ position: "absolute", left: x - r, top: y - r, overflow: "visible" }}
    >
      {COLORS.map((c, i) => {
        const ang = (-90 + i * 45) * (Math.PI / 180);
        const cx = r + Math.cos(ang) * radius;
        const cy = r + Math.sin(ang) * radius;
        const on = active === i;
        return (
          <g key={i}>
            {on && <circle cx={cx} cy={cy} r={7} fill={c} opacity={0.18} />}
            <circle
              cx={cx}
              cy={cy}
              r={on ? 3.2 : 2}
              fill={c}
              opacity={on ? 1 : dim}
              style={on ? { filter: `drop-shadow(0 0 6px ${c})` } : undefined}
            />
          </g>
        );
      })}
    </svg>
  );
}
