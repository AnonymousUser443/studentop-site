import {
  Viewer, AssetManager, AudioComponent, Fog, FXAAPlugin, BloomPlugin,
  ToneMappingPlugin, ToneMappingMode, NoToneMapping, LinearEncoding, TWEEN, $r,
} from '../libs/xviewer';
import { User } from '../core/User';
import { gameManager } from '../core/GameManager';
import { AmbientLightComponent } from '../core/components/AmbientLightComponent';
import { DirectionalLightComponent } from '../core/components/DirectionalLightComponent';
import { PolarLight } from '../core/components/PolarLight';
import { Cloud } from '../core/components/Cloud';
import { HashFog } from '../core/components/HashFog';
import { Column } from '../core/components/Column';
import { BigCloud } from '../core/components/BigCloud';
import { ForwardCamera } from '../core/components/ForwardCamera';
import { Road } from '../core/components/Road';
import { gradientBackgroundPlugin } from '../core/components/gradientBackground';
import { BloomTransitionEffectPlugin } from '../core/components/BloomTransition';

export type LegacyPhase = 'loading' | 'welcome' | 'journey' | 'door' | 'entering' | 'fallback';
export interface LegacyStatus { phase: LegacyPhase; loaded: number; total: number; sound: boolean; paused: boolean }
export interface LegacyHooks { status(value: LegacyStatus): void; error(message: string): void }
const MODELS = ['DOOR', 'SM_BigCloud', 'SM_Light', 'SM_Qiao01', 'SM_Qiao02', 'SM_Qiao03', 'SM_Qiao04', 'SM_Road', 'SM_ZhuZi01', 'SM_ZhuZi02', 'SM_ZhuZi03', 'SM_ZhuZi04', 'WHITE_PLANE'];

/** Original components and assets; only orchestration, error handling and lifecycle are new. */
export class LegacyGame {
  readonly viewer: Viewer;
  phase: LegacyPhase = 'loading';
  private loaded = 0;
  private disposed = false;
  private frame = 0;
  private raf = 0;
  private last = 0;
  private entering = 0;
  private opened = false;
  private navigating = false;
  private background = document.hidden;
  private paused = false;
  private sound = false;
  private music?: AudioComponent;
  private effects?: AudioComponent;
  private road?: Road;
  private forward?: ForwardCamera;
  private bloom?: BloomTransitionEffectPlugin;
  private observers: (() => void)[] = [];
  private coarse = matchMedia('(pointer: coarse)').matches;
  private fpsLimit = this.coarse ? 30 : 60;

  constructor(private canvas: HTMLCanvasElement, private hooks: LegacyHooks) {
    gameManager.reset();
    this.viewer = new Viewer({ canvas, camera: { fov: 45, near: 50, far: 100000, rotation: $r(5.5 * Math.PI / 180, 0, 0) }, user: new User(), linear: false, toneMapping: NoToneMapping, outputEncoding: LinearEncoding });
    // The upstream constructor starts its own loop. Use one capped loop and never patch shared prototypes.
    this.viewer.stop();
    this.listen(window, 'resize', () => this.resize());
    this.listen(window, 'pagehide', () => this.stop());
    this.listen(window, 'pageshow', () => { this.background = document.hidden; this.schedule(); });
    this.listen(document, 'visibilitychange', () => {
      this.background = document.hidden; this.stop(); this.last = 0;
      if (this.background) this.music?.node?.pause();
      else { if (this.sound && this.music?.node && !this.music.node.isPlaying) this.music.node.play(); this.schedule(); }
    });
    this.listen(canvas, 'webglcontextlost', event => { event.preventDefault(); this.fail('图形上下文已中断。可以重新载入，或从上方返回主页 / 直接进入理韵。'); });
    this.resize();
  }
  private listen(target: EventTarget, name: string, callback: EventListener) {
    target.addEventListener(name, callback); this.observers.push(() => target.removeEventListener(name, callback));
  }
  async initialize() {
    this.report();
    try {
      // Direct rejection is deliberate: the legacy TaskManager swallowed errors and called them finished.
      await Promise.all(MODELS.map(async name => {
        const object = await AssetManager.Load({ url: 'Genshin/Login/' + name + '.glb' });
        if (this.disposed) return;
        this.viewer.user.resources[name] = object; this.loaded++; this.report();
      }));
      if (this.disposed) return;
      this.viewer.scene.fog = new Fog(0x389af2, 5000, 10000);
      this.viewer.addNode(AmbientLightComponent); this.viewer.addNode(DirectionalLightComponent);
      this.viewer.addNode(PolarLight); this.viewer.addNode(Cloud); this.viewer.addNode(HashFog);
      this.viewer.addNode(Column); this.viewer.addNode(BigCloud);
      this.forward = this.viewer.addNode(ForwardCamera); this.road = this.viewer.addNode(Road);
      this.viewer.addPlugin(gradientBackgroundPlugin); this.viewer.addPlugin(FXAAPlugin);
      this.viewer.addPlugin(BloomPlugin, { mipmapBlur: true, luminanceThreshold: 2, intensity: .6 });
      this.bloom = this.viewer.addPlugin(BloomTransitionEffectPlugin);
      this.viewer.addPlugin(ToneMappingPlugin, { mode: ToneMappingMode.ACES_FILMIC });
      gameManager.on('showDoor', offset => this.forward?.emit('showDoor', offset), this);
      gameManager.on('doorCreateBegin', () => this.playEffect('DoorComeout'), this);
      gameManager.on('doorCreate', () => { if (this.phase === 'journey') { this.phase = 'door'; this.report(); } }, this);
      this.phase = 'welcome'; this.resize(); this.viewer.update(0); this.report(); this.schedule();
    } catch (error) {
      if (import.meta.env.DEV) console.warn('[legacy] original scene initialization failed:', error);
      this.fail('原版场景资源未能完整载入。请重新载入，或直接进入理韵；不会把失败资源当成加载完成。');
    }
  }
  private resize() {
    if (this.disposed) return;
    const width = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    const height = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    this.viewer.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.coarse ? 1 : 1.5));
    this.viewer.resize(width, height);
  }
  private report() { this.hooks.status({ phase: this.phase, loaded: this.loaded, total: MODELS.length, sound: this.sound, paused: this.paused }); }
  private schedule() {
    if (this.disposed || this.background || this.paused || this.phase === 'loading' || this.navigating || this.raf) return;
    this.raf = requestAnimationFrame(this.tick);
  }
  private stop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; }
  private tick = (now: number) => {
    this.raf = 0;
    if (this.disposed || this.background || this.paused) return;
    if (!this.last) this.last = now;
    if (now - this.last < 1000 / this.fpsLimit - .75) { this.schedule(); return; }
    const delta = Math.min(.08, (now - this.last) / 1000); this.last = now;
    try {
      // Upstream start() calls update(), not render(): update runs components, tweens and the postprocess chain.
      this.viewer.update(delta); this.frame++;
      if (this.phase === 'entering') {
        this.entering += delta;
        if (this.entering >= .1 && !this.opened) { this.road?.openDoor(); this.opened = true; }
        if (this.entering >= 2.1 && !this.navigating) { this.navigating = true; gameManager.restart(); }
      }
      this.schedule();
    } catch (error) {
      if (import.meta.env.DEV) console.warn('[legacy] render failed:', error);
      this.fail('这台设备未能继续绘制原版场景。返回与跳过入口仍然可用。');
    }
  };
  start() {
    if (this.disposed || this.phase !== 'welcome') return;
    this.phase = 'journey'; this.road?.emit('start'); gameManager.emit('button-start-click');
    this.playEffect('Duang'); this.report(); this.schedule();
  }
  enter() {
    if (this.disposed || this.phase !== 'door') return;
    this.phase = 'entering'; this.paused = false;
    gameManager.emit('openDoor'); this.forward?.emit('openDoor'); this.bloom?.playTransition();
    this.playEffect('DoorThrough'); this.report(); this.schedule();
  }
  togglePause() {
    if (this.disposed || this.phase === 'loading' || this.phase === 'entering' || this.phase === 'fallback') return;
    this.paused = !this.paused; this.last = 0; this.stop(); this.report(); this.schedule();
  }
  toggleSound() {
    if (this.disposed || this.phase === 'loading') return;
    this.sound = !this.sound;
    if (this.sound) {
      try {
        this.music ||= this.viewer.addNode(AudioComponent);
        this.effects ||= this.viewer.addNode(AudioComponent);
        void this.music.node.context.resume().catch(() => { this.sound = false; this.report(); });
        this.music.play({ url: '/Genshin/BGM.mp3', loop: true });
      } catch { this.sound = false; }
    } else { this.music?.node?.stop(); this.effects?.node?.stop(); }
    this.report();
  }
  private playEffect(name: string) {
    if (this.sound) this.effects?.play({ url: '/Genshin/Genshin Impact [' + name + '].mp3', force: true });
  }
  snapshot() {
    return {
      phase: this.phase, loaded: this.loaded, total: MODELS.length, sound: this.sound, paused: this.paused,
      camera: this.viewer.camera.position.toArray(),
      performance: { frames: this.frame, drawCalls: this.viewer.renderer.info.render.calls, triangles: this.viewer.renderer.info.render.triangles, dpr: this.viewer.renderer.getPixelRatio(), fpsLimit: this.fpsLimit, backgroundPaused: this.background },
    };
  }
  loseContext() { this.viewer.renderer.getContext().getExtension('WEBGL_lose_context')?.loseContext(); }
  fail(message: string) {
    if (this.disposed) return;
    this.phase = 'fallback'; this.report(); this.dispose(); this.hooks.error(message);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.stop(); this.viewer.stop();
    this.observers.forEach(remove => remove()); this.observers = [];
    gameManager.targetOff(this); this.music?.node?.stop(); this.effects?.node?.stop();
    const geometries = new Set<any>(); const materials = new Set<any>(); const textures = new Set<any>();
    const collect = (object: any) => {
      TWEEN.TweenManager.KillTweensOf(object);
      if (object.geometry) geometries.add(object.geometry);
      for (const material of object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : []) {
        materials.add(material);
        for (const value of Object.values(material) as any[]) if (value?.isTexture) textures.add(value);
      }
    };
    this.viewer.scene.traverse(collect);
    for (const object of Object.values(this.viewer.user.resources) as any[]) object?.traverse?.(collect);
    TWEEN.TweenManager.KillTweensOf(this.viewer.camera);
    textures.forEach(texture => texture.dispose()); materials.forEach(material => material.dispose()); geometries.forEach(geometry => geometry.dispose());
    // viewer.destroy() removes its input listeners and renderer; no forced context-loss on reusable canvases.
    this.viewer.destroy(); gameManager.reset();
  }
}
