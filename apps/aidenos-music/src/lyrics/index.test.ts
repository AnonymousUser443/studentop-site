import { describe, expect, it } from "vitest";
import type { RawLyrics } from "../domain";
import {
  findLyricLineIndex,
  findLyricWordIndex,
  lyricWordProgress,
  parseLrc,
  parseLyrics,
  parseYrc,
} from "./index";

const raw = (patch: Partial<RawLyrics>): RawLyrics => ({
  lrc: "",
  yrc: "",
  translation: "",
  romanization: "",
  instrumental: false,
  ...patch,
});

describe("lyric parsing and lookup", () => {
  it("expands repeated LRC timestamps, applies offset and keeps simultaneous duet lines", () => {
    expect(
      parseLrc(
        "[ar:artist]\n[offset:-50]\n[00:01.2][01:01.234]潮来\n[00:01.200]月落\n[bad]ignored",
      ),
    ).toEqual([
      { startMs: 1150, text: "潮来\n月落" },
      { startMs: 61184, text: "潮来" },
    ]);
  });

  it("parses absolute YRC words and preserves parenthesized sung text", () => {
    const text =
      '{"t":0,"c":[{"tx":"metadata"}]}\n[1000,2300](1000,500,0)听(1500,500,0)潮 (2000,1300,0)(echo)';
    const lines = parseYrc(text);
    expect(lines[0]).toMatchObject({
      startMs: 1000,
      endMs: 3300,
      text: "听潮 (echo)",
      words: [
        { startMs: 1000, durationMs: 500, text: "听" },
        { startMs: 1500, durationMs: 500, text: "潮 " },
        { startMs: 2000, durationMs: 1300, text: "(echo)" },
      ],
    });
    expect(parseYrc(text)[0].id).toBe(lines[0].id);
  });

  it("prefers YRC, aligns translation and romanization, and falls back to LRC", () => {
    const result = parseLyrics(
      raw({
        yrc: "[1000,1000](1000,500,0)潮(1500,500,0)来\n[3000,1000](3000,1000,0)夜航",
        lrc: "[00:01.00]old line",
        translation: "[00:01.100]The tide arrives\n[00:03.000]Sailing at night",
        romanization: "[00:01.000]chao lai",
      }),
    );
    expect(result.hasWordTiming).toBe(true);
    expect(result.lines[0]).toMatchObject({
      text: "潮来",
      translation: "The tide arrives",
      romanization: "chao lai",
    });
    expect(result.lines[1].romanization).toBeUndefined();
    const fallback = parseLyrics(
      raw({ yrc: "invalid", lrc: "[00:02.00]one\n[00:05.00]two" }),
      10_000,
    );
    expect(fallback.hasWordTiming).toBe(false);
    expect(fallback.lines.map((line) => [line.startMs, line.endMs])).toEqual([
      [2000, 5000],
      [5000, 10000],
    ]);
  });

  it("handles missing and instrumental lyrics without fabricating lines", () => {
    expect(parseLyrics(raw({}))).toEqual({
      lines: [],
      instrumental: false,
      hasWordTiming: false,
    });
    expect(
      parseLyrics(raw({ instrumental: true, lrc: "[00:01.00]纯音乐" })).lines,
    ).toEqual([]);
  });

  it("binary-searches boundaries and computes zero-duration word highlights", () => {
    const lyrics = parseLyrics(
      raw({
        yrc: "[1000,1000](1000,500,0)潮(1500,0,0)声\n[3000,1000](3000,1000,0)远",
      }),
    );
    expect(findLyricLineIndex(lyrics.lines, 999)).toBe(-1);
    expect(findLyricLineIndex(lyrics.lines, 1000)).toBe(0);
    expect(findLyricLineIndex(lyrics.lines, 3000)).toBe(1);
    expect(findLyricLineIndex(lyrics.lines, 900, 100)).toBe(0);
    expect(findLyricWordIndex(lyrics.lines[0], 1499)).toBe(0);
    expect(findLyricWordIndex(lyrics.lines[0], 1500)).toBe(1);
    expect(lyricWordProgress(lyrics.lines[0].words[0], 1250)).toBe(0.5);
    expect(lyricWordProgress(lyrics.lines[0].words[1], 1499)).toBe(0);
    expect(lyricWordProgress(lyrics.lines[0].words[1], 1500)).toBe(1);
  });
});
