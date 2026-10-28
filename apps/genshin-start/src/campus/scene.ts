import * as THREE from 'three';
import { buildCampus, type CampusWorld } from './geometry';
import type { CampusController, CampusPhase, CampusSnapshot, CampusStatus, Quality } from './types';

type Hooks = { onStatus(status: CampusStatus): void; onError(message: string): void; onExit(): void };
const JOURNEY_SECONDS = 10;
const ENTER_SECONDS = 2.8;
const clamp = THREE.MathUtils.clamp;
const ease = (t: number) => t * t * (3 - 2 * t);

export class CampusScene implements CampusController {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(45, 1, .1, 400);
  private renderer?: THREE.WebGLRenderer;
  private world?: CampusWorld;
  private observer?: ResizeObserver;
  private motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  private phase: CampusPhase = 'loading';
  private quality: Quality;
  private reducedMotion = this.motionQuery.matches;
  private userPaused = false;
  private backgroundPaused = document.hidden;
  private manualClock = false;
  private contextLost = false;
  private disposed = false;
  private frame = 0;
  private raf = 0;
  private lastFrame = 0;
  private lastRender = 0;
  private lastReport = 0;
  private elapsed = 0;
  private ambientTime = 0;
  private progress = 0;
  private fps = 60;
  private slowFrames = 0;
  private width = 1;
  private height = 1;
  private target = new THREE.Vector3();
  private pointer = new THREE.Vector2();
  private listeners: (() => void)[] = [];

  constructor(private canvas: HTMLCanvasElement, private hooks: Hooks) {
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 8;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    this.quality = coarse || memory <= 4 || navigator.hardwareConcurrency <= 4 || this.reducedMotion ? 'low' : 'high';
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.quality === 'high', alpha: false, powerPreference: 'default' });
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.06;
      this.renderer.shadowMap.enabled = this.quality === 'high';
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.scene.background = new THREE.Color('#e6eadb');
      this.scene.fog = new THREE.Fog('#e5e8d8', 62, 170);
      this.world = buildCampus(this.scene, this.quality);
      this.bind();
      this.resize();
      this.setPhase('welcome');
      this.render();
      this.schedule();
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  private listen(target: EventTarget, type: string, listener: EventListener) {
    target.addEventListener(type, listener);
    this.listeners.push(() => target.removeEventListener(type, listener));
  }
  private bind() {
    this.listen(window, 'resize', () => this.resize());
    this.listen(window, 'pagehide', () => this.stop());
    this.listen(window, 'pageshow', () => { this.backgroundPaused = document.hidden; this.lastFrame = 0; this.schedule(); });
    this.listen(document, 'visibilitychange', () => {
      this.backgroundPaused = document.hidden;
      this.stop(); this.lastFrame = 0; this.lastRender = 0;
      this.report(); if (!this.backgroundPaused) { this.render(); this.schedule(); }
    });
    this.listen(this.motionQuery, 'change', () => {
      this.reducedMotion = this.motionQuery.matches;
      if (this.reducedMotion) {
        this.pointer.set(0, 0);
        if (this.phase === 'journey') this.arrive();
      }
      this.report(); this.render(); this.stop(); this.schedule();
    });
    this.listen(this.canvas, 'pointermove', (event) => {
      const e = event as PointerEvent;
      if (this.reducedMotion || e.pointerType !== 'mouse') return;
      const rect = this.canvas.getBoundingClientRect();
      this.pointer.set(clamp((e.clientX - rect.left) / rect.width - .5, -.5, .5), clamp((e.clientY - rect.top) / rect.height - .5, -.5, .5));
    });
    this.listen(this.canvas, 'pointerleave', () => { this.pointer.set(0, 0); });
    this.listen(this.canvas, 'webglcontextlost', (event) => {
      event.preventDefault(); this.contextLost = true; this.fail('图形上下文已中断，已为你保留静态入口。');
    });
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(this.canvas.parentElement!);
    }
  }

  private resize() {
    if (this.disposed || !this.renderer) return;
    const bounds = this.canvas.parentElement!.getBoundingClientRect();
    this.width = Math.max(1, Math.round(bounds.width)); this.height = Math.max(1, Math.round(bounds.height));
    this.camera.aspect = this.width / this.height;
    this.camera.fov = this.camera.aspect < .9 ? 52 : 48;
    this.camera.updateProjectionMatrix();
    const cap = this.quality === 'high' ? 1.75 : 1.25;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    this.renderer.setSize(this.width, this.height, false);
    this.render(); this.report();
  }

  private get fpsLimit() { return this.quality === 'high' ? 60 : 30; }
  private get active() { return !this.disposed && !this.backgroundPaused && !this.userPaused && !this.manualClock; }
  private schedule() {
    if (!this.active || this.raf) return;
    if (this.reducedMotion && this.phase !== 'entering' && this.phase !== 'journey') return;
    this.raf = requestAnimationFrame(this.tick);
  }
  private stop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; }
  private tick = (now: number) => {
    this.raf = 0;
    if (!this.active) return;
    if (!this.lastFrame) this.lastFrame = now;
    if (this.lastRender && now - this.lastRender < 1000 / this.fpsLimit - .8) { this.schedule(); return; }
    const delta = clamp((now - this.lastFrame) / 1000, 0, .12);
    this.lastFrame = now;
    if (this.lastRender) this.fps = this.fps * .94 + (1000 / Math.max(1, now - this.lastRender)) * .06;
    this.lastRender = now;
    try {
      this.step(delta);
      this.render();
      if (now - this.lastReport > 120) { this.report(); this.lastReport = now; }
      if (this.frame > 60 && this.quality === 'high' && this.fps < 27) this.slowFrames++;
      else this.slowFrames = Math.max(0, this.slowFrames - 1);
      if (this.slowFrames > 90) {
        this.quality = 'low'; this.world!.setQuality('low'); this.renderer!.shadowMap.enabled = false;
        this.resize(); this.report();
      }
      this.schedule();
    } catch { this.fail('这台设备未能继续绘制校园，仍可直接进入理韵。'); }
  };

  private step(seconds: number) {
    this.ambientTime += seconds;
    if (this.phase === 'journey') {
      this.elapsed += seconds; this.progress = clamp(this.elapsed / JOURNEY_SECONDS, 0, 1);
      if (this.progress >= 1) this.arrive();
    } else if (this.phase === 'entering') {
      this.elapsed += seconds;
      this.progress = clamp(this.elapsed / (this.reducedMotion ? .18 : ENTER_SECONDS), 0, 1);
      if (this.progress >= 1) { this.stop(); this.hooks.onExit(); }
    }
  }
  private updateCamera() {
    const aspect = this.width / this.height;
    const startZ = Math.max(52, 64 / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * aspect) * 1.06 - 22);
    const start = new THREE.Vector3(aspect < .9 ? 4 : 9, 8, startZ);
    const arrival = new THREE.Vector3(0, 3.4, -4);
    const startLook = new THREE.Vector3(0, 6.5, -24);
    const finalLook = new THREE.Vector3(0, 7.2, -29);
    let journey = 0;
    if (this.phase === 'journey') journey = ease(this.progress);
    else if (this.phase === 'arrival' || this.phase === 'entering') journey = 1;
    const path = new THREE.QuadraticBezierCurve3(start, new THREE.Vector3(4.5, 4.7, 14), arrival);
    this.camera.position.copy(path.getPoint(journey));
    this.target.copy(startLook).lerp(finalLook, journey);
    if (this.phase === 'entering' && !this.reducedMotion) {
      const t = ease(this.progress);
      this.camera.position.lerp(new THREE.Vector3(0, 2.6, -23.8), t);
      this.target.lerp(new THREE.Vector3(0, 4.6, -34), t);
    }
    if (!this.reducedMotion && (this.phase === 'welcome' || this.phase === 'arrival')) {
      this.camera.position.x += this.pointer.x * .24;
      this.camera.position.y -= this.pointer.y * .10;
    }
    this.camera.lookAt(this.target);
  }
  private render() {
    if (!this.renderer || this.disposed || this.contextLost || this.backgroundPaused) return;
    this.updateCamera();
    this.world?.animate(this.ambientTime, this.phase === 'entering' ? ease(clamp(this.progress * 1.5, 0, 1)) : 0, !this.reducedMotion && !this.userPaused);
    this.renderer.render(this.scene, this.camera); this.frame++;
  }
  private setPhase(phase: CampusPhase) { this.phase = phase; this.elapsed = 0; this.progress = 0; this.report(); }
  private report() { this.hooks.onStatus({ phase: this.phase, progress: this.progress, quality: this.quality, reducedMotion: this.reducedMotion, paused: this.userPaused }); }
  private fail(message: string) { this.phase = 'fallback'; this.stop(); this.report(); this.dispose(); this.hooks.onError(message); }

  start() {
    if (this.phase !== 'welcome' || this.disposed) return;
    if (this.reducedMotion) { this.arrive(); return; }
    this.setPhase('journey'); this.render(); this.schedule();
  }
  arrive() {
    if (this.disposed || !['welcome', 'journey'].includes(this.phase)) return;
    this.userPaused = false; this.setPhase('arrival'); this.render(); this.schedule();
  }
  enter() {
    if (this.phase !== 'arrival' || this.disposed) return;
    this.userPaused = false; this.setPhase('entering'); this.render(); this.schedule();
  }
  togglePause() {
    if (this.phase !== 'journey') return;
    this.userPaused = !this.userPaused; this.stop(); this.lastFrame = 0; this.lastRender = 0;
    this.report(); this.schedule();
  }
  // Reachable only through the DEV/local QA adapter in App.tsx.
  advance(seconds: number) {
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 60 || this.disposed) return;
    this.manualClock = true; this.stop(); this.step(seconds); this.render(); this.report();
  }
  resume() { this.manualClock = false; this.lastFrame = 0; this.lastRender = 0; this.schedule(); }
  loseContext() { this.renderer?.getContext().getExtension('WEBGL_lose_context')?.loseContext(); }
  snapshot(): CampusSnapshot {
    return {
      phase: this.phase, progress: this.progress, reducedMotion: this.reducedMotion, paused: this.userPaused, quality: this.quality,
      camera: { position: this.camera.position.toArray(), target: this.target.toArray(), fov: this.camera.fov },
      performance: {
        frames: this.frame, drawCalls: this.renderer?.info.render.calls || 0, triangles: this.renderer?.info.render.triangles || 0,
        geometries: this.renderer?.info.memory.geometries || 0, textures: this.renderer?.info.memory.textures || 0,
        fps: Math.round(this.fps), dpr: this.renderer?.getPixelRatio() || 1, fpsLimit: this.fpsLimit,
        backgroundPaused: this.backgroundPaused, manualClock: this.manualClock, contextLost: this.contextLost,
        viewport: { width: this.width, height: this.height },
      },
    };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.stop(); this.observer?.disconnect();
    this.listeners.forEach(remove => remove()); this.listeners = [];
    this.world?.dispose(); this.renderer?.renderLists.dispose(); this.renderer?.dispose();
    // Do not force a context-loss event here: Fast Refresh can reuse this canvas.
    // Geometry/material/texture disposal and renderer.dispose() release GPU resources;
    // the browser owns the canvas context. Explicit QA loseContext() remains available.
  }
}
