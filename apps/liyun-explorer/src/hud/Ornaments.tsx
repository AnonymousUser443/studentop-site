import { useId } from 'react';

export function MenuShape({ variant }: { variant: 'dark' | 'light' | 'gold' }) {
  const id = `menu-${useId().replace(/:/g, '')}`;
  const stops = variant === 'light' ? ['#fff8d8', '#e5d7aa'] : variant === 'gold' ? ['#fff4c5', '#edb660'] : ['#244940', '#3d5a4d'];
  return <svg className="menu-shape" viewBox="0 0 340 84" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id={id}><stop stopColor={stops[0]}/><stop offset="1" stopColor={stops[1]} stopOpacity={variant === 'dark' ? '.87' : '1'}/></linearGradient></defs><path d="M42 3H304L314 11v11l18 20-18 20v11l-10 8H42C20 81 4 63 4 42S20 3 42 3Z" fill={`url(#${id})`} stroke="#c6ae72" strokeWidth="1.6"/><path d="M43 8h257l9 7v10l15 17-15 17v10l-9 7H43C24 76 9 61 9 42S24 8 43 8Z" fill="none" stroke={variant === 'dark' ? '#a69565' : '#fff7ce'} strokeWidth="1"/><path d="m310 42 5-6 5 6-5 6zM16 42l5-6 5 6-5 6z" fill="none" stroke="#ddc58c"/><path d="M275 13q-25 2-17 19t-13 22q-18 10 3 20M292 11q-22 15-7 25t-9 34" fill="none" stroke={variant === 'dark' ? '#738267' : '#fff2bf'} strokeWidth="9" opacity=".28"/></svg>;
}

export function BrandGate() {
  return <svg className="brand-gate" viewBox="0 0 180 160" aria-hidden="true"><defs><clipPath id="brand-circle"><circle cx="83" cy="77" r="61"/></clipPath><linearGradient id="brand-sky" x2="0" y2="1"><stop stopColor="#b9c8ae"/><stop offset="1" stopColor="#f7edc5"/></linearGradient></defs><circle cx="83" cy="77" r="66" fill="none" stroke="#d9bc75" strokeWidth="2"/><circle cx="83" cy="77" r="61" fill="url(#brand-sky)"/><g clipPath="url(#brand-circle)"><path d="m4 102 19-45 17 25 23-52 20 44 20-33 31 50 15-23 30 57v35H0Z" fill="#849b7d"/><path d="m-5 126 31-30 17 8 20-23 16 25 20-25 28 29 30-13 31 24v60H0" fill="#4e7560"/><path d="M53 128V77h59v51H97v-25q-15-22-30 0v25Z" fill="#2d5549"/><path d="M47 79h72L102 66H65zM58 62h50l-9-8H67zM70 48h27M75 47V36h16v11" fill="#2d5549"/><path d="M56 85h53M60 91h8v29m31-29h8v29M68 68h30M73 58h20" fill="none" stroke="#e9d89c" strokeWidth="2"/><path d="M-5 139q43-30 89-4t104-5v30H0" fill="#e8daa9"/><path d="M19 112q20-16 39-1t41 4q12-3 4-7" fill="none" stroke="#d8b873" strokeWidth="3"/></g><path d="m30 27-12-9 4-7 16 10m10-9-3-11 10-1 6 14m46 2 7-8 9 5-9 10" fill="none" stroke="#bca268" strokeWidth="3"/><path d="M8 136c26-22 57-2 79-6 21-4-1-13-20-7-14 5-9 12 8 13h73c21 0 17 8 2 9H26c-23 0-27-4-18-9Z" fill="#fff0be" stroke="#bd9f58"/><path d="M18 139h103M88 127h26" stroke="#d5b674"/></svg>;
}

export function CompassRose() {
 return <svg viewBox="0 0 112 120" aria-hidden="true"><circle cx="56" cy="64" r="36" fill="#25473a" fillOpacity=".38" stroke="#dfd0a1" strokeWidth="1.5"/><circle cx="56" cy="64" r="30" fill="none" stroke="#cfbe8f" strokeWidth=".6"/><path d="m56 18 7 38 39 8-39 7-7 40-8-40-39-7 39-8z" fill="#eadbb4"/><path d="m56 18 0 46 7-8m39 8-46 0 7 7m-7 40V64l-8 7M9 64h47l-8-8" fill="#657763"/><path d="m31 39 25 17 25-17-17 25 17 25-25-17-25 17 17-25z" fill="#dfcda2" stroke="#294e42" strokeWidth="1.3"/><circle cx="56" cy="64" r="9" fill="#2f5548" stroke="#eadbb4"/><path d="m56 57 4 7-4 7-4-7z" fill="#eadbb4"/></svg>;
}

export function EdgeOrnaments() {
 return <div className="edge-ornaments" aria-hidden="true"><svg className="edge-bottom" viewBox="0 0 1920 360" preserveAspectRatio="none"><defs><g id="pine-sprig"><path d="m0 90 20-42 25-4 32-25 36 1" fill="none" stroke="#233f36" strokeWidth="7"/><path d="m12 57-26-5 13-18 16-1-8-11 23-7 17 11 19-3 18 18-18 10-27-5Zm47-30-10-14 19-15 23 7 19-11 21 12-4 16-26 8-25-8Z" fill="#285145"/><path d="m-3 40 21-12 17 5m32-19 14-4 18 7" fill="none" stroke="#63816a" strokeWidth="3"/></g><g id="ginkgo-bough"><path d="M0 90 40 45l32-31M39 47l-13-18m16 15 29-5" fill="none" stroke="#91804e" strokeWidth="3"/><path d="M27 30C8 27 11 5 24 10c11-10 28 2 19 11Z M72 15C58 9 64-9 76-4c13-6 27 8 15 18Z M70 40C62 25 81 16 90 26c13 0 17 19 3 23Z" fill="#d3b45c"/><path d="m27 29-3-13m4 12 9-11m36-4 5-14m-3 16 11-9M72 39l17-5" stroke="#ecce7c" fill="none"/></g></defs>
 <path d="M0 37c87-13 130 46 178 61 49 16 68-11 107 21 54 44 79 65 135 58 56-7 83 29 113 51 81 58 189 35 236 70 58 43 128 22 191 21 80-1 152 32 218 12 58-17 91-66 137-73 62-9 111-23 157-58 54-41 86-90 143-105 75-19 133-14 185-61v326H0Z" fill="#f2e4b9"/>
 <path d="M0 68c65 29 82 9 106 42 28 38 83 19 123 43s38 38 94 47c-59-12-78 12-41 28 49 23 99-18 155 8s42 40 106 51c91 14 85-8 164 20 46 16 54 38 117 39l-11 14H0Z" fill="#fff3cd"/>
 <path d="M0 137c80-24 122-1 134 23 16 34-60 34-55 60 4 22 65 14 82 36 13 17-16 44-1 68 10 16 28 25 51 36H0Z" fill="#dfcb8d"/>
 <path d="M0 157c65-16 103 1 107 18 5 26-59 26-65 51-8 34 65 37 54 64-10 22-58 14-72 36l-3 34H0Z" fill="#fff3cb"/>
 <path d="M1920 50c-39 43-84 39-141 61-52 20-48 39-100 56-59 19-117 21-159 67-37 40-91 49-105 80-10 22 11 31 60 46h445Z" fill="#d5c18b"/>
 <path d="M1920 63c-36 47-102 41-132 66-23 19 7 25-12 44-37 36-109 14-139 54-27 36 20 42-29 63-31 13-75 45-61 70h373Z" fill="#fff0c2"/>
 <path d="M1920 80c-38 32-84 36-111 58-17 14 3 28-16 44-32 26-102 23-129 51m-288 87c65-9 90-46 128-56M3 81c66 17 55 47 99 52M215 198c61 1 53 32 110 36m43 25c60-15 90 38 138 32" fill="none" stroke="#fff8db" strokeWidth="3"/>
 <path d="m1920 133-56-49-44 54-40-8-62 61-29 4-66 63-29 3-69 99h395Z" fill="#234a40"/>
 <path d="m1920 133-56-49-14 60-37 30-20 52-30 25-13 109h170Z" fill="#335c4d"/>
 <path d="m1864 84-44 54-40-8-62 61-29 4-66 63-29 3-69 99m339-212-17 19-11 42-25 5-15 57" fill="none" stroke="#a99962" strokeWidth="2"/>
 <path d="M1529 322q32-37 65-25t45-5q40-41 79-31t50-5q34-26 72-23 49 3 80-16v143h-430Z" fill="#193e35"/>
 <path d="M1547 326q36-25 68-14t66-14m34-10q32-23 60-16" stroke="#b4a568" strokeWidth="1.5" fill="none"/>
 <use href="#ginkgo-bough" transform="translate(48 16) scale(1.25)"/><use href="#ginkgo-bough" transform="translate(224 174) scale(.85)"/><use href="#ginkgo-bough" transform="translate(1571 256) scale(.8) rotate(-12)"/><use href="#ginkgo-bough" transform="translate(1768 181) scale(.65) rotate(15)"/>
 </svg><svg className="edge-top" viewBox="0 0 1920 220" preserveAspectRatio="none"><path d="M0 0h1920v55l-34-12-19 25-37-32-46 15-39-39-54 16-30-18-60 13-49-23-52 16-54-16H537l-39 22-29-6-51 42-43-18-33 27-40-24-36 8-33-29-68 18-26-14-30 30-42-16-34 34L0 77Z" fill="#244b40" opacity=".88"/><path d="M1430 0h490v167l-26-35-24 12-20-49-39 8-39-54-40 7-40-40-35 13-38-20-45 9-35-18Z" fill="#193f36" opacity=".8"/><path d="m1809 55 33 43 28-3 30 51" stroke="#b1a16e" fill="none" opacity=".7"/></svg></div>;
}
