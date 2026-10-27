import type { IconName } from '../types';

export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.1, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const shapes: Record<IconName, React.ReactNode> = {
    book: <><path d="M5 9c7-2 12-1 19 3v28c-7-4-12-5-19-3zM43 9c-7-2-12-1-19 3v28c7-4 12-5 19-3z"/><path d="M10 15v16m5-14v12m18-12v12m5-14v16"/><path d="M24 5v7"/></>,
    flower: <><path d="M24 23C7 16 17 2 24 8c7-6 17 8 0 15ZM25 25c2-18 19-13 16-4 8 5-1 17-16 4ZM24 27c17-4 18 13 8 13-2 9-17 4-8-13ZM21 27c8 16-8 21-10 11-10 0-8-16 10-11ZM21 23C8 35-1 20 8 16c-2-10 14-11 13 7Z" fill="currentColor" strokeWidth=".8"/><circle cx="24" cy="24" r="3" fill="#c5ac72" stroke="none"/></>,
    leaf: <><path d="m24 3 5 12 10-6-4 14 10 2-14 11-7-5-8 5L3 25l10-2L9 9l10 6z" fill="currentColor" strokeWidth=".5"/><path d="m24 12-1 33M13 22l10 10 12-10" stroke="#a26c35" strokeWidth="1.2"/></>,
    scroll: <><path d="M12 7h24l-3 30H10c-6 0-6-8 1-8h23M12 7c-6 0-6 7 0 7h22M32 7c-5 0-5 7 0 7h8c5 0 5-7 0-7z"/><path d="m17 19 12 1m-13 5 12 1m-12 6 10 1M9 37c0 5 10 6 11 0"/></>,
    people: <><circle cx="23" cy="15" r="6" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="4" fill="currentColor" stroke="none"/><circle cx="37" cy="18" r="4" fill="currentColor" stroke="none"/><path d="M11 39v-6c0-12 25-12 25 0v6zM3 35v-6c0-7 7-10 12-6M45 35v-6c0-7-7-10-12-6" fill="currentColor" strokeWidth="1"/></>,
    settings: <><path d="m20 4 8 0 2 6 6 3 6-1 4 7-4 5 0 6 3 5-5 6-6-2-5 3-2 5h-8l-2-6-6-3-6 1-4-7 4-5v-6l-3-5 5-6 6 2 5-3z" fill="currentColor" transform="translate(1 -1) scale(.95)" stroke="none"/><circle cx="24" cy="24" r="8" fill="#254740" stroke="none"/></>,
    compass: <><circle cx="24" cy="24" r="16"/><circle cx="24" cy="24" r="5"/><path d="M24 1v14m0 18v14M1 24h14m18 0h14M24 15l5 9-5 9-5-9z" fill="currentColor"/><path d="m8 8 4 4m24 24 4 4M8 40l4-4m24-24 4-4"/></>,
    chest: <><path d="M6 17h36v22H6zM6 17l4-9h28l4 9M5 24h38"/><path d="M19 21h10v9H19z" fill="currentColor"/><path d="M12 9v8m24-8v8M10 39v3m28-3v3"/></>,
    lake: <><path d="M24 3C21 14 9 20 9 29a15 15 0 0 0 30 0C39 20 27 14 24 3Z" fill="currentColor"/><path d="M24 12c-3 10-8 13-8 19 0 4 3 7 7 8M28 19c4 7 6 10 4 15" stroke="#e0f5eb" strokeWidth="1.2"/></>,
    gate: <><path d="M9 41V18h30v23M6 18h36L33 11H15zM4 11h40M19 11V6h10v5M20 41V25h8v16M6 41h36"/><path d="M9 21h30M12 23v15m24-15v15M24 3v3"/></>,
    sport: <><circle cx="28" cy="8" r="4" fill="currentColor"/><path d="m10 21 8-7 10 4 8 5 6-3M25 16l-6 13-10 4M19 29l11 3 1 12M10 43l7-11" strokeWidth="4"/></>,
    star: <><path d="m24 3 5 15 15 6-15 6-5 15-5-15-15-6 15-6z"/><path d="m24 14 3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="currentColor"/></>,
    lock: <><path d="M15 22v-8c0-12 18-12 18 0v8" strokeWidth="3.5"/><rect x="9" y="21" width="30" height="23" rx="3" fill="currentColor" stroke="none"/><circle cx="24" cy="30" r="3.5" fill="#35554a" stroke="none"/><path d="M24 32v6" stroke="#35554a" strokeWidth="3"/></>,
    moon: <><path d="M32 4C8 1 1 32 22 42c8 4 18 0 22-7C24 40 14 18 32 4Z" fill="currentColor"/><path d="M12 24c0 8 5 14 13 15" stroke="#fbf1cf" strokeWidth="1"/></>,
    tower: <><path d="M24 2v7m-4 0h8l3 24 7 11H10l7-11z"/><path d="M20 16h8m-10 8h12M17 33h14M20 44v-8h8v8M24 9v21"/><path d="M13 44h22" strokeWidth="4"/></>,
    close: <><path d="m12 12 24 24m0-24L12 36" strokeWidth="3"/></>,
    sound: <><path d="m6 18 9 0 11-9v30L15 30H6z"/><path d="M32 17c5 4 5 10 0 14m5-20c9 7 9 19 0 26"/></>,
    fullscreen: <><path d="M7 19V7h12m10 0h12v12M7 29v12h12m10 0h12V29M7 7l12 12M41 7 29 19M7 41l12-12m22 12L29 29" strokeWidth="3"/></>,
    plus: <path d="M24 9v30M9 24h30" strokeWidth="4"/>
  };
  return <svg className={`ly-icon ${className}`} viewBox="0 0 48 48" aria-hidden="true" {...common}>{shapes[name]}</svg>;
}
