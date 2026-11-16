import type { Lyrics } from "../domain";
import type { Line, SonnetTuning, Theme } from "../vendor/folia/types";
import { DEFAULT_SONNET_TUNING } from "../vendor/folia/types";

/** The API/domain stays in milliseconds; only this rendering boundary uses seconds. */
export function toFoliaLines(lyrics: Lyrics | null): Line[] {
  return (lyrics?.lines ?? []).map((line) => {
    const startTime = Math.max(0, Number.isFinite(line.startMs) ? line.startMs / 1000 : 0);
    const endTime = Math.max(startTime, Number.isFinite(line.endMs) ? line.endMs / 1000 : startTime);
    return {
      id: line.id,
      fullText: line.text,
      startTime,
      endTime,
      translation: line.translation,
      romanization: line.romanization,
      // LRC lines remain line-timed. Never invent word timing or duet information.
      words: lyrics?.hasWordTiming ? line.words.filter((word) =>
        Number.isFinite(word.startMs) && Number.isFinite(word.durationMs),
      ).map((word) => ({
        text: word.text,
        startTime: Math.max(startTime, word.startMs / 1000),
        endTime: Math.max(startTime, (word.startMs + Math.max(0, word.durationMs)) / 1000),
      })) : [],
    };
  });
}

export function findLyricIndex(lines: Line[], time: number): number {
  let low = 0, high = lines.length - 1, index = -1;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    if (lines[mid].startTime <= time) { index = mid; low = mid + 1; }
    else high = mid - 1;
  }
  return index;
}

export interface StagePalette { background: string; text: string; teal: string; gold: string; }
export function makeFoliaTheme(palette: StagePalette): Theme {
  return {
    name: "听潮 · 潮汐演出",
    backgroundColor: palette.background,
    primaryColor: palette.text,
    accentColor: palette.teal,
    secondaryColor: palette.gold,
    // Full CJK coverage comes from the existing packaged UI face. A partial
    // display subset would mix serif/sans glyphs within a single dynamic line.
    fontStyle: "sans",
    fontFamilyStack: ["Tingchao UI", "Jade UI", "Noto Sans SC", "HarmonyOS Sans SC"],
    fontWeight: 500,
    animationIntensity: "calm",
    lyricsIcons: [],
  };
}

/** Colour comes from the host CSS variables, so day/night and future themes stay in sync. */
export function readFoliaTheme(element: HTMLElement): Theme {
  const style = getComputedStyle(element);
  const token = (name: string) => style.getPropertyValue(name).trim();
  return makeFoliaTheme({
    background: token("--tc-lyric-bg"), text: token("--tc-lyric-text"),
    teal: token("--tc-teal"), gold: token("--tc-gold"),
  });
}

/** Gentle spatial typography; no RGB split, grain, flashing or full-screen stock frame. */
export const TINGCHAO_SONNET_TUNING: SonnetTuning = {
  ...DEFAULT_SONNET_TUNING,
  cameraIntensity: 0.28,
  typographyMotion: 0.65,
  mgDensity: 0.38,
  showGuide: false,
  showFixedGeo: false,
  showBackgroundMg: true,
  showGiantDecorativeText: false,
  showBackgroundDecor: false,
  outerFrameMode: "none",
  textureResolution: 1.25,
  postProcessEnabled: false,
  postProcessRgbShift: 0,
  postProcessLensDistortion: 0,
  postProcessLensDispersion: 0,
};
