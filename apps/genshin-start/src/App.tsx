import { useEffect, useRef, useState } from 'react';
import { exitUrl, goExit, isLoopbackHost } from './core/exit';
import type { CampusController, CampusQA, CampusSnapshot, CampusStatus } from './campus/types';
import './App.css';

const INITIAL: CampusStatus = { phase: 'loading', progress: 0, reducedMotion: false, paused: false, quality: 'low' };
const COPY = {
  loading: { index: '序', kicker: 'A MORNING AT BIT', title: '循光入境', body: '晨光正在铺开。片刻之后，沿树影走进校园。' },
  welcome: { index: '一', kicker: 'A MORNING AT BIT', title: '循光入境', body: '一径晨光，几重树影。\n从这里，走近北理的求知日常。' },
  journey: { index: '二', kicker: 'FOLLOW THE LIGHT', title: '向光而行', body: '纸山在远，门庭渐近。' },
  arrival: { index: '三', kicker: 'THE WENBO COURTYARD', title: '门庭已至', body: '文博中心的柱廊之后，\n新的探索正在等你。' },
  entering: { index: '终', kicker: 'YOUR EXPLORATION BEGINS', title: '此刻，启程', body: '正在进入理韵寻踪。' },
  fallback: { index: '序', kicker: 'AN OPEN INVITATION', title: '换一条路，入境', body: '三维画面暂未展开，探索不必等待。' },
};

export function App() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const controller = useRef<CampusController | null>(null);
  const statusRef = useRef<CampusStatus>(INITIAL);
  const [status, setStatus] = useState<CampusStatus>(INITIAL);
  const [failure, setFailure] = useState('');
  const copy = COPY[status.phase];
  const ready = !['loading', 'fallback'].includes(status.phase);
  const set = (next: CampusStatus) => { statusRef.current = next; setStatus(next); };

  useEffect(() => {
    let mounted = true;
    let timedOut = false;
    document.getElementById('root')?.setAttribute('data-app-ready', 'true');
    const fallback = (message: string) => {
      if (!mounted) return;
      setFailure(message);
      set({ ...statusRef.current, phase: 'fallback' });
    };
    const timeout = window.setTimeout(() => {
      timedOut = true; fallback('校园画面加载超时。你可以直接进入理韵，无需继续等候。');
    }, 12000);
    // Keep the interactive shell and skip link independent of the rendering chunk.
    import('./campus/scene').then(({ CampusScene }) => {
      if (!mounted || timedOut || !canvas.current) return;
      const scene = new CampusScene(canvas.current, {
        onStatus: next => { if (mounted) set(next); },
        onError: fallback,
        onExit: () => goExit('campus-door'),
      });
      controller.current = scene;
      window.clearTimeout(timeout);
    }).catch(error => {
      window.clearTimeout(timeout);
      if (import.meta.env.DEV) console.warn('[campus] renderer unavailable:', error);
      fallback('当前浏览器未能启用三维画面。静态入口仍可使用。');
    });

    if (import.meta.env.DEV && isLoopbackHost(location.hostname) && new URLSearchParams(location.search).get('qa') === '1') {
      const snapshot = (): CampusSnapshot => {
        const state = controller.current?.snapshot();
        return state ? { ...state, phase: statusRef.current.phase } : { ...statusRef.current, camera: null, performance: null };
      };
      const qa: CampusQA = {
        get phase() { return statusRef.current.phase; },
        get camera() { return snapshot().camera; },
        get performance() { return snapshot().performance; },
        snapshot,
        start: () => controller.current?.start(),
        advance: seconds => { controller.current?.advance(seconds); return snapshot(); },
        resume: () => controller.current?.resume(),
        arrive: () => controller.current?.arrive(),
        enter: () => controller.current?.enter(),
        loseContext: () => controller.current?.loseContext(),
      };
      window.__CAMPUS_QA__ = qa;
    }
    return () => {
      mounted = false; window.clearTimeout(timeout);
      controller.current?.dispose(); controller.current = null;
      if (import.meta.env.DEV) delete window.__CAMPUS_QA__;
    };
  }, []);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
      if (event.key === 'Escape') { event.preventDefault(); goExit('keyboard-skip'); return; }
      const target = event.target as HTMLElement | null;
      if (target?.closest('a,button,input,select,textarea,summary,[contenteditable="true"]')) return;
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      const phase = statusRef.current.phase;
      if (phase === 'welcome') controller.current?.start();
      else if (phase === 'arrival') controller.current?.enter();
      else if (phase === 'journey') controller.current?.togglePause();
      else if (phase === 'fallback') goExit('fallback-keyboard');
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, []);

  return (
    <main className="campus" data-phase={status.phase} data-quality={status.quality} data-reduced-motion={status.reducedMotion}>
      <div className="campus-stage" role="img" aria-label="北理工校园意象：暖白文博中心柱廊、青色玻璃与圆鼓内庭，前景玉绿植栽，远处折纸山层。原创艺术化场景，非真实总平面。">
        {!ready && <img className="campus-fallback-art" src={`${import.meta.env.BASE_URL}campus-fallback.svg`} alt="" aria-hidden="true" />}
        <canvas ref={canvas} className={ready ? 'campus-canvas is-ready' : 'campus-canvas'} aria-hidden="true" />
      </div>
      <div className="campus-vignette" aria-hidden="true" />
      <header className="campus-header">
        <span className="campus-seal" aria-hidden="true">理<span>韵</span></span>
        <div><p className="campus-brand">理韵寻踪</p><p className="campus-edition">纸境入场 · 北理校园序章</p></div>
      </header>
      <section className="campus-copy" aria-labelledby="campus-title">
        <p className="campus-kicker"><span aria-hidden="true" />{copy.kicker}</p>
        <h1 id="campus-title">{copy.title}</h1>
        <p className="campus-intro">{copy.body}</p>
        {status.phase === 'fallback' && <p className="campus-error" role="status">{failure}</p>}
      </section>
      <aside className="campus-ticket" aria-hidden="true"><span>入 境</span><i /><small>{copy.index}</small></aside>
      <div className="campus-live sr-only" aria-live="polite" aria-atomic="true">
        {status.phase === 'loading' ? '正在准备校园，右上角可随时跳过。' : status.phase === 'journey' ? '正在沿步道行进，可暂停或直接抵达。' : status.phase === 'arrival' ? '已抵达文博门庭，请选择进入理韵寻踪。' : status.phase === 'fallback' ? failure : copy.title}
      </div>
      <section className="campus-deck" aria-label="入场操作">
        <div className="campus-actions">
          {status.phase === 'loading' && <div className="campus-loading" role="status"><span aria-hidden="true" />正在铺开晨光<span className="campus-loading-note">可随时跳过</span></div>}
          {status.phase === 'welcome' && <button data-testid="campus-start" className="campus-primary" onClick={() => controller.current?.start()}><span>循光入校</span><span aria-hidden="true">↗</span></button>}
          {status.phase === 'journey' && <><button className="campus-primary campus-primary-subtle" data-testid="campus-arrive" onClick={() => controller.current?.arrive()}><span>直接抵达</span><span aria-hidden="true">→</span></button><button className="campus-pause" onClick={() => controller.current?.togglePause()} aria-pressed={status.paused}>{status.paused ? '继续行进' : '暂停行进'}</button></>}
          {(status.phase === 'arrival' || status.phase === 'fallback') && <a data-testid="campus-enter" className="campus-primary" href={exitUrl()} onClick={event => { event.preventDefault(); status.phase === 'fallback' ? goExit('fallback-button') : controller.current?.enter(); }}><span>进入理韵寻踪</span><span aria-hidden="true">→</span></a>}
          {status.phase === 'entering' && <p className="campus-entering" role="status">门已开启，正在前往理韵…</p>}
          {status.phase === 'welcome' && <p className="campus-action-note">{status.reducedMotion ? '已减少动态 · 直接抵达门庭' : '约 10 秒 · 一段晨光里的步行'}</p>}
        </div>
        <div className="campus-route" aria-label="校园行进阶段">
          <span className={status.phase === 'welcome' || status.phase === 'loading' ? 'is-current' : ''}>晨启</span><i />
          <span className={status.phase === 'journey' ? 'is-current' : ''}>循光</span><i />
          <span className={status.phase === 'arrival' || status.phase === 'entering' ? 'is-current' : ''}>门庭</span>
        </div>
        {status.phase === 'journey' && <div className="campus-progress" role="progressbar" aria-label="到达门庭的进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(status.progress * 100)}><span style={{ transform: 'scaleX(' + status.progress + ')' }} /></div>}
      </section>
      <footer className="campus-footer">
        <span>北理工校园意象 <b>·</b> 原创艺术化场景</span>
        <details className="campus-about"><summary>关于此境 <span aria-hidden="true">＋</span></summary><p>以良乡文博中心为主景，提炼徐特立图书馆与综合教学楼的材料、窗列与体量。纸山、植栽及步道为艺术化编排，并非实际校园总平面或数字孪生。本版本静音，不加载原游戏模型与音乐。</p></details>
        <span className="campus-keyboard-hint">Enter 开始 / 进入 <b>·</b> Esc 跳过</span>
      </footer>
      <div className="campus-exit-wash" aria-hidden="true" style={{ opacity: status.phase === 'entering' ? Math.max(0, (status.progress - .62) / .38) * .85 : 0 }} />
    </main>
  );
}
