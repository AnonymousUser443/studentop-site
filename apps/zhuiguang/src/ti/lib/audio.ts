/**
 * 合成音效（WebAudio）
 * ------------------------------------------------------------
 * 不依赖任何音频文件：全部用振荡器 / 噪声实时合成。
 * 理由：原型阶段没有音源素材，且合成音的体积为零、可精确对齐时间轴。
 *
 * 正式版应替换为真实录音（见《11_素材清单》），
 * 但接口保持一致，朗读侧只需换实现。
 */

import { audio } from '../../core/audio';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function ensure(): AudioContext | null {
  if (typeof window === "undefined" || !audio.isUnlocked() || audio.isMuted()) return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** 用户第一次交互时调用，解锁音频 */
export function unlockAudio() {
  ensure();
}

function noiseBuffer(dur: number): AudioBuffer {
  const c = ensure()!;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

/** 低频轰鸣：章节点亮 / 「人工智能」 */
export function boom(gain = 0.5) {
  const c = ensure();
  if (!c || !master) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(58, t);
  o.frequency.exponentialRampToValueAtTime(28, t + 1.4);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 2.3);
}

/** 通电：数据启动 */
export function dataBoot() {
  const c = ensure();
  if (!c || !master) return;
  [880, 1320, 1760].forEach((f, i) => {
    const t = c.currentTime + i * 0.09;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "triangle";
    o.frequency.value = f;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g).connect(master!);
    o.start(t);
    o.stop(t + 0.18);
  });
}

/** 磬：金句 */
export function chime(gain = 0.16) {
  const c = ensure();
  if (!c || !master) return;
  const t = c.currentTime;
  [1318.5, 1975.5, 2637].forEach((f, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.value = f;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain / (i + 1), t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6 - i * 0.4);
    o.connect(g).connect(master!);
    o.start(t);
    o.stop(t + 2.8);
  });
}

/** 印章：砸在纸上 */
export function sealStamp(gain = 0.35) {
  const c = ensure();
  if (!c || !master) return;
  const t = c.currentTime;

  // 低频冲击
  const o = c.createOscillator();
  const og = c.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(120, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.25);
  og.gain.setValueAtTime(gain, t);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  o.connect(og).connect(master);
  o.start(t);
  o.stop(t + 0.4);

  // 纸张摩擦噪声
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(0.3);
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1900;
  bp.Q.value = 0.8;
  const ng = c.createGain();
  ng.gain.setValueAtTime(0, t);
  ng.gain.linearRampToValueAtTime(gain * 0.5, t + 0.006);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  src.connect(bp).connect(ng).connect(master);
  src.start(t);
}

/** 极短提示音，五声音阶之一 */
export function tick(index = 0, gain = 0.05) {
  const c = ensure();
  if (!c || !master) return;
  const scale = [523.25, 587.33, 659.25, 783.99, 880]; // 宫商角徵羽
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sine";
  o.frequency.value = scale[index % scale.length];
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.1);
}

/** 电子脉冲 / 数据流 */
export function pulse(gain = 0.06, dur = 0.5) {
  const c = ensure();
  if (!c || !master) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  const f = c.createBiquadFilter();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(130, t);
  o.frequency.linearRampToValueAtTime(260, t + dur);
  f.type = "lowpass";
  f.frequency.value = 900;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f).connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

/** 裂纹 */
export function crack(gain = 0.08) {
  const c = ensure();
  if (!c || !master) return;
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(0.25);
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 2400;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  src.connect(hp).connect(g).connect(master);
  src.start(t);
}

/** 故障：短促的方波蜂鸣 */
export function buzz(gain = 0.1) {
  const c = ensure();
  if (!c || !master) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "square";
  o.frequency.value = 62;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.005);
  g.gain.setValueAtTime(gain, t + 0.1);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.24);
}

/** 上升：问号汇聚 */
export function rise(dur = 1.8, gain = 0.1) {
  const c = ensure();
  if (!c || !master) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(180, t);
  o.frequency.exponentialRampToValueAtTime(720, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + dur * 0.85);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.4);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.5);
}
