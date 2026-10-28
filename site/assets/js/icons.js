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

  /* Paper-cut application icons (48 × 48). Flat cut layers, no duplicate SVG ids. */
  var A = {};
  A.start = "<g fill=\"#173e31\" opacity=\".2\" transform=\"translate(1.5 2)\"><rect x=\"5\" y=\"5\" width=\"17\" height=\"17\" rx=\"1.5\"/><rect x=\"26\" y=\"5\" width=\"17\" height=\"17\" rx=\"1.5\"/><rect x=\"5\" y=\"26\" width=\"17\" height=\"17\" rx=\"1.5\"/><rect x=\"26\" y=\"26\" width=\"17\" height=\"17\" rx=\"1.5\"/></g><g stroke=\"#d9d8b3\" stroke-width=\".8\"><rect x=\"4\" y=\"4\" width=\"17\" height=\"17\" rx=\"1.5\" fill=\"#3d8974\"/><rect x=\"25\" y=\"4\" width=\"17\" height=\"17\" rx=\"1.5\" fill=\"#72aa8d\"/><rect x=\"4\" y=\"25\" width=\"17\" height=\"17\" rx=\"1.5\" fill=\"#246653\"/><rect x=\"25\" y=\"25\" width=\"17\" height=\"17\" rx=\"1.5\" fill=\"#43816b\"/></g>";
  A.thispc = "<path d=\"M20 32h8v8h-8z\" fill=\"#8f9b7e\"/><rect x=\"12\" y=\"40\" width=\"24\" height=\"3\" rx=\"1.5\" fill=\"#c9b77e\"/><rect x=\"3\" y=\"6\" width=\"42\" height=\"29\" rx=\"4\" fill=\"#244d3d\" stroke=\"#b6c9a8\"/><rect x=\"6\" y=\"9\" width=\"36\" height=\"21\" rx=\"1\" fill=\"#dfe7c9\"/><circle cx=\"33\" cy=\"15\" r=\"4\" fill=\"#d7b667\"/><path d=\"M6 28l12-13 10 10 7-6 7 9v2H6z\" fill=\"#9cbea2\"/><path d=\"M6 30l9-7 9 5 7-7 11 9z\" fill=\"#47826b\"/><path d=\"M8 10h32\" stroke=\"#fffbea\" opacity=\".7\"/>";
  A.explorer = "<path d=\"M4 12V8h14l4 5h18v25H4z\" fill=\"#987c48\"/><path d=\"M7 12h34v25H7z\" fill=\"#c5b785\"/><path d=\"M10 9h23v26H10z\" fill=\"#fff9e9\" stroke=\"#c0b58c\"/><path d=\"M14 15h15m-15 5h10\" stroke=\"#9bb4a0\" stroke-width=\"2\"/><path d=\"M3 22h42l-4 19H5z\" fill=\"#d7b66d\" stroke=\"#ad9056\"/><path d=\"M4 23h40\" stroke=\"#f5df9d\" stroke-width=\"2\"/>";
  A.projects = "<path d=\"M4 10h13l5 5h19v25H4z\" fill=\"#255644\"/><path d=\"M9 10h26v26H9z\" fill=\"#f9f1d9\" stroke=\"#b7ad86\"/><path d=\"M14 14h16m-16 4h10\" stroke=\"#b3b894\"/><path d=\"M3 21h42l-4 20H5z\" fill=\"#5c9b7e\" stroke=\"#356d55\"/><path d=\"M4 22h40\" stroke=\"#c7d8b0\"/><path d=\"m17 27-4 4 4 4m14-8 4 4-4 4m-6-9-3 10\" fill=\"none\" stroke=\"#fff6db\" stroke-width=\"2\" stroke-linecap=\"round\"/>";
  A.about = "<circle cx=\"25\" cy=\"26\" r=\"20\" fill=\"#173e30\" opacity=\".2\"/><circle cx=\"23\" cy=\"23\" r=\"20\" fill=\"#faf5e4\" stroke=\"#bba874\"/><circle cx=\"23\" cy=\"23\" r=\"16.5\" fill=\"#82ad8e\"/><circle cx=\"23\" cy=\"18\" r=\"6\" fill=\"#fff8e6\"/><path d=\"M11 35c1-7 6-11 12-11s11 4 12 11c-7 6-17 6-24 0z\" fill=\"#fff8e6\"/><path d=\"M9 11c5-7 16-9 24-3\" fill=\"none\" stroke=\"#dbbf7a\" stroke-width=\"1.3\"/>";
  A.skills = "<rect x=\"5\" y=\"6\" width=\"38\" height=\"39\" rx=\"6\" fill=\"#183e30\" opacity=\".18\"/><rect x=\"3\" y=\"3\" width=\"40\" height=\"40\" rx=\"6\" fill=\"#faf5e4\" stroke=\"#b9ad86\"/><path d=\"M10 35h27\" stroke=\"#b9ad86\"/><path d=\"M12 35V25h5v10z\" fill=\"#8fb69c\"/><path d=\"M21 35V18h5v17z\" fill=\"#4c8e74\"/><path d=\"M30 35V11h5v24z\" fill=\"#285f4d\"/><path d=\"m12 20 10-8 8 3 6-7\" fill=\"none\" stroke=\"#ad8950\" stroke-width=\"1.8\" stroke-linecap=\"round\"/>";
  A.contact = "<rect x=\"5\" y=\"12\" width=\"39\" height=\"28\" rx=\"3\" fill=\"#214b39\" opacity=\".2\"/><rect x=\"3\" y=\"9\" width=\"40\" height=\"28\" rx=\"3\" fill=\"#a8c4a7\" stroke=\"#678b6e\"/><path d=\"m4 35 15-12h9l14 12\" fill=\"#6f9c7b\"/><path d=\"M4 10h38L23 27z\" fill=\"#fff6de\" stroke=\"#c4b488\"/><circle cx=\"23\" cy=\"26\" r=\"4.5\" fill=\"#ae674e\"/><path d=\"M21 26h4m-2-2v4\" stroke=\"#f0d3a0\" stroke-width=\"1\"/>";
  A.settings = "<path d=\"M20 3h8l2 6 5-1 5 5-2 6 6 2v8l-6 2 2 5-5 5-6-2-2 6h-8l-2-6-5 2-5-5 2-6-6-2v-8l6-2-2-5 5-5 6 2z\" fill=\"#71987e\" stroke=\"#ced5b3\"/><circle cx=\"24\" cy=\"24\" r=\"12\" fill=\"#254f3c\"/><circle cx=\"24\" cy=\"24\" r=\"9\" fill=\"#eadab0\"/><circle cx=\"24\" cy=\"24\" r=\"5\" fill=\"#426f55\"/><path d=\"M21 5h5\" stroke=\"#f1e7bd\" stroke-width=\"1.5\"/>";
  A.terminal = "<rect x=\"5\" y=\"8\" width=\"40\" height=\"35\" rx=\"4\" fill=\"#153b29\" opacity=\".25\"/><rect x=\"3\" y=\"5\" width=\"40\" height=\"35\" rx=\"4\" fill=\"#183e2e\" stroke=\"#98af8c\"/><path d=\"M4 14h38\" stroke=\"#69866d\"/><rect x=\"8\" y=\"8\" width=\"12\" height=\"3\" rx=\"1\" fill=\"#a7ba91\"/><path d=\"M32 10h4m3 0h1\" stroke=\"#c0ba8e\"/><path d=\"m11 21 6 6-6 6\" fill=\"none\" stroke=\"#bee2ba\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M23 33h10\" stroke=\"#e3c68a\" stroke-width=\"2.4\" stroke-linecap=\"round\"/>";
  A.notepad = "<path d=\"M10 6h20l10 10v29H10z\" fill=\"#193e2c\" opacity=\".18\"/><path d=\"M7 3h22l10 10v29l-4-1-4 1-4-1-4 1-4-1-4 1-4-1-4 1z\" fill=\"#fff9e9\" stroke=\"#c2b38c\"/><path d=\"M29 3v10h10\" fill=\"#dce4c6\" stroke=\"#b1b994\"/><path d=\"M12 9v27\" stroke=\"#bf8970\" opacity=\".5\"/><path d=\"M16 19h17M16 25h17M16 31h12\" stroke=\"#91aa8d\" stroke-width=\"1.5\"/><path d=\"M12 5h10\" stroke=\"#fffdf5\"/>";
  A.photos = "<rect x=\"5\" y=\"6\" width=\"38\" height=\"39\" rx=\"6\" fill=\"#183e30\" opacity=\".18\"/><rect x=\"3\" y=\"3\" width=\"40\" height=\"40\" rx=\"6\" fill=\"#faf5e4\" stroke=\"#b9ad86\"/><path d=\"M8 8h30v25H8z\" fill=\"#d9e5c4\"/><circle cx=\"30\" cy=\"15\" r=\"4\" fill=\"#d6b66b\"/><path d=\"m8 30 9-13 10 10 6-6 5 6v6H8z\" fill=\"#a3bb98\"/><path d=\"m8 31 8-6 8 5 8-7 6 8v2H8z\" fill=\"#508166\"/><path d=\"M10 38h16\" stroke=\"#b9a36c\" stroke-width=\"1.5\"/>";
  A.recycle = "<path d=\"M13 12h24l-3 28-5 4H20l-5-4z\" fill=\"#193e2c\" opacity=\".18\"/><path d=\"M11 10h24l-3 28-5 4H18l-5-4z\" fill=\"#bdcfad\" stroke=\"#7b9d79\"/><path d=\"M12 13h22\" stroke=\"#e8edce\"/><rect x=\"8\" y=\"5\" width=\"30\" height=\"6\" rx=\"2\" fill=\"#7fa784\" stroke=\"#bfd0ad\"/><path d=\"M18 5V3h10v2\" stroke=\"#5e896a\" fill=\"none\" stroke-width=\"2\"/><path d=\"m20 20 4-2 5 6m0-4v4h-4m1 9-4 2-5-6m0 4v-4h4\" fill=\"none\" stroke=\"#3d7957\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>";
  A.frost = "<rect x=\"5\" y=\"6\" width=\"38\" height=\"39\" rx=\"6\" fill=\"#183e30\" opacity=\".18\"/><rect x=\"3\" y=\"3\" width=\"40\" height=\"40\" rx=\"6\" fill=\"#faf5e4\" stroke=\"#b9ad86\"/><circle cx=\"33\" cy=\"13\" r=\"4\" fill=\"#af6047\"/><path d=\"M7 33 18 16l9 12 5-6 8 11z\" fill=\"#a7b99a\"/><path d=\"M7 34 17 25l9 7 7-5 7 7z\" fill=\"#4e7158\"/><path d=\"m15 21 3-5 4 6\" fill=\"none\" stroke=\"#fff6e1\" stroke-width=\"1.5\"/><path d=\"M8 37h29\" stroke=\"#a98a50\"/>";
  A.liyun = "<rect x=\"5\" y=\"6\" width=\"38\" height=\"39\" rx=\"6\" fill=\"#183e30\" opacity=\".18\"/><rect x=\"3\" y=\"3\" width=\"40\" height=\"40\" rx=\"6\" fill=\"#faf5e4\" stroke=\"#b9ad86\"/><path d=\"m9 11 9-3 12 4 9-2v26l-9 3-12-4-9 2z\" fill=\"#c1d0ad\" stroke=\"#809970\"/><path d=\"M18 8v27m12-23v27\" stroke=\"#f5edcf\"/><path d=\"m13 30 6-5 6 3 9-13\" fill=\"none\" stroke=\"#4c8562\" stroke-width=\"1.5\" stroke-dasharray=\"2 2\"/><circle cx=\"26\" cy=\"22\" r=\"9\" fill=\"#faf3dc\" stroke=\"#ac8d50\"/><path d=\"m26 15 4 9-4-2-4 2z\" fill=\"#2f7155\"/><path d=\"m26 29-4-5 4-2 4 2z\" fill=\"#c2ac6d\"/>";
  A.genshin = "<rect x=\"5\" y=\"6\" width=\"38\" height=\"39\" rx=\"6\" fill=\"#183e30\" opacity=\".18\"/><rect x=\"3\" y=\"3\" width=\"40\" height=\"40\" rx=\"6\" fill=\"#faf5e4\" stroke=\"#b9ad86\"/><path d=\"M8 34V20h30v14\" fill=\"#e8d7a9\" stroke=\"#b79a60\"/><path d=\"M6 21 10 15h10l4-5 4 5h10l4 6z\" fill=\"#4c7a57\"/><path d=\"M8 22h32\" stroke=\"#fff6d9\"/><path d=\"M14 23v11m20-11v11\" stroke=\"#ae6e51\" stroke-width=\"3\"/><path d=\"M20 34v-9h8v9\" fill=\"#38684c\"/><path d=\"M6 36h36M9 39h30\" stroke=\"#ad965d\" stroke-width=\"1.5\"/><circle cx=\"34\" cy=\"9\" r=\"3\" fill=\"#d6b66b\"/>";
  A.cv = "<rect x=\"11\" y=\"6\" width=\"29\" height=\"39\" rx=\"2\" fill=\"#173e2b\" opacity=\".18\"/><rect x=\"8\" y=\"3\" width=\"29\" height=\"39\" rx=\"2\" fill=\"#fff8e6\" stroke=\"#baa77c\"/><rect x=\"12\" y=\"8\" width=\"10\" height=\"12\" rx=\"1\" fill=\"#adc6a6\"/><circle cx=\"17\" cy=\"12\" r=\"2\" fill=\"#fff7e0\"/><path d=\"M13 18c0-4 8-4 8 0\" fill=\"#fff7e0\"/><path d=\"M26 10h7m-7 5h5M12 26h21m-21 5h21m-21 5h13\" stroke=\"#96a787\" stroke-width=\"1.5\"/><path d=\"M31 32h9v10h-9z\" fill=\"#ad684f\"/><path d=\"M33 35h5m-5 3h5\" stroke=\"#efdab3\"/>";
  A['genshin-original'] = '<rect x="5" y="5" width="38" height="39" rx="6" fill="#26384c" opacity=".18"/><rect x="3" y="3" width="40" height="40" rx="6" fill="#eef1ee" stroke="#9ba7ad"/><path d="M13 36V12h22v24" fill="#fffdf1" stroke="#7c8992" stroke-width="2"/><path d="m17 14 12-4v30l-12-5z" fill="#bbc9ce" stroke="#596b78" stroke-width="1.4"/><path d="m29 10 6 3v23l-6 4z" fill="#f9f5df"/><circle cx="25" cy="25" r="1.3" fill="#596b78"/><path d="M8 39h32" stroke="#89979c" stroke-width="1.4"/>';
  // An independent isometric voxel building and block trees; no external assets.
  A['voxel-campus'] = '<rect x="5" y="6" width="38" height="39" rx="6" fill="#183e30" opacity=".18"/><rect x="3" y="3" width="40" height="40" rx="6" fill="#faf5e4" stroke="#b9ad86"/><polygon points="5,32 24,22 43,32 24,42" fill="#a9c3a0"/><path d="m5 32 19 10 19-10v3L24 45 5 35z" fill="#527d60"/><polygon points="12,15 24,9 36,15 24,21" fill="#f2e6c7" stroke="#b49b68" stroke-width=".8"/><polygon points="12,15 24,21 24,37 12,31" fill="#d8c49a"/><polygon points="24,21 36,15 36,31 24,37" fill="#769781"/><path d="m15 20 3 1.5v3L15 23zm5 2.5 2 1v3l-2-1zm7 2 3-1.5v3L27 27zm5-2.5 2-1v3l-2 1z" fill="#355b4c"/><path d="m28 30 4-2v5l-4 2z" fill="#294f40"/><path d="M24 9V4h8l-3 3h-5" fill="#b36449" stroke="#a6774c" stroke-width=".8"/><path d="M13 31v6m25-4v5" stroke="#8d7350" stroke-width="2"/><polygon points="8,25 13,22 18,25 13,28" fill="#9ab88b"/><path d="m8 25 5 3v6l-5-3z" fill="#3d765d"/><path d="m13 28 5-3v6l-5 3z" fill="#659b70"/><polygon points="34,31 38,29 42,31 38,33" fill="#a9c390"/><path d="m34 31 4 2v5l-4-2z" fill="#427b5e"/><path d="m38 33 4-2v5l-4 2z" fill="#77a77a"/>';
  A.code = A.projects;
  A.cpu = A.skills;
  A.globe = A.liyun;

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
