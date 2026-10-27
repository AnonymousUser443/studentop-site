/* =====================================================================
   图标库：单色 UI 图标（glyph）+ 彩色应用图标（app）
   用法：ICONS.glyph('search') / ICONS.app('terminal')
   ===================================================================== */
(function () {
  'use strict';

  /* ---------------- 单色 UI 图标（24 × 24，stroke = currentColor） ---------------- */
  var G = {
    search: '<circle cx="10.5" cy="10.5" r="6.6"/><path d="M15.3 15.3 20.5 20.5"/>',
    taskview: '<rect x="3" y="5" width="12.5" height="15" rx="2.2"/><path d="M18 8.5v9.8a2.2 2.2 0 0 1-2.2 2.2H7.5"/>',
    wifi: '<path d="M3 9.4a13.4 13.4 0 0 1 18 0"/><path d="M6 12.6a9 9 0 0 1 12 0"/><path d="M8.9 15.8a4.7 4.7 0 0 1 6.2 0"/><circle cx="12" cy="19" r="1.25" fill="currentColor" stroke="none"/>',
    volume: '<path d="M4 9.6h3.1L12 5.4v13.2L7.1 14.4H4z"/><path d="M15.4 9.2a4.3 4.3 0 0 1 0 5.6"/><path d="M18.2 6.6a8.2 8.2 0 0 1 0 10.8"/>',
    battery: '<rect x="2.5" y="7.4" width="16.4" height="9.2" rx="2.4"/><path d="M21 10.3v3.4" stroke-width="2.2" stroke-linecap="round"/><rect x="4.6" y="9.5" width="9.6" height="5" rx="1.2" fill="currentColor" stroke="none"/>',
    bell: '<path d="M6.2 9.6a5.8 5.8 0 0 1 11.6 0c0 3.9 1.2 5.4 2 6.4H4.2c.8-1 2-2.5 2-6.4z"/><path d="M10 19.2a2.2 2.2 0 0 0 4 0"/>',
    calendar: '<rect x="3.4" y="5" width="17.2" height="15.6" rx="2.6"/><path d="M3.4 9.6h17.2M8.2 2.8v3.4M15.8 2.8v3.4"/>',
    copy: '<rect x="8.4" y="8.4" width="12.2" height="12.2" rx="2.2"/><path d="M5.6 15.6H5a2.2 2.2 0 0 1-2.2-2.2V5A2.2 2.2 0 0 1 5 2.8h8.4A2.2 2.2 0 0 1 15.6 5v.6"/>',
    check: '<path d="m4.2 12.6 5.4 5.4L19.8 6.6"/>',
    mail: '<rect x="2.6" y="5" width="18.8" height="14" rx="2.6"/><path d="m3.8 7.2 8.2 5.7 8.2-5.7"/>',
    github: '<path fill="currentColor" stroke="none" d="M12 2C6.5 2 2 6.6 2 12.2c0 4.5 2.9 8.3 6.8 9.7.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.4-3.4-1.4-.4-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.7.3-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5.1 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.7 1a9.4 9.4 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 4-2.4 4.8-4.6 5.1.3.4.6.9.6 1.9v2.7c0 .3.2.6.7.5A10 10 0 0 0 22 12.2C22 6.6 17.5 2 12 2z"/>',
    external: '<path d="M14 3.8h6.2V10"/><path d="M20.2 3.8 11 13"/><path d="M18.4 13.6v4.6a2.2 2.2 0 0 1-2.2 2.2H5.6a2.2 2.2 0 0 1-2.2-2.2V7.6a2.2 2.2 0 0 1 2.2-2.2h4.6"/>',
    'chevron-down': '<path d="m6 9.3 6 6 6-6"/>',
    'chevron-up': '<path d="m6 14.7 6-6 6 6"/>',
    'chevron-right': '<path d="m9.3 6 6 6-6 6"/>',
    'chevron-left': '<path d="m14.7 6-6 6 6 6"/>',
    close: '<path d="m5.4 5.4 13.2 13.2M18.6 5.4 5.4 18.6"/>',
    minimize: '<path d="M5 12h14"/>',
    maximize: '<rect x="5" y="5" width="14" height="14" rx="1.6"/>',
    restore: '<rect x="4.6" y="8.6" width="10.8" height="10.8" rx="1.6"/><path d="M8.2 8.6V5.8a1.6 1.6 0 0 1 1.6-1.6h7.4a1.6 1.6 0 0 1 1.6 1.6v7.4a1.6 1.6 0 0 1-1.6 1.6h-2.8"/>',
    power: '<path d="M12 2.8v8.4"/><path d="M7.2 6a7.2 7.2 0 1 0 9.6 0"/>',
    user: '<circle cx="12" cy="8.4" r="3.9"/><path d="M4.4 20.6c.7-3.7 3.9-6 7.6-6s6.9 2.3 7.6 6"/>',
    gear: '<circle cx="12" cy="12" r="3.1"/><path d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6M5.4 5.4l1.9 1.9M16.7 16.7l1.9 1.9M18.6 5.4l-1.9 1.9M7.3 16.7l-1.9 1.9"/>',
    palette: '<path d="M12 2.8a9.2 9.2 0 1 0 0 18.4c1.5 0 2.1-1 2.1-1.9 0-1.8-1.7-2.2-1.7-3.8 0-1 .8-1.9 1.9-1.9h2.3A4.7 4.7 0 0 0 21.2 9C20.6 5.4 16.7 2.8 12 2.8z"/><circle cx="7.6" cy="9.4" r="1" fill="currentColor" stroke="none"/><circle cx="11" cy="6.8" r="1" fill="currentColor" stroke="none"/><circle cx="15.4" cy="8" r="1" fill="currentColor" stroke="none"/>',
    sun: '<circle cx="12" cy="12" r="4.1"/><path d="M12 2.4v2.2M12 19.4v2.2M2.4 12h2.2M19.4 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6"/>',
    moon: '<path d="M20.2 14.6A8.6 8.6 0 0 1 9.4 3.8a8.6 8.6 0 1 0 10.8 10.8z"/>',
    monitor: '<rect x="3" y="4.8" width="18" height="12.4" rx="2.2"/><path d="M9 21h6M12 17.2V21"/>',
    refresh: '<path d="M20.2 11a8.2 8.2 0 1 0-2.4 6.4"/><path d="M20.2 5.2V11h-5.8"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    sort: '<path d="M7 4.6v14.8M7 19.4l-3-3M7 19.4l3-3M17 19.4V4.6M17 4.6l-3 3M17 4.6l3 3"/>',
    'grid-view': '<rect x="4" y="4" width="6.6" height="6.6" rx="1.3"/><rect x="13.4" y="4" width="6.6" height="6.6" rx="1.3"/><rect x="4" y="13.4" width="6.6" height="6.6" rx="1.3"/><rect x="13.4" y="13.4" width="6.6" height="6.6" rx="1.3"/>',
    'list-view': '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.6" cy="6" r="1.05" fill="currentColor" stroke="none"/><circle cx="4.6" cy="12" r="1.05" fill="currentColor" stroke="none"/><circle cx="4.6" cy="18" r="1.05" fill="currentColor" stroke="none"/>',
    folder: '<path d="M3 7.6A2.6 2.6 0 0 1 5.6 5h3.2l2.1 2.4h7.5A2.6 2.6 0 0 1 21 10v7.4a2.6 2.6 0 0 1-2.6 2.6H5.6A2.6 2.6 0 0 1 3 17.4z"/>',
    file: '<path d="M6.2 3.8h7.4L19 9.2v11a1.8 1.8 0 0 1-1.8 1.8H6.2a1.8 1.8 0 0 1-1.8-1.8V5.6a1.8 1.8 0 0 1 1.8-1.8z"/><path d="M13.2 4v5.2h5.2"/>',
    image: '<rect x="3.4" y="4.4" width="17.2" height="15.2" rx="2.2"/><circle cx="9" cy="9.4" r="1.7"/><path d="m4.4 17.4 5-4.6 3.6 3 3.1-2.6 4.5 4.2"/>',
    code: '<path d="m8.4 8-4.6 4 4.6 4M15.6 8l4.6 4-4.6 4"/>',
    cpu: '<rect x="6.4" y="6.4" width="11.2" height="11.2" rx="2.2"/><rect x="9.6" y="9.6" width="4.8" height="4.8" rx="1"/><path d="M9.6 2.8v2.4M14.4 2.8v2.4M9.6 18.8v2.4M14.4 18.8v2.4M2.8 9.6h2.4M2.8 14.4h2.4M18.8 9.6h2.4M18.8 14.4h2.4"/>',
    globe: '<circle cx="12" cy="12" r="8.6"/><path d="M3.5 12h17M12 3.4c2.5 2.6 3.9 5.5 3.9 8.6s-1.4 6-3.9 8.6c-2.5-2.6-3.9-5.5-3.9-8.6S9.5 6 12 3.4z"/>',
    info: '<circle cx="12" cy="12" r="8.6"/><path d="M12 11v5.6"/><circle cx="12" cy="7.9" r="1.05" fill="currentColor" stroke="none"/>',
    trash: '<path d="M4.4 6.4h15.2M9.2 6.4V4.7A1.3 1.3 0 0 1 10.5 3.4h3a1.3 1.3 0 0 1 1.3 1.3v1.7"/><path d="M6.5 6.4l.9 13.1a1.6 1.6 0 0 0 1.6 1.5h6a1.6 1.6 0 0 0 1.6-1.5l.9-13.1"/>',
    lock: '<rect x="4.8" y="10.3" width="14.4" height="10.3" rx="2.3"/><path d="M8.2 10.3V7.6a3.8 3.8 0 0 1 7.6 0v2.7"/>',
    download: '<path d="M12 3.8v11"/><path d="m7.4 10.6 4.6 4.6 4.6-4.6"/><path d="M4.4 20h15.2"/>',
    'arrow-right': '<path d="M4.4 12h15.2M13.6 6l6 6-6 6"/>',
    dots: '<circle cx="5" cy="12" r="1.35" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.35" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.35" fill="currentColor" stroke="none"/>',
    clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7v5.5l3.5 2"/>',
    keyboard: '<rect x="2.4" y="6.4" width="19.2" height="11.2" rx="2.2"/><path d="M6 10h.02M9.2 10h.02M12.4 10h.02M15.6 10h.02M18.8 10h.02M7 13.6h10"/>',
    display: '<rect x="3" y="4.4" width="18" height="15.2" rx="2.2"/><path d="m4 16.2 4.8-4.4 3.9 3.4 3.1-2.6 5.2 4.4"/>',
    sparkle: '<path d="M12 3.2l1.9 5 5 1.9-5 1.9-1.9 5-1.9-5-5-1.9 5-1.9z"/><path d="M18.6 16.2l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8z"/>',
    pencil: '<path d="M15.4 4.6 19.4 8.6 8.6 19.4l-4.8 1 1-4.8z"/><path d="m13.6 6.4 4 4"/>',
    link: '<path d="M10 14a4.2 4.2 0 0 0 5.9 0l2.4-2.4a4.2 4.2 0 0 0-5.9-5.9L11 7.1"/><path d="M14 10a4.2 4.2 0 0 0-5.9 0l-2.4 2.4a4.2 4.2 0 0 0 5.9 5.9l1.4-1.4"/>',
    send: '<path d="M21 3.6 3.8 10.4l6.8 2.9 2.9 6.8z"/><path d="M21 3.6 10.6 13.3"/>',
    'arrow-left': '<path d="M19.6 12H4.4M10.4 6l-6 6 6 6"/>',
    home: '<path d="M4 10.4 12 3.6l8 6.8v8.6a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 19z"/><path d="M9.4 20.6v-5.8h5.2v5.8"/>',
    star: '<path d="m12 3.4 2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.8-5.4 2.8 1-6L3.2 9.8l6.1-.9z"/>',
    windows: '<rect x="3" y="3" width="8.2" height="8.2" rx="1.1" fill="currentColor" stroke="none"/><rect x="12.8" y="3" width="8.2" height="8.2" rx="1.1" fill="currentColor" stroke="none"/><rect x="3" y="12.8" width="8.2" height="8.2" rx="1.1" fill="currentColor" stroke="none"/><rect x="12.8" y="12.8" width="8.2" height="8.2" rx="1.1" fill="currentColor" stroke="none"/>'
  };

  /* ---------------- 彩色应用图标（48 × 48） ---------------- */
  var A = {};

  A.start = '<defs><linearGradient id="g-start" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#43b7ff"/><stop offset="1" stop-color="#0067c0"/></linearGradient></defs>' +
    '<g fill="url(#g-start)"><rect x="5" y="5" width="17" height="17" rx="1.4"/><rect x="26" y="5" width="17" height="17" rx="1.4"/><rect x="5" y="26" width="17" height="17" rx="1.4"/><rect x="26" y="26" width="17" height="17" rx="1.4"/></g>';

  A.thispc = '<defs><linearGradient id="g-pc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3f3f46"/><stop offset="1" stop-color="#18181b"/></linearGradient><linearGradient id="g-pcscr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#67d6ff"/><stop offset="0.55" stop-color="#2f8ce8"/><stop offset="1" stop-color="#1455b8"/></linearGradient></defs>' +
    '<rect x="3.5" y="7" width="41" height="27" rx="3" fill="url(#g-pc)"/>' +
    '<rect x="6.2" y="9.6" width="35.6" height="19.6" rx="1.6" fill="url(#g-pcscr)"/>' +
    '<path d="M6.2 27.4 41.8 11.4v16.2a1.6 1.6 0 0 1-1.6 1.6H7.8a1.6 1.6 0 0 1-1.6-1.8z" fill="#ffffff" opacity="0.10"/>' +
    '<rect x="17.5" y="36.5" width="13" height="3" rx="1.2" fill="#52525b"/>' +
    '<rect x="13" y="40.6" width="22" height="3.2" rx="1.6" fill="#a1a1aa"/>' +
    '<circle cx="24" cy="19.4" r="4.6" fill="#ffffff" opacity="0.16"/>';

  A.explorer = '<defs><linearGradient id="g-exp-back" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4cc2ff"/><stop offset="1" stop-color="#0b6bcb"/></linearGradient><linearGradient id="g-exp-front" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#ffd75e"/><stop offset="1" stop-color="#f2a20c"/></linearGradient></defs>' +
    '<path d="M3.5 10.2A3.2 3.2 0 0 1 6.7 7h8.1l3.2 3.6h17.7a3.2 3.2 0 0 1 3.2 3.2v16.5a3.4 3.4 0 0 1-3.4 3.4H6.9a3.4 3.4 0 0 1-3.4-3.4z" fill="url(#g-exp-back)"/>' +
    '<rect x="3.5" y="17.4" width="41" height="16.3" rx="3" fill="url(#g-exp-front)"/>' +
    '<path d="M3.5 20.4h41v-0.2a3 3 0 0 0-3-3h-35a3 3 0 0 0-3 3z" fill="#ffe08a" opacity="0.75"/>' +
    '<rect x="10.6" y="12.6" width="13.6" height="10.6" rx="1.4" fill="#ffffff" opacity="0.92"/>' +
    '<path d="M12.6 15.8h9.6M12.6 18.2h7.4" stroke="#9aa7b4" stroke-width="1.2" stroke-linecap="round"/>';

  A.projects = '<defs><linearGradient id="g-proj" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a78bfa"/><stop offset="1" stop-color="#6d28d9"/></linearGradient><linearGradient id="g-proj2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c4b5fd"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs>' +
    '<path d="M3.5 10.4A3.2 3.2 0 0 1 6.7 7.2h8.2l3.1 3.5h17.8a3.2 3.2 0 0 1 3.2 3.2v16.4a3.3 3.3 0 0 1-3.3 3.3H6.8a3.3 3.3 0 0 1-3.3-3.3z" fill="url(#g-proj)"/>' +
    '<rect x="3.5" y="17.6" width="41" height="16.2" rx="3" fill="url(#g-proj2)"/>' +
    '<path d="m17.6 24.4-3.2 3.6 3.2 3.6M30.4 24.4l3.2 3.6-3.2 3.6M26 23.4l-4 9" stroke="#ffffff" stroke-width="2.1" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';

  A.about = '<defs><linearGradient id="g-about" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7cc7ff"/><stop offset="0.5" stop-color="#2f8ce8"/><stop offset="1" stop-color="#0b4ea2"/></linearGradient></defs>' +
    '<circle cx="24" cy="24" r="20" fill="url(#g-about)"/>' +
    '<circle cx="24" cy="24" r="20" fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1"/>' +
    '<circle cx="24" cy="18.6" r="6.4" fill="#ffffff"/>' +
    '<path d="M11.4 39.4c1.4-7.4 6.5-11.6 12.6-11.6s11.2 4.2 12.6 11.6a20 20 0 0 1-25.2 0z" fill="#ffffff"/>';

  A.skills = '<defs><linearGradient id="g-skill-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f8fafc"/><stop offset="1" stop-color="#dbeafe"/></linearGradient><linearGradient id="g-skill-bar" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#0b6bcb"/><stop offset="1" stop-color="#4cc2ff"/></linearGradient></defs>' +
    '<rect x="4" y="4" width="40" height="40" rx="9" fill="url(#g-skill-bg)" stroke="#c7dff7" stroke-width="1"/>' +
    '<rect x="12" y="25" width="5.4" height="11" rx="1.6" fill="url(#g-skill-bar)"/>' +
    '<rect x="21.3" y="18" width="5.4" height="18" rx="1.6" fill="url(#g-skill-bar)"/>' +
    '<rect x="30.6" y="11.6" width="5.4" height="24.4" rx="1.6" fill="url(#g-skill-bar)"/>' +
    '<path d="M12 20.6 21.4 14l8.6 4.6 7.4-8.2" stroke="#0b6bcb" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.75"/>';

  A.contact = '<defs><linearGradient id="g-mail" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8fd6ff"/><stop offset="1" stop-color="#1673d1"/></linearGradient><linearGradient id="g-mail-flap" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e3effb"/></linearGradient></defs>' +
    '<rect x="3.5" y="9.5" width="41" height="29" rx="5" fill="url(#g-mail)"/>' +
    '<path d="M5.5 12.4 24 26.6l18.5-14.2A4.4 4.4 0 0 0 39.6 11H8.4a4.4 4.4 0 0 0-2.9 1.4z" fill="url(#g-mail-flap)"/>' +
    '<path d="M4.4 15.2 24 29.6 43.6 15.2" stroke="#0b6bcb" stroke-width="1.4" fill="none" opacity="0.5"/>';

  A.settings = '<defs><linearGradient id="g-gear" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9ee2ff"/><stop offset="0.5" stop-color="#3aa7f0"/><stop offset="1" stop-color="#0b5fae"/></linearGradient></defs>' +
    '<path d="M24 3.6a20.4 20.4 0 1 0 0 40.8 20.4 20.4 0 0 0 0-40.8z" fill="url(#g-gear)"/>' +
    '<path d="M24 13.4a10.6 10.6 0 1 0 0 21.2 10.6 10.6 0 0 0 0-21.2z" fill="#ffffff" opacity="0.94"/>' +
    '<path d="M24 17.6a6.4 6.4 0 1 0 0 12.8 6.4 6.4 0 0 0 0-12.8z" fill="#1f6fb8"/>' +
    '<g fill="#ffffff"><rect x="21.6" y="6.2" width="4.8" height="5.2" rx="1.2"/><rect x="21.6" y="36.6" width="4.8" height="5.2" rx="1.2"/><rect x="6.2" y="21.6" width="5.2" height="4.8" rx="1.2"/><rect x="36.6" y="21.6" width="5.2" height="4.8" rx="1.2"/><rect x="9.8" y="9.8" width="4.6" height="4.6" rx="1.1" transform="rotate(45 12.1 12.1)"/><rect x="33.6" y="33.6" width="4.6" height="4.6" rx="1.1" transform="rotate(45 35.9 35.9)"/><rect x="33.6" y="9.8" width="4.6" height="4.6" rx="1.1" transform="rotate(45 35.9 12.1)"/><rect x="9.8" y="33.6" width="4.6" height="4.6" rx="1.1" transform="rotate(45 12.1 35.9)"/></g>';

  A.terminal = '<defs><linearGradient id="g-term" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a3a3d"/><stop offset="1" stop-color="#161618"/></linearGradient></defs>' +
    '<rect x="3.5" y="6" width="41" height="36" rx="5" fill="url(#g-term)"/>' +
    '<rect x="3.5" y="6" width="41" height="9.4" rx="5" fill="#4a4a4f" opacity="0.85"/>' +
    '<circle cx="11" cy="10.8" r="1.7" fill="#ff5f57"/><circle cx="17" cy="10.8" r="1.7" fill="#febc2e"/><circle cx="23" cy="10.8" r="1.7" fill="#28c840"/>' +
    '<path d="m12.4 22.6 4.4 4.4-4.4 4.4" stroke="#4cc2ff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M20.4 31.4h8.6" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round"/>';

  A.notepad = '<defs><linearGradient id="g-note" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#eef4fb"/></linearGradient></defs>' +
    '<path d="M9 4.6h19.4l11 11v27.2a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V7.6a3 3 0 0 1 3-3z" fill="url(#g-note)" stroke="#c9d8e8" stroke-width="1"/>' +
    '<path d="M28.4 4.6v11h11" fill="#dbeafe"/>' +
    '<path d="M28.4 4.6v11h11" fill="none" stroke="#b9cde2" stroke-width="1"/>' +
    '<path d="M13.4 22.4h21M13.4 28h21M13.4 33.6h14.6" stroke="#8aa7c2" stroke-width="1.8" stroke-linecap="round"/>';

  A.photos = '<defs><linearGradient id="g-photo-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ee7ff"/><stop offset="1" stop-color="#e8f7ff"/></linearGradient><linearGradient id="g-photo-m1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7c5cff"/><stop offset="1" stop-color="#3b1fa3"/></linearGradient><linearGradient id="g-photo-m2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9a9e"/><stop offset="1" stop-color="#c62b6b"/></linearGradient></defs>' +
    '<rect x="3.5" y="6" width="41" height="36" rx="7" fill="url(#g-photo-sky)"/>' +
    '<circle cx="34" cy="17" r="5.2" fill="#ffd166"/>' +
    '<path d="M3.5 34.4 14.6 22l8.2 8 6.4-5.8 15.8 13.2v1.6a3 3 0 0 1-3 3h-35a3 3 0 0 1-3-3z" fill="url(#g-photo-m1)"/>' +
    '<path d="M3.5 37.2 11.8 29l7 6.6 5.4-4.6 20 12.6v1a3 3 0 0 1-3 3H6.5a3 3 0 0 1-3-3z" fill="url(#g-photo-m2)" opacity="0.95"/>';

  A.recycle = '<defs><linearGradient id="g-bin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c7ecff"/><stop offset="1" stop-color="#5aa9e0"/></linearGradient></defs>' +
    '<path d="M12.6 8.6h22.8l-2.6 33.2a4 4 0 0 1-4 3.7H19.2a4 4 0 0 1-4-3.7z" fill="url(#g-bin)" opacity="0.9" stroke="#3f8fc8" stroke-width="1"/>' +
    '<rect x="10" y="4.6" width="28" height="5.6" rx="2.8" fill="#8fd0f5" stroke="#3f8fc8" stroke-width="1"/>' +
    '<path d="M24 20.2c-4.6 0-8.2 3.4-8.2 7.8 0 2.4 1.1 4.5 2.9 5.9l1.4-1.9a6 6 0 0 1-2-4c0-3.1 2.6-5.5 5.9-5.5s5.9 2.4 5.9 5.5c0 1.5-.6 2.9-1.6 3.9l1.5 1.8a8.1 8.1 0 0 0 2.8-5.7c0-4.4-3.6-7.8-8.2-7.8z" fill="#ffffff" opacity="0.85"/>' +
    '<path d="m24 16.4 3.4 4.6h-6.8z" fill="#ffffff" opacity="0.9"/>';

  /* 外部项目快捷方式图标：北湖霜降雅集（纸笺秋山） / 理韵寻踪（HUD 瞄准环） */
  A.frost = '<defs><linearGradient id="g-frost" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fdf6e8"/><stop offset="1" stop-color="#efdfc2"/></linearGradient><linearGradient id="g-frost-mtn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#61796c"/><stop offset="1" stop-color="#2f4439"/></linearGradient></defs>' +
    '<rect x="3" y="3" width="42" height="42" rx="10" fill="url(#g-frost)" stroke="#d9c6a3" stroke-width="1.2"/>' +
    '<circle cx="33.4" cy="14.6" r="4.1" fill="#c2543f"/>' +
    '<path d="M6.2 34.6 17.4 20.6l6.2 8.2 5.3-6.5 12.9 12.3z" fill="url(#g-frost-mtn)"/>' +
    '<path d="m15 23.8 2.4-3.2 2.4 3.1" stroke="#fdf6e8" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.92"/>' +
    '<path d="M6.6 34.6h34.8" stroke="#8a7150" stroke-width="1.7" stroke-linecap="round" opacity="0.75"/>';
  A.liyun = '<defs><linearGradient id="g-liyun" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#29655b"/><stop offset="1" stop-color="#0f2724"/></linearGradient></defs>' +
    '<rect x="3" y="3" width="42" height="42" rx="10" fill="url(#g-liyun)"/>' +
    '<path d="M11.8 34.2c4.4-5.8 8.8-8.4 16.4-9.9" stroke="#7fd8c4" stroke-width="1.5" stroke-dasharray="3 3.4" stroke-linecap="round" opacity="0.85"/>' +
    '<circle cx="24" cy="24" r="10.8" fill="none" stroke="#7fd8c4" stroke-width="1.5" opacity="0.45"/>' +
    '<circle cx="24" cy="24" r="5.6" fill="none" stroke="#e9c37c" stroke-width="1.9"/>' +
    '<path d="M24 8.4v5.1M24 34.5v5.1M8.4 24h5.1M34.5 24h5.1" stroke="#e9c37c" stroke-width="1.9" stroke-linecap="round"/>' +
    '<circle cx="24" cy="24" r="1.75" fill="#f6e6bd"/>';

  /* 原神启动：暗夜色 + 发光门洞 */
  A.genshin = '<defs><linearGradient id="g-gs-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a4f7a"/><stop offset="1" stop-color="#0b1a2c"/></linearGradient><linearGradient id="g-gs-door" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6d8"/><stop offset="1" stop-color="#e6bd74"/></linearGradient></defs>' +
    '<rect x="3" y="3" width="42" height="42" rx="10" fill="url(#g-gs-bg)"/>' +
    '<circle cx="24" cy="24" r="15.5" fill="#ffe9b0" opacity="0.14"/>' +
    '<path d="M15.6 34.4V20.6a8.4 8.4 0 0 1 16.8 0v13.8z" fill="url(#g-gs-door)"/>' +
    '<path d="M19.8 34.4V21.6a4.2 4.2 0 0 1 8.4 0v12.8z" fill="#2a4f7a" opacity="0.55"/>' +
    '<path d="M12 34.8h24" stroke="#f3d79a" stroke-width="1.9" stroke-linecap="round"/>' +
    '<path d="M24 4.6v3.2M13.2 7.6l1.6 2.8M34.8 7.6l-1.6 2.8" stroke="#f7e3b4" stroke-width="1.6" stroke-linecap="round" opacity="0.85"/>';

  A.cv = '<defs><linearGradient id="g-cv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#eef4fb"/></linearGradient></defs>' +
    '<rect x="9" y="4.5" width="30" height="39" rx="3.4" fill="url(#g-cv)" stroke="#c9d8e8" stroke-width="1"/>' +
    '<circle cx="18.4" cy="15.4" r="4.2" fill="#8fd0f5"/>' +
    '<path d="M25.4 12.6h9M25.4 16.4h6.6" stroke="#8aa7c2" stroke-width="1.8" stroke-linecap="round"/>' +
    '<path d="M14 25.4h20M14 30h20M14 34.6h13" stroke="#b3c8dc" stroke-width="1.8" stroke-linecap="round"/>';

  var GLYPH_ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';
  var APP_ATTRS = 'viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"';

  function glyph(name) {
    var body = G[name];
    if (!body) body = G.info;
    return '<svg ' + GLYPH_ATTRS + '>' + body + '</svg>';
  }
  function app(name) {
    var body = A[name];
    if (!body) body = A.notepad;
    return '<svg ' + APP_ATTRS + '>' + body + '</svg>';
  }

  window.ICONS = {
    glyph: glyph,
    app: app,
    names: Object.keys(G),
    appNames: Object.keys(A)
  };
})();
