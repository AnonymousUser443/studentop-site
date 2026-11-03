// Inject with OpenCLI browser eval on /?qa=1&preset=explored only.
// DOM-driven probes; these do not claim a native keyboard/touch walkthrough.
(() => {
  const snapshots = [];
  const describe = el => el && ({ tag: el.tagName, class: el.className,
    label: el.getAttribute('aria-label'), text: el.textContent?.trim().slice(0, 70) });
  const visible = el => {
    const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  const capture = label => {
    const screen = document.querySelector('.settings-screen, .menu-screen');
    const scope = screen ?? document.querySelector('.hud-frame');
    const buttons = [...(scope?.querySelectorAll('button, [role=slider]') ?? [])].filter(visible);
    const snapshot = {
      label, viewport: [innerWidth, innerHeight],
      route: screen?.className ?? 'map', focus: describe(document.activeElement),
      focusInsideScreen: screen?.contains(document.activeElement) ?? null,
      preset: window.__LIYUN__.getState().settings.qualityPreset,
      motion: document.documentElement.dataset.motion,
      menuBlur: document.querySelector('.menu-screen') && getComputedStyle(document.querySelector('.menu-screen')).backdropFilter,
      smallControls: buttons.map(el => ({ ...describe(el), rect: el.getBoundingClientRect().toJSON() }))
        .filter(e => e.rect.width < 43.9 || e.rect.height < 43.9),
      containers: ['.menu-scroll', '.menu-grid', '.menu-card', '.menu-rail', '.settings-panel', '.settings-body', '.settings-footer']
        .map(selector => {
          const el = document.querySelector(selector);
          if (!el) return null;
          const s = getComputedStyle(el);
          return { selector, rect: el.getBoundingClientRect().toJSON(), scrollHeight: el.scrollHeight,
            clientHeight: el.clientHeight, overflowY: s.overflowY, gridTemplateColumns: s.gridTemplateColumns };
        }).filter(Boolean),
      text: screen?.innerText,
    };
    snapshots.push(snapshot);
    return snapshot;
  };
  window.__refactorAudit = { mode: 'DOM-driven OpenCLI probes', snapshots, capture };
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => capture('viewport-resize'), 100);
  });
  window.__LIYUN__.setSettings({ autoDegrade: false });
  capture('map-initial');
  return { installed: true, mode: window.__refactorAudit.mode };
})();
