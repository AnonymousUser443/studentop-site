import './legacy.css';
import { exitUrl, goExit, isLoopbackHost } from '../core/exit';
import type { LegacyGame, LegacyStatus } from './runtime';

const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const shell = get<HTMLElement>('legacy-shell');
const canvas = get<HTMLCanvasElement>('legacy-canvas');
const loading = get<HTMLElement>('legacy-loading');
const menu = get<HTMLElement>('legacy-menu');
const fallback = get<HTMLElement>('legacy-fallback');
const start = get<HTMLButtonElement>('legacy-start');
const enter = get<HTMLButtonElement>('legacy-enter');
const pause = get<HTMLButtonElement>('legacy-pause');
const audio = get<HTMLButtonElement>('legacy-audio');
let game: LegacyGame | undefined;
let alive = true;
let state: LegacyStatus = { phase: 'loading', loaded: 0, total: 13, sound: false, paused: false };
const removeListeners: (() => void)[] = [];
const on = (element: EventTarget, name: string, listener: EventListener) => { element.addEventListener(name, listener); removeListeners.push(() => element.removeEventListener(name, listener)); };
shell.dataset.mounted = 'true';
const home = import.meta.env.DEV || isLoopbackHost(location.hostname) ? 'http://127.0.0.1:8899/' : 'https://studentop.cn:14355/';
get<HTMLAnchorElement>('legacy-home').href = home;
for (const id of ['legacy-skip', 'legacy-fallback-exit']) {
  const link = get<HTMLAnchorElement>(id); link.href = exitUrl();
  on(link, 'click', event => {
    const mouse = event as MouseEvent;
    if (mouse.ctrlKey || mouse.metaKey || mouse.shiftKey || mouse.altKey) return;
    event.preventDefault(); goExit(id);
  });
}
function render(next: LegacyStatus) {
  if (!alive) return;
  state = next; shell.dataset.phase = next.phase;
  loading.hidden = next.phase !== 'loading'; fallback.hidden = next.phase !== 'fallback';
  menu.hidden = ['loading', 'fallback'].includes(next.phase); canvas.hidden = next.phase === 'fallback';
  start.hidden = next.phase !== 'welcome'; enter.hidden = next.phase !== 'door';
  pause.disabled = next.phase === 'entering'; pause.textContent = next.paused ? '继续画面' : '暂停画面'; pause.setAttribute('aria-pressed', String(next.paused));
  audio.textContent = next.sound ? '声音：开启' : '声音：关闭'; audio.setAttribute('aria-pressed', String(next.sound));
  get<HTMLProgressElement>('legacy-progress').value = next.loaded;
  get<HTMLElement>('legacy-progress-text').textContent = '正在载入原版模型 ' + next.loaded + ' / ' + next.total + ' · 可随时跳过';
  get<HTMLElement>('legacy-live').textContent = next.phase === 'journey' ? '正在前往天空之门…' : next.phase === 'door' ? '天空之门已开启，点击下方进入' : next.phase === 'entering' ? '正在进入理韵寻踪…' : '';
}
function fail(message: string) {
  if (!alive) return;
  game?.dispose(); get<HTMLElement>('legacy-error').textContent = message;
  render({ ...state, phase: 'fallback' });
}
on(start, 'click', () => game?.start()); on(enter, 'click', () => game?.enter());
on(pause, 'click', () => game?.togglePause()); on(audio, 'click', () => game?.toggleSound());
on(canvas, 'click', () => { if (state.phase === 'door') game?.enter(); });
on(get('legacy-retry'), 'click', () => location.reload());
on(window, 'keydown', event => {
  const e = event as KeyboardEvent;
  if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Escape') { e.preventDefault(); goExit('legacy-keyboard-skip'); return; }
  if ((e.target as HTMLElement)?.closest('a,button,input,textarea,summary,[contenteditable]')) return;
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (state.phase === 'welcome') game?.start(); else if (state.phase === 'door') game?.enter(); else if (state.phase === 'journey') game?.togglePause(); }
});
const timeout = window.setTimeout(() => fail('原版资源加载超时。返回与跳过入口仍可使用，或稍后重新载入。'), 45000);
const query = new URLSearchParams(location.search);
if ((query.has('skip') && query.get('skip') !== '0') || location.hash.toLowerCase() === '#skip') {
  window.clearTimeout(timeout); goExit('legacy-skip-param');
} else {
  import('./runtime').then(async ({ LegacyGame }) => {
    if (!alive || state.phase === 'fallback') return;
    game = new LegacyGame(canvas, { status: render, error: fail });
    await game.initialize(); window.clearTimeout(timeout);
  }).catch(error => {
    window.clearTimeout(timeout);
    if (import.meta.env.DEV) console.warn('[legacy] initialization failed:', error);
    fail('当前设备未能启动原版 WebGL 场景。你可以直接进入理韵寻踪，或返回主页。');
  });
}

if (import.meta.env.DEV && isLoopbackHost(location.hostname) && query.get('qa') === '1') {
  window.__LEGACY_QA__ = {
    get phase() { return state.phase; },
    snapshot: () => game ? { ...game.snapshot(), phase: state.phase } : { ...state, camera: null, performance: null },
    start: () => game?.start(), enter: () => game?.enter(), loseContext: () => game?.loseContext(),
  };
}
if (import.meta.hot) {
  import.meta.hot.dispose(() => { alive = false; window.clearTimeout(timeout); removeListeners.forEach(remove => remove()); game?.dispose(); delete window.__LEGACY_QA__; });
  // Legacy component singletons cache mutable models; a document reload is safer than partial hot remount.
  import.meta.hot.accept(() => location.reload());
}
declare global { interface Window { __LEGACY_QA__?: { readonly phase: string; snapshot(): unknown; start(): void; enter(): void; loseContext(): void } } }
