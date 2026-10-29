import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameSettings } from '../types';

const normalTrack = (value: number) => Math.min(2, Math.max(0, Number.isFinite(value) ? Math.floor(value) : 0));
const normalVolume = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0.55));

/** Owns exactly one music element. start() must be invoked directly by a user gesture. */
export function useAudio(settings: GameSettings, entered: boolean) {
  const [blocked, setBlocked] = useState(false);
  const config = useRef({ settings, entered });
  config.current = { settings, entered };
  const element = useRef<HTMLAudioElement | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const alive = useRef(true);
  const started = useRef(false);
  const track = useRef(-1);
  const fallback = useRef(false);
  const request = useRef(0);
  const fadeFrame = useRef<number | null>(null);
  const resumeWhenVisible = useRef(false);
  const playRef = useRef<() => void>(() => undefined);

  const cancelFade = useCallback(() => {
    if (fadeFrame.current !== null) cancelAnimationFrame(fadeFrame.current);
    fadeFrame.current = null;
  }, []);

  const fadeTo = useCallback((target: number, milliseconds = 500, after?: () => void) => {
    cancelFade();
    const audio = element.current;
    if (!audio) return;
    const startVolume = audio.volume;
    const startTime = performance.now();
    const step = (now: number) => {
      if (!alive.current || element.current !== audio) return;
      const fraction = Math.min(1, (now - startTime) / milliseconds);
      audio.volume = normalVolume(startVolume + (target - startVolume) * fraction);
      if (fraction < 1) fadeFrame.current = requestAnimationFrame(step);
      else { fadeFrame.current = null; after?.(); }
    };
    fadeFrame.current = requestAnimationFrame(step);
  }, [cancelFade]);

  const getAudio = useCallback(() => {
    if (element.current) return element.current;
    const audio = new Audio();
    audio.loop = true;
    audio.preload = 'none';
    audio.volume = 0;
    audio.setAttribute('playsinline', '');
    audio.addEventListener('error', () => {
      if (!alive.current || element.current !== audio) return;
      if (!fallback.current && track.current >= 0) {
        fallback.current = true;
        audio.src = `/assets/audio/bgm${track.current + 1}.mp3`;
        audio.load();
        if (started.current && config.current.entered && config.current.settings.music && !document.hidden) playRef.current();
      } else setBlocked(true);
    });
    element.current = audio;
    return audio;
  }, []);

  const loadTrack = useCallback((number: number) => {
    const audio = getAudio();
    const next = normalTrack(number);
    if (track.current === next && !audio.error) return audio;
    request.current++;
    cancelFade();
    audio.pause();
    audio.volume = 0;
    track.current = next;
    fallback.current = !Boolean(audio.canPlayType('audio/ogg; codecs="opus"'));
    audio.src = `/assets/audio/bgm${next + 1}.${fallback.current ? 'mp3' : 'opus'}`;
    audio.load();
    return audio;
  }, [cancelFade, getAudio]);

  const play = useCallback(() => {
    const audio = element.current;
    if (!audio || !config.current.settings.music || document.hidden) return;
    const token = ++request.current;
    // Invoke play synchronously. Do not await AudioContext.resume before this call.
    const playback = audio.play();
    playback.then(() => {
      if (!alive.current || request.current !== token || element.current !== audio) return;
      setBlocked(false);
      if (document.hidden) { resumeWhenVisible.current = true; audio.pause(); return; }
      fadeTo(normalVolume(config.current.settings.volume));
    }).catch((error: unknown) => {
      if (!alive.current || request.current !== token) return;
      const name = error instanceof DOMException ? error.name : '';
      if (name === 'AbortError') return; // Intentional track change/pause is not a playback denial.
      if (name === 'NotSupportedError' && !fallback.current) {
        fallback.current = true;
        audio.src = `/assets/audio/bgm${track.current + 1}.mp3`;
        audio.load();
        playRef.current();
      } else setBlocked(true);
    });
  }, [fadeTo]);
  playRef.current = play;

  const unlockChime = useCallback(() => {
    try {
      const Constructor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Constructor) return;
      if (!audioContext.current || audioContext.current.state === 'closed') audioContext.current = new Constructor();
      if (audioContext.current.state === 'suspended') void audioContext.current.resume().catch(() => undefined);
    } catch { /* Music remains usable when Web Audio is unavailable. */ }
  }, []);

  const start = useCallback((number?: number) => {
    started.current = true;
    loadTrack(number === undefined ? config.current.settings.track : number);
    if (config.current.settings.music) { unlockChime(); play(); }
    else setBlocked(false);
  }, [loadTrack, play, unlockChime]);

  const playChime = useCallback(() => {
    const { settings: sound } = config.current;
    // 解锁音效是反馈音，不跟随配乐开关，只看音量与页面可见性
    if (normalVolume(sound.volume) === 0 || document.hidden) return;
    unlockChime();
    const context = audioContext.current;
    if (!context || context.state !== 'running') return;
    const now = context.currentTime;
    [659.25, 987.77, 1318.51].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      const at = now + index * 0.055;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(normalVolume(sound.volume) * 0.055, at + 0.014);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.68);
      oscillator.connect(gain); gain.connect(context.destination);
      oscillator.start(at); oscillator.stop(at + 0.72);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    });
  }, [unlockChime]);

  /**
   * 解锁音效：低音铺底 + 五声音阶上行 + 泛音尾音，
   * 和雾散开的那一下对齐，比普通提示音更"厚"。
   */
  const playUnlock = useCallback(() => {
    const { settings: sound } = config.current;
    if (!sound.music || normalVolume(sound.volume) === 0 || document.hidden) return;
    unlockChime();
    const context = audioContext.current;
    if (!context || context.state !== 'running') return;
    const level = normalVolume(sound.volume);
    const now = context.currentTime;

    const tone = (frequency: number, startAt: number, peak: number, decay: number, type: OscillatorType = 'sine') => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, startAt);
      gain.gain.linearRampToValueAtTime(level * peak, startAt + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + decay);
      oscillator.connect(gain); gain.connect(context.destination);
      oscillator.start(startAt); oscillator.stop(startAt + decay + 0.02);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    };

    // 低音铺底，给"解锁"一点体量
    tone(130.81, now, 0.075, 1.05, 'sine');
    tone(196.0, now + 0.02, 0.05, 0.9, 'sine');
    // 五声音阶上行
    tone(392.0, now, 0.085, 1.1, 'triangle');
    tone(523.25, now + 0.06, 0.11, 1.15, 'sine');
    tone(659.25, now + 0.14, 0.105, 1.1, 'sine');
    tone(783.99, now + 0.23, 0.1, 1.15, 'sine');
    // 高音泛音收尾
    tone(1046.5, now + 0.34, 0.105, 1.35, 'sine');
    tone(1567.98, now + 0.36, 0.045, 0.6, 'sine');
  }, [unlockChime]);

  useEffect(() => {
    alive.current = true;
    const visibility = () => {
      const audio = element.current;
      if (!audio) return;
      if (document.hidden) {
        resumeWhenVisible.current = !audio.paused || resumeWhenVisible.current;
        cancelFade(); audio.pause();
        if (audioContext.current?.state === 'running') void audioContext.current.suspend().catch(() => undefined);
      } else if (resumeWhenVisible.current && started.current && config.current.entered && config.current.settings.music) {
        resumeWhenVisible.current = false; unlockChime(); play();
      }
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      alive.current = false; request.current++; cancelFade();
      document.removeEventListener('visibilitychange', visibility);
      if (element.current) { element.current.pause(); element.current.removeAttribute('src'); element.current.load(); element.current = null; }
      if (audioContext.current && audioContext.current.state !== 'closed') void audioContext.current.close().catch(() => undefined);
      audioContext.current = null; track.current = -1;
    };
  }, [cancelFade, play, unlockChime]);

  useEffect(() => {
    if (!entered || !settings.music) {
      resumeWhenVisible.current = false;
      request.current++;
      fadeTo(0, 140, () => element.current?.pause());
      if (!settings.music) setBlocked(false);
      return;
    }
    if (!started.current) return;
    const audio = loadTrack(settings.track);
    if (document.hidden) { resumeWhenVisible.current = true; return; }
    if (audio.paused) play();
    else fadeTo(normalVolume(settings.volume), 200);
  }, [settings.track, settings.volume, settings.music, entered, fadeTo, loadTrack, play]);

  return { blocked, start, playChime, playUnlock };
}

export default useAudio;
