// Static URLs let Vite include the original files in both development and dist/.
export const BGM_TRACKS = Object.freeze({
  dawn_dusk: new URL('../bgm/dawn_dusk.opus', import.meta.url).href,
  day: new URL('../bgm/day.opus', import.meta.url).href,
  night: new URL('../bgm/night.opus', import.meta.url).href,
});

export const PERIOD_BGM = Object.freeze({ morning: 'dawn_dusk', day: 'day', evening: 'dawn_dusk', night: 'night' });
const LABELS = { morning: '清晨', day: '白昼', evening: '黄昏', night: '月夜' };
const VOLUME = 0.65;
const CROSSFADE = 2.4;
const MUTE_FADE = 0.4;

/** Stream the supplied BGM; at most three reusable players, with no decoded-song cache. */
export class CampusAudio {
  constructor({ onStateChange = () => {}, onError = () => {} } = {}) {
    this.onStateChange = onStateChange;
    this.onError = onError;
    this.enabled = false;
    this.period = 'day';
    this.preferenceMade = false;
    this.context = null;
    this.tracks = new Map();
    this.activeKey = null;
    this.loading = false;
    this.error = null;
    this.request = 0;
    this.cleanupTimer = null;
    this.disposed = false;
  }

  start() {
    // Re-entering the journey must respect an earlier explicit mute.
    if (this.preferenceMade || this.disposed) return Promise.resolve(this.enabled);
    this.preferenceMade = true;
    return this.setEnabled(true);
  }

  toggle() {
    this.preferenceMade = true;
    return this.setEnabled(!this.enabled);
  }

  setEnabled(enabled) {
    if (this.disposed) return Promise.resolve(false);
    this.enabled = Boolean(enabled);
    this.error = null;
    return this.syncPlayback();
  }

  setPeriod(period) {
    if (!Object.hasOwn(PERIOD_BGM, period) || this.period === period || this.disposed) return;
    const previousKey = PERIOD_BGM[this.period];
    this.period = period;
    this.notify();
    // Morning and evening share one recording; do not restart it when previewing.
    if (this.enabled && previousKey !== PERIOD_BGM[period]) void this.syncPlayback();
  }

  ensureContext() {
    if (this.context) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) throw new Error('当前浏览器暂不支持环境音乐');
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.context.destination);
  }

  getTrack(key) {
    if (this.tracks.has(key)) return this.tracks.get(key);
    const media = new Audio();
    media.preload = 'none';
    media.loop = true;
    media.src = BGM_TRACKS[key];
    const source = this.context.createMediaElementSource(media);
    const gain = this.context.createGain();
    gain.gain.value = 0;
    source.connect(gain);
    gain.connect(this.master);
    const track = { key, media, source, gain };
    this.tracks.set(key, track);
    // Also surface a network/decoder failure occurring after play() has resolved.
    media.addEventListener('error', () => {
      if (this.enabled && PERIOD_BGM[this.period] === key) this.fail(this.request);
    });
    return track;
  }

  fade(param, target, duration) {
    const now = this.context.currentTime;
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(now);
    else {
      const current = param.value;
      param.cancelScheduledValues(now);
      param.setValueAtTime(current, now);
    }
    param.linearRampToValueAtTime(target, now + duration);
  }

  scheduleCleanup(request, seconds) {
    clearTimeout(this.cleanupTimer);
    this.cleanupTimer = setTimeout(() => {
      if (request !== this.request || this.disposed) return;
      for (const [key, track] of this.tracks) {
        if (!this.enabled || key !== this.activeKey) track.media.pause();
      }
      this.cleanupTimer = null;
      this.notify();
    }, seconds * 1000 + 80);
  }

  async syncPlayback() {
    const request = ++this.request;
    clearTimeout(this.cleanupTimer);
    if (!this.enabled) {
      this.loading = false;
      if (this.context) {
        this.fade(this.master.gain, 0, MUTE_FADE);
        this.scheduleCleanup(request, MUTE_FADE);
      }
      this.notify();
      return false;
    }

    this.loading = true;
    this.notify();
    try {
      this.ensureContext();
      const key = PERIOD_BGM[this.period];
      const track = this.getTrack(key);
      if (track.media.error) track.media.load();
      // Both calls happen synchronously inside the initiating user gesture.
      const resumed = this.context.resume();
      const playing = track.media.play();
      await Promise.all([resumed, playing]);
      if (request !== this.request || this.disposed) return this.enabled;

      const duration = this.activeKey ? CROSSFADE : 1.2;
      this.activeKey = key;
      this.loading = false;
      for (const [otherKey, other] of this.tracks) this.fade(other.gain.gain, otherKey === key ? 1 : 0, duration);
      this.fade(this.master.gain, VOLUME, duration);
      this.scheduleCleanup(request, duration);
      this.notify();
    } catch (error) {
      if (request === this.request && !this.disposed) this.fail(request, error);
    }
    return this.enabled;
  }

  fail(request, cause) {
    if (request !== this.request || this.disposed) return;
    const current = ++this.request;
    this.enabled = false;
    this.loading = false;
    this.error = cause?.name === 'NotAllowedError'
      ? '点击右上角音乐按钮，开启这段旅程的音乐。'
      : '音乐暂时无法播放，请点击音乐按钮重试。';
    if (this.context) {
      this.fade(this.master.gain, 0, MUTE_FADE);
      this.scheduleCleanup(current, MUTE_FADE);
    }
    this.notify();
    this.onError(this.error);
  }

  getState() {
    return {
      enabled: this.enabled, loading: this.loading, period: this.period,
      track: PERIOD_BGM[this.period], activeTrack: this.activeKey,
      label: `${LABELS[this.period]}音乐`, error: this.error,
      contextState: this.context?.state || 'idle', masterGain: this.master?.gain.value || 0,
      players: [...this.tracks].map(([key, { media, gain }]) => ({
        key, src: media.currentSrc || media.src, paused: media.paused, loop: media.loop,
        currentTime: media.currentTime, duration: Number.isFinite(media.duration) ? media.duration : null,
        readyState: media.readyState, gain: gain.gain.value,
      })),
    };
  }

  notify() { this.onStateChange(this.getState()); }

  dispose() {
    this.disposed = true;
    this.enabled = false;
    ++this.request;
    clearTimeout(this.cleanupTimer);
    for (const { media, source, gain } of this.tracks.values()) {
      media.pause();
      media.removeAttribute('src');
      media.load();
      source.disconnect();
      gain.disconnect();
    }
    this.tracks.clear();
    this.master?.disconnect();
    if (this.context) void this.context.close();
  }
}
