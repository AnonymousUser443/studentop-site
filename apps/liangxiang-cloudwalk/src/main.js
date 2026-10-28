import { CampusJourney } from './engine.js';
import { CampusAudio } from './audio.js';
import { LANDMARKS } from './landmarks.js';
import { initUI } from './ui.js';

let world;
let paused = false;
let visible = true;
let lastDistance = -1;
const audio = new CampusAudio({
  onStateChange: (state) => ui.setSound(state.enabled, state),
  onError: (message) => ui.toast(message),
});

const actions = {
  start() {
    world?.start();
    if (paused) actions.togglePause();
    void audio.start();
  },
  home() { if (world) world.journey = false; },
  togglePause() {
    if (!world) return;
    paused = !paused;
    world.setPaused(paused);
    ui.setPaused(paused);
  },
  toggleSound() { void audio.toggle(); },
  async toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else ui.toast('当前浏览器暂不支持全屏，请使用浏览器全屏功能');
    } catch { ui.toast('请点击右上角的全屏按钮重试'); }
  },
  setSpeed(value) { world?.setSpeed(value); },
  setTimeMode(mode) { world?.setTimeMode(mode); },
  jumpToLandmark(index) {
    if (!world) return;
    world.jumpToLandmark(index);
    actions.start();
    ui.setJourney(true);
  },
};

const ui = initUI(actions);
ui.setLandmarks(LANDMARKS);
ui.setSources(LANDMARKS.filter((landmark) => landmark.source).map((landmark) => ({ title: landmark.title, url: landmark.source })));
ui.setLoading(0.16);

async function boot() {
  try {
    // Let the first loading frame paint before generating the instanced geometry.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await Promise.all([document.fonts.load('500 24px "Campus Serif"'), document.fonts.load('400 24px "Campus Sans"')]);
    ui.setLoading(0.28);
    world = new CampusJourney(document.getElementById('scene'), {
      timeMode: new URLSearchParams(window.location.search).get('time') || 'auto',
      onTimeChange: (state) => {
        ui.setTimeState(state);
        audio.setPeriod(state.period);
      },
      onLandmark: (landmark) => ui.setLandmark(landmark),
      onDistance: (distance) => {
        if (distance !== lastDistance) { ui.setDistance(distance); lastDistance = distance; }
      },
    });
    ui.setLoading(0.8);
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    ui.setLoading(1);
    // Development-only read-only diagnostics; production must not expose maintenance state.
    if (import.meta.env.DEV) {
      window.campus = { stats: () => ({ ...world.stats(), audio: audio.getState() }) };
    }
  } catch (error) {
    console.error('Cloudwalk could not start:', error);
    const startup = document.getElementById('startup');
    startup.classList.add('startup-error');
    startup.replaceChildren();
    const title = document.createElement('p');
    title.textContent = '云上的路，暂时还没有打开。';
    const detail = document.createElement('p');
    detail.textContent = '请使用支持三维画面的浏览器，并开启硬件加速后重试。';
    const retry = document.createElement('button');
    retry.textContent = '重新打开';
    retry.className = 'start-button';
    retry.addEventListener('click', () => window.location.reload());
    startup.append(title, detail, retry);
  }
}

window.addEventListener('keydown', (event) => {
  if (event.repeat || ui.isDialogOpen() || event.ctrlKey || event.metaKey || event.altKey) return;
  const target = event.target instanceof HTMLElement ? event.target : null;
  if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
  if ((event.code === 'Space' || event.code === 'Enter') && target?.closest('button, a')) return;
  switch (event.code) {
    case 'Space': event.preventDefault(); actions.togglePause(); break;
    case 'KeyM': actions.toggleSound(); break;
    case 'KeyF': actions.toggleFullscreen(); break;
    case 'KeyH': visible = !visible; ui.setVisible(visible); break;
    case 'Enter': actions.start(); ui.setJourney(true); break;
  }
});

boot();
