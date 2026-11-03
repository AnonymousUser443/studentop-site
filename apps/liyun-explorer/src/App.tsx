import { Suspense, useRef, useState } from 'react';
import { DISPLAY_LANDMARKS as LANDMARKS, displayPlayerUV } from './map/displayLandmarks';
import { progressOf } from './state';
import { checkInEligibility } from './location/checkIn';
import MapScene from './map/MapScene';
import Hud from './hud/Hud';
import LocationControls from './location/LocationControls';
import { useExplorerController } from './app/useExplorerController';
import { ActivityScreen, Atmosphere, CalibrationScreen, CinematicScreen, MenuScreen, SettingsScreen } from './app/lazyPages';

function PageLoading() {
  return <div className="app-page-loading" role="status" aria-live="polite" style={{ position: 'absolute', inset: 0, zIndex: 90, display: 'grid', placeItems: 'center', background: 'var(--paper-warm, #f6ecd8)', color: 'var(--ink-primary, #273a32)' }}>正在翻开旅途手札…</div>;
}

export default function App() {
  const stage = useRef<HTMLDivElement>(null);
  const { state, entry, map, environment, motion, audio, session, ui, journey, selected, worldPaused, qualitySpec, announcement, cinematic, retained, actions } = useExplorerController(stage);
  const [art, setArt] = useState({ pine: true, mountain: true });
  const mapDisabled = worldPaused;
  const pageOpen = entry.entered && !map.portrait && !cinematic;
  const progress = progressOf(state);
  const previewId = ui.activityReturn?.kind === 'map' ? ui.activityReturn.landmarkId : null;
  return <div className="game-stage" ref={stage} data-testid="game-stage" data-entered={entry.entered} data-progress={progress} data-activity-open={ui.activityOpen} data-route={ui.route} data-world-paused={worldPaused}>
    <div className="scene-paper" aria-hidden="true" />
    <div className="scene-painting" aria-hidden="true"><img src="/assets/paintings/frost-frame.webp" alt="" decoding="async" /><span className="scene-painting-haze" /></div>
    <div className="map-layer" inert={mapDisabled}>
      <MapScene camera={map.camera} viewport={map.viewport} landmarks={LANDMARKS} discoveredIds={state.discoveredIds} selectedId={ui.selectedId} playerUV={displayPlayerUV(state.playerUV)}
        liveLocation={map.reading} locationFresh={map.freshLocation} headingAngle={map.headingAngle} event={journey.event} reducedMotion={motion.reducedMotion}
        onCameraChange={map.moveCamera} onSelect={ui.select} onVisualPosition={map.rememberVisual} fixedTime={journey.fixedTime} paused={worldPaused} disabled={mapDisabled} />
      {retained.atmosphere && <Suspense fallback={null}><Atmosphere camera={map.camera} viewport={map.viewport} landmarks={LANDMARKS} discoveredIds={state.discoveredIds}
        event={journey.event} settings={{ ...state.settings, reducedMotion: motion.reducedMotion }} spec={qualitySpec} paused={worldPaused} seed={42} fixedTime={journey.fixedTime} /></Suspense>}
    </div>
    <div className="scene-vignette" />
    {art.pine && <img className="border-art pine" src="/assets/art/pine-left.webp" alt="" onError={() => setArt(current => ({ ...current, pine: false }))} />}
    {art.mountain && <img className="border-art mountain" src="/assets/art/mountain-right.webp" alt="" onError={() => setArt(current => ({ ...current, mountain: false }))} />}
    <div className="hud-layer" inert={map.portrait || ui.activityOpen || ui.route !== 'map' || Boolean(cinematic)}><Hud
      progress={progress} collected={state.discoveredIds.length} activePanel={ui.activePanel} selected={selected} discovered={Boolean(selected && state.discoveredIds.includes(selected.id))}
      checkIn={selected ? checkInEligibility(selected.id, map.location.state) : null} state={state} landmarks={LANDMARKS} entered={entry.entered}
      toast={announcement?.text ?? null} announcement={announcement} activityReturn={Boolean(ui.activityReturn)} isFullscreen={environment.isFullscreen} audioBlocked={audio.blocked}
      account={session.account} loginBusy={session.loginBusy} loginError={session.loginError} onPanel={ui.showPanel} onSelect={ui.select} onClose={ui.close}
      onExplore={() => ui.selectedId && journey.discover(ui.selectedId)} onLocate={map.locate} onSettings={actions.updateSettings} onReset={() => { void actions.reset().catch(() => undefined); }}
      onFullscreen={environment.fullscreen} onCenter={map.center} onEnter={actions.enter} onLogin={session.login} onGuest={actions.guest} onLogout={actions.logout}
      onLoginPrompt={actions.loginPrompt} onOpenMenu={() => ui.setRoute('menu')}
      context={entry.entered && !map.portrait ? <LocationControls state={map.location.state} heading={map.location.heading} following={map.following} distance={map.distanceLabel} onLocate={map.locate} onStop={map.stopLocation} /> : null}
    /></div>
    {pageOpen && ui.route === 'map' && ui.activityReturn?.kind === 'map' && !ui.activePanel && !ui.selectedId && <section className="activity-map-return" aria-label="活动地图预览">
      <small>{LANDMARKS.find(item => item.id === previewId)?.name} · 校园地图预览</small>
      <button type="button" data-testid="activity-return" onClick={ui.openActivities}><span aria-hidden="true">←</span>返回活动一览</button>
    </section>}
    {retained.activity && <div className="activity-layer" inert={map.portrait || Boolean(cinematic)}><Suspense fallback={ui.activityOpen ? <PageLoading /> : null}>
      <ActivityScreen open={ui.activityOpen} reducedMotion={motion.reducedMotion} quality={state.settings.quality} discoveredIds={state.discoveredIds}
        onClose={ui.closeActivities} onVisitMap={ui.visitActivityMap} onViewCollection={ui.viewActivityCollection} />
    </Suspense></div>}
    {retained.menu && <Suspense fallback={ui.route === 'menu' ? <PageLoading /> : null}><MenuScreen open={pageOpen && ui.route === 'menu'}
      account={session.account} progress={progress} collected={state.discoveredIds.length} total={LANDMARKS.length} returnFocus={ui.menuReturnFocus} onClose={() => ui.setRoute('map')} onNavigate={ui.navigateMenu} onLoginPrompt={actions.loginPrompt} /></Suspense>}
    {retained.settings && <Suspense fallback={ui.route === 'settings' ? <PageLoading /> : null}><SettingsScreen open={pageOpen && ui.route === 'settings'} initialCategory={ui.initialCategory}
      onClose={() => ui.setRoute('menu')} account={session.account} onLoginPrompt={actions.loginPrompt} onLogout={actions.logout} onResetProgress={actions.reset}
      onClearLocalSave={actions.clearLocalSave} onExportSave={actions.exportSave} isFullscreen={environment.isFullscreen} onFullscreen={environment.fullscreen} onOpenCalibration={import.meta.env.DEV ? () => ui.setRoute('calibration') : undefined} /></Suspense>}
    {ui.route === 'calibration' && (CalibrationScreen ? <Suspense fallback={<PageLoading />}><CalibrationScreen onClose={() => ui.setRoute('map')} /></Suspense> :
      <section data-testid="calibration-local-only" style={{ position: 'absolute', inset: 0, zIndex: 90, display: 'grid', placeContent: 'center', gap: 16, padding: 24, background: 'var(--paper-200)', color: 'var(--ink-900)' }}>
        <h1>地图标定工具</h1><p>仅本地开发环境开放</p><a href="http://127.0.0.1:5174/?tool=calibration" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '8px 16px', border: '1px solid currentColor', width: 'fit-content' }}>打开标定工具 ↗</a>
      </section>)}
    {retained.cinematic && <Suspense fallback={cinematic ? <PageLoading /> : null}><CinematicScreen payload={cinematic} onComplete={actions.completeCinematic} /></Suspense>}
    {map.portrait && ui.route !== 'calibration' && <div className="orientation-gate" role="dialog" aria-modal="true" aria-label="请横屏探索">
      <svg viewBox="0 0 100 100" fill="none" aria-hidden="true"><g className="rotate-line"><rect x="30" y="12" width="40" height="76" rx="7" stroke="currentColor" strokeWidth="2" /><path d="M43 20h14M46 80h8" stroke="currentColor" strokeWidth="2" /></g><path d="M83 32a38 38 0 0 0-56-15m-2-8 1 10 10-2M17 68a38 38 0 0 0 56 15m2 8-1-10-10 2" stroke="currentColor" strokeWidth="2" /></svg>
      <h1>展开一方天地</h1><p>{matchMedia('(pointer: coarse)').matches ? '请手动旋转手机，横屏开启校园之旅' : '请将浏览器窗口调整为横向，开启校园之旅'}<br />你的探索进度会为你保留</p><small>理韵寻踪 · 北理校园探索</small>
    </div>}
  </div>;
}
