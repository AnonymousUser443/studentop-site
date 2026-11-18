/* Local-file decoding and transport. AudioContext time, not animation frames, times the marks. */
window.MW.Audio = (() => {
  'use strict';
  let state, ctx, source, startClock = 0, offset = 0, ended;
  let sequence = null, calibration = null;
  const clamp = (n, low, high) => Math.min(high, Math.max(low, n));

  function context() {
    if (!ctx) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error('浏览器不支持 Web Audio');
      ctx = new Audio();
    }
    return ctx;
  }

  async function ensure() {
    const c = context();
    if (c.state !== 'running') await c.resume();
    if (c.state !== 'running') throw new Error('浏览器暂时无法播放音频，请重试');
    return c;
  }

  // Decode at the output context's rate; report the source rate only when its header is known.
  function sourceRate(bytes, name) {
    const d = new DataView(bytes);
    const end = Math.min(262144, d.byteLength);
    if (end >= 12 && d.getUint32(0) === 0x52494646 && d.getUint32(8) === 0x57415645) {
      for (let i = 12; i + 8 <= end;) {
        const size = d.getUint32(i + 4, true);
        if (d.getUint32(i) === 0x666d7420 && size >= 8 && i + 16 <= end) return d.getUint32(i + 12, true) || null;
        i += 8 + size + (size & 1);
      }
    } else if (end >= 21 && d.getUint32(0) === 0x664c6143 && (d.getUint8(4) & 0x7f) === 0 && (d.getUint32(4) & 0xffffff) === 34) {
      return ((d.getUint16(18) << 4) | (d.getUint8(20) >> 4)) || null;
    } else if (/\.mp3$/i.test(name)) {
      const rates = { 0: [11025, 12000, 8000], 2: [22050, 24000, 16000], 3: [44100, 48000, 32000] };
      let start = 0;
      if (end >= 10 && (d.getUint32(0) >>> 8) === 0x494433) {
        start = 10;
        for (let i = 6; i < 10; i++) start += (d.getUint8(i) & 127) << ((9 - i) * 7);
        if (d.getUint8(3) === 4 && d.getUint8(5) & 0x10) start += 10;
      }
      for (let i = start; i + 4 <= end; i++) {
        const bits = d.getUint32(i);
        const version = (bits >>> 19) & 3, layer = (bits >>> 17) & 3;
        const bitrate = (bits >>> 12) & 15, rateIndex = (bits >>> 10) & 3;
        if ((bits >>> 21) === 0x7ff && layer === 1 && bitrate > 0 && bitrate < 15 && rates[version]?.[rateIndex]) {
          return rates[version][rateIndex];
        }
      }
    }
    return null;
  }

  async function decode(file) {
    const c = context();
    const bytes = await file.arrayBuffer();
    const nativeRate = sourceRate(bytes, file.name);
    // Callback form also covers browsers that never returned a Promise here.
    const buffer = await new Promise((resolve, reject) => {
      // Some implementations both invoke the error callback and reject the returned Promise.
      c.decodeAudioData(bytes, resolve, reject)?.catch(reject);
    });
    if (!buffer.length || !Number.isFinite(buffer.duration)) throw new Error('音频为空或无法识别');
    return { buffer, nativeRate };
  }

  function detach() {
    if (!source) return;
    const node = source;
    source = null;
    node.onended = null;
    try { node.stop(); } catch { /* Already ended. */ }
    node.disconnect();
  }

  function eventClock(stamp) {
    let ms = Number(stamp);
    if (ms > 1e12) ms -= performance.timeOrigin;
    const age = Number.isFinite(ms) && ms > 0 ? clamp((performance.now() - ms) / 1000, 0, .25) : 0;
    return ctx.currentTime - (ctx.state === 'running' ? age : 0);
  }

  function getTime(stamp) {
    if (!source) return state.playhead;
    const elapsed = Math.max(0, eventClock(stamp) - startClock);
    return clamp(offset + elapsed * state.rate, 0, state.duration);
  }

  function playAt(time, when = ctx.currentTime) {
    detach();
    const node = ctx.createBufferSource();
    node.buffer = state.buffer;
    node.playbackRate.value = state.rate;
    node.connect(ctx.destination);
    try { node.start(when, time); } catch (error) { node.disconnect(); throw error; }
    startClock = when;
    offset = time;
    state.playhead = time;
    source = node;
    node.onended = () => {
      if (node !== source) return;
      node.disconnect();
      source = null;
      state.playhead = state.duration;
      ended?.();
    };
  }

  function play(when) {
    if (!ctx || !state.buffer || source) return;
    const time = state.playhead >= state.duration ? 0 : state.playhead;
    playAt(time, when);
  }

  function pause() {
    state.playhead = getTime();
    detach();
  }

  function stop() {
    detach();
    state.playhead = 0;
  }

  function seek(time) {
    const t = clamp(time, 0, state.duration);
    if (source && t < state.duration) playAt(t, Math.max(startClock, ctx.currentTime));
    else {
      detach();
      state.playhead = t;
    }
  }

  function setRate(rate) {
    const t = getTime();
    state.rate = rate;
    if (source && t < state.duration) {
      offset = t;
      startClock = Math.max(startClock, ctx.currentTime);
      source.playbackRate.value = rate;
    }
  }

  function tone(when, hz, volume, length, type = 'sine') {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = hz;
    gain.gain.setValueAtTime(.0001, when);
    gain.gain.exponentialRampToValueAtTime(volume, when + .006);
    gain.gain.exponentialRampToValueAtTime(.0001, when + length);
    oscillator.connect(gain).connect(ctx.destination);
    let active = true;
    function dispose() {
      if (!active) return;
      active = false;
      oscillator.disconnect();
      gain.disconnect();
    }
    oscillator.onended = dispose;
    oscillator.start(when);
    oscillator.stop(when + length + .01);
    return () => {
      if (!active) return;
      oscillator.stop();
      dispose();
    };
  }

  function playBlip(index) {
    if (!ctx || ctx.state !== 'running') return;
    tone(ctx.currentTime, [880, 523, 784, 349, 659, 440][index % 6] || 523, .045, .055);
  }

  function cancelClicks() {
    if (sequence) sequence.cancel();
    sequence = null;
    calibration = null;
  }

  function scheduleClicks(beats, interval, lead, onTick, onFinish) {
    cancelClicks();
    const t0 = ctx.currentTime + lead;
    const times = Array.from({ length: beats }, (_, i) => t0 + i * interval);
    const finish = t0 + beats * interval;
    const stopTones = times.map((t, i) => tone(t, i === 0 ? 1240 : 870, .16, .083, 'triangle'));
    const timers = times.map((t, i) => setTimeout(() => onTick(i + 1), Math.max(0, (t - ctx.currentTime) * 1000)));
    timers.push(setTimeout(onFinish, Math.max(0, (finish - ctx.currentTime) * 1000)));
    sequence = { cancel() { timers.forEach(clearTimeout); stopTones.forEach(stopTone => stopTone()); } };
    return { times, finish };
  }

  function startCountIn(beats, onTick, onFinish) {
    return scheduleClicks(beats, .5, .12, onTick, onFinish).finish;
  }

  function startCalibration(beats, onTick, onFinish) {
    calibration = { times: scheduleClicks(beats, .6, .35, onTick, onFinish).times, errors: new Map() };
  }

  function calibrationTap(stamp) {
    if (!calibration) return null;
    const t = eventClock(stamp);
    let index = -1, error = .241;
    calibration.times.forEach((beat, i) => {
      if (Math.abs(t - beat) < Math.abs(error)) { index = i; error = t - beat; }
    });
    if (index < 0) return null;
    if (!calibration.errors.has(index) || Math.abs(error) < Math.abs(calibration.errors.get(index))) {
      calibration.errors.set(index, error);
    }
    return { count: calibration.errors.size, ms: error * 1000 };
  }

  function endCalibration() {
    const values = [...(calibration?.errors.values() || [])].sort((a, b) => a - b);
    cancelClicks();
    const i = (values.length - 1) / 2;
    return { count: values.length, ms: values.length ? (values[Math.floor(i)] + values[Math.ceil(i)]) * 500 : 0 };
  }

  return {
    init(a) { state = a.state; }, ensure, decode, play, pause, stop, seek, getTime, setRate,
    isPlaying: () => !!source, onEnded(fn) { ended = fn; }, playBlip, startCountIn, cancelClicks,
    startCalibration, calibrationTap, endCalibration,
    latencyInfo: () => ctx?.outputLatency ?? ctx?.baseLatency ?? null
  };
})();
