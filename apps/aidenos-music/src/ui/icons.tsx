import type { CSSProperties } from "react";

export type IconName =
  | "play"
  | "pause"
  | "next"
  | "previous"
  | "home"
  | "search"
  | "library"
  | "heart"
  | "queue"
  | "lyrics"
  | "volume"
  | "muted"
  | "close"
  | "back"
  | "forward"
  | "more"
  | "plus"
  | "check"
  | "shuffle"
  | "repeat"
  | "repeat-one"
  | "album"
  | "artist"
  | "clock"
  | "logout"
  | "arrow-up"
  | "arrow-down"
  | "refresh"
  | "expand"
  | "lock"
  | "remove"
  | "sun"
  | "headphones"
  | "chevron"
  | "external"
  | "waveform"
  | "pulse"
  | "settings";
const paths: Record<
  Exclude<IconName, "play" | "pause" | "next" | "previous">,
  React.ReactNode
> = {
  home: (
    <>
      <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  library: (
    <>
      <path d="M4 4v16M9 4v16m5-16 5 16M3 8h7m-7 8h7" />
    </>
  ),
  heart: (
    <path d="M20.7 5.8a5.3 5.3 0 0 0-8.7 1 5.3 5.3 0 0 0-8.7-1C-.3 10.4 5 16.2 12 21c7-4.8 12.3-10.6 8.7-15.2Z" />
  ),
  queue: (
    <>
      <path d="M4 5h16M4 10h16M4 15h9m-9 5h9m4-5 4 3-4 3Z" />
    </>
  ),
  lyrics: (
    <>
      <path d="M4 4h16v13H9l-5 4Z" />
      <path d="M8 8h8m-8 5h5" />
    </>
  ),
  volume: (
    <>
      <path d="m4 9 4 0 5-4v14l-5-4H4Z" />
      <path d="M17 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
    </>
  ),
  muted: (
    <>
      <path d="m4 9 4 0 5-4v14l-5-4H4Z" />
      <path d="m17 9 5 6m0-6-5 6" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  back: <path d="m14 5-7 7 7 7" />,
  forward: <path d="m10 5 7 7-7 7" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  plus: <path d="M12 4v16M4 12h16" />,
  check: <path d="m4 12 5 5L20 6" />,
  shuffle: (
    <>
      <path d="M4 6h3c4 0 6 12 10 12h3M4 18h3c1.7 0 3.2-2.3 4.6-5m1-2c1.4-2.8 2.8-5 4.4-5h3" />
      <path d="m17 3 3 3-3 3m0 6 3 3-3 3" />
    </>
  ),
  repeat: (
    <>
      <path d="m18 2 4 4-4 4M2 6h20M6 22l-4-4 4-4m16 4H2" />
      <path d="M2 6v5m20 2v5" />
    </>
  ),
  "repeat-one": (
    <>
      <path d="m18 2 4 4-4 4M2 6h20M6 22l-4-4 4-4m16 4H2" />
      <path d="m10 10 2-1v6m-2 0h4" />
    </>
  ),
  album: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  artist: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6l4 2" />
    </>
  ),
  logout: (
    <>
      <path d="M10 4H4v16h6m4-12 4 4-4 4m-5-4h12" />
    </>
  ),
  "arrow-up": <path d="m6 13 6-6 6 6M12 7v14" />,
  "arrow-down": <path d="m6 11 6 6 6-6M12 3v14" />,
  refresh: (
    <>
      <path d="M20 10a8 8 0 1 0 0 5m0-12v7h-7" />
    </>
  ),
  expand: (
    <>
      <path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2" />
    </>
  ),
  remove: (
    <>
      <path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5" />
    </>
  ),
  headphones: (
    <>
      <path d="M4 14v-3a8 8 0 0 1 16 0v3" />
      <rect x="3" y="12" width="4" height="9" rx="2" />
      <rect x="17" y="12" width="4" height="9" rx="2" />
    </>
  ),
  chevron: <path d="m6 9 6 6 6-6" />,
  external: (
    <>
      <path d="M13 3h8v8m-1-7L10 14M9 4H4v16h16v-5" />
    </>
  ),
  waveform: (
    <path d="M3 12h2l2-6 3 12 3-9 2 5h6" />
  ),
  pulse: (
    <>
      <path d="M3 12h4l2-7 4 14 2-7h6" />
      <circle cx="9" cy="5" r="1" />
    </>
  ),
  settings: (
    <>
      <path d="M4 6h16M4 12h16M4 18h16" />
      <circle cx="9" cy="6" r="2" />
      <circle cx="16" cy="12" r="2" />
      <circle cx="8" cy="18" r="2" />
    </>
  ),
};
export function Icon({
  name,
  size = 20,
  className,
  style,
}: {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const solid =
    name === "play" ||
    name === "pause" ||
    name === "next" ||
    name === "previous";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={solid ? "currentColor" : "none"}
      stroke={solid ? "none" : "currentColor"}
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={style}
    >
      {name === "play" ? (
        <path d="M7 4.6c0-.8.8-1.2 1.4-.8l12 7.4a.9.9 0 0 1 0 1.6l-12 7.4c-.6.4-1.4 0-1.4-.8Z" />
      ) : name === "pause" ? (
        <>
          <rect x="6" y="4" width="4" height="16" rx="1" />
          <rect x="14" y="4" width="4" height="16" rx="1" />
        </>
      ) : name === "next" ? (
        <>
          <path d="m4 5 12 7L4 19Z" />
          <rect x="17" y="4" width="3" height="16" rx="1" />
        </>
      ) : name === "previous" ? (
        <>
          <path d="m20 5-12 7 12 7Z" />
          <rect x="4" y="4" width="3" height="16" rx="1" />
        </>
      ) : (
        paths[name]
      )}
    </svg>
  );
}
export function TideMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M37.7 9.5a19 19 0 1 0 1 27.9"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M8 29c7-11 13-11 20-1s11 6 14-1M8 35c8-8 13-8 20-1s10 4 14 0"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
      />
      <circle cx="32" cy="14" r="4" fill="currentColor" />
    </svg>
  );
}
