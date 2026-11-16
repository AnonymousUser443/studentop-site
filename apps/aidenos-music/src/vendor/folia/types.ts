/*! Folia contributors — AGPL-3.0-only. Adapted for Tingchao; see vendor/folia/NOTICE.md. */
import type { MotionValue } from 'motion/react';
import type { LineRenderHints } from './utils/lyrics/renderHints';


export interface LyricRuby {
  text: string;
  startTime: number; // Seconds
  endTime: number; // Seconds
}


export interface LyricSyllable {
  text: string;
  startTime: number; // Seconds
  endTime: number; // Seconds
  endsWithSpace?: boolean;
  ruby?: LyricRuby[];
  obscene?: boolean;
  emptyBeat?: number;
}


export interface LyricAlternateText {
  role: 'translation' | 'romanization' | string;
  language?: string;
  text: string;
  syllables?: LyricSyllable[];
}


export interface Word {
  text: string;
  startTime: number; // Seconds
  endTime: number; // Seconds
  syllables?: LyricSyllable[];
}


export interface LyricBackgroundVocal {
  text: string;
  startTime: number; // Seconds
  endTime: number; // Seconds
  words: Word[];
  agentId?: string;
  translation?: string;
  romanization?: string;
  alternateTexts?: LyricAlternateText[];
}


export interface Line {
  words: Word[];
  startTime: number;
  endTime: number;
  fullText: string;
  translation?: string;
  id?: string;
  agentId?: string;
  songPart?: string;
  blockIndex?: number;
  romanization?: string;
  alternateTexts?: LyricAlternateText[];
  backgroundVocal?: LyricBackgroundVocal;
  backgroundVocals?: LyricBackgroundVocal[];
  renderHints?: LineRenderHints;
  isChorus?: boolean;
  chorusEffect?: 'bars' | 'circles' | 'beams';
  // User-saved fine word boundaries for fullText, baked in upstream by the lyric setter.
  // join('') must equal fullText. When present it wins over every automatic segmentation.
  wordSegments?: string[];
  // icu-folia's automatic word boundaries for fullText (utils/lyrics/icuFolia), baked in by the
  // lyric setter once its engines have loaded. Used when there is no wordSegments; absent until
  // then, and the line falls back to plain Intl.Segmenter.
  autoWordSegments?: string[];
}


export interface Theme {
  name: string;
  backgroundColor: string;
  primaryColor: string;
  accentColor: string;
  secondaryColor: string;
  fontStyle: 'sans' | 'serif' | 'mono';
  fontFamily?: string;
  fontFamilyStack?: string[];
  fontWeight?: number;
  animationIntensity: 'calm' | 'normal' | 'chaotic';
  wordColors?: { word: string; color: string; }[];
  lyricsIcons?: string[];
  provider?: string;
  description?: string;
}


/**
 * 用 canvas / WebGL 画的歌词样式的渲染分辨率：相对样式自己默认像素密度（大多是屏幕的 devicePixelRatio，钳到 2）的倍数，
 * 大于 1 是超采样（utils/lyricRenderQuality.ts）。
 */
export type LyricRenderScale = 0.5 | 0.75 | 1 | 1.5 | 2;

/** 歌词画布的抗锯齿：auto 是各样式自己的默认（有的开 MSAA，有的靠后处理）。 */
export type LyricAntialias = 'auto' | 'on' | 'off';

/** 「动画与性能」里的全局挡位：各样式默认跟随它。 */
export interface LyricRenderQuality {
  scale: LyricRenderScale;
  antialias: LyricAntialias;
}

/** 一个歌词样式自己的分辨率与抗锯齿（存在样式的 tuning 里）：global 跟随全局挡位。 */
export interface LyricRenderOverride {
  scale: 'global' | LyricRenderScale;
  antialias: 'global' | 'on' | 'off';
}


export type SonnetOuterFrameMode = 'none' | 'frame' | 'full';


export interface SonnetTuning {
  /** 分辨率与抗锯齿（#929）：默认跟随「动画与性能」里的全局挡位（utils/lyricRenderQuality.ts）。 */
  render: LyricRenderOverride;
  cameraIntensity: number;
  typographyMotion: number;
  mgDensity: number;
  showOnlyText: boolean;
  showGuide: boolean;
  showBackgroundMg: boolean;
  showFixedGeo: boolean;
  showGiantDecorativeText: boolean;
  showBackgroundDecor: boolean;
  enableTransitions: boolean;
  outerFrameMode: SonnetOuterFrameMode;
  textureResolution: number;
  /** Master switch for the scene-wide post-process stack (grain + contrast). */
  postProcessEnabled: boolean;
  /** Film grain amount, 0..1. */
  postProcessGrain: number;
  /** Contrast boost, 0..1. */
  postProcessContrast: number;
  /** Fixed print-style passes riding the master switch; strength sliders, 0 disables the pass. */
  postProcessRgbShift: number;
  postProcessHalftone: number;
  /** Vignette strength, 0..2 (2 = double the base darkening). */
  postProcessVignette: number;
  /** Radial lens curvature amount, 0..2. */
  postProcessLensDistortion: number;
  /** Radial chromatic dispersion amount, 0..1. */
  postProcessLensDispersion: number;
}


export const DEFAULT_SONNET_TUNING: SonnetTuning = {
  render: { scale: 'global', antialias: 'global' },
  cameraIntensity: 1,
  typographyMotion: 1,
  mgDensity: 1,
  showOnlyText: false,
  showGuide: true,
  showBackgroundMg: true,
  showFixedGeo: true,
  showGiantDecorativeText: true,
  showBackgroundDecor: true,
  enableTransitions: true,
  outerFrameMode: 'full',
  textureResolution: 1.5,
  postProcessEnabled: false,
  postProcessGrain: 0.2,
  postProcessContrast: 0,
  postProcessRgbShift: 0,
  postProcessHalftone: 0,
  postProcessVignette: 0.85,
  postProcessLensDistortion: 0.3,
  postProcessLensDispersion: 0.6,
};
export interface AudioBands { bass: MotionValue<number>; lowMid: MotionValue<number>; mid: MotionValue<number>; vocal: MotionValue<number>; treble: MotionValue<number>; spectrum: MotionValue<Uint8Array>; }
