import type { LyricLine, LyricWord, Lyrics, RawLyrics } from "../domain";

interface TimedText {
  startMs: number;
  text: string;
}

const finite = (value: number, fallback = 0) =>
  Number.isFinite(value) ? value : fallback;
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, finite(value)));

function offsetOf(text: string): number {
  const matches = [...text.matchAll(/\[offset\s*:\s*([+-]?\d+)\]/gi)];
  return matches.length ? finite(Number(matches.at(-1)?.[1])) : 0;
}

function milliseconds(minutes: string, seconds: string, fraction = ""): number {
  return (
    Number(minutes) * 60_000 +
    Number(seconds) * 1_000 +
    Number((fraction + "000").slice(0, 3))
  );
}

/** LRC timestamps are expanded before sorting, including repeated-chorus timestamps. */
export function parseLrc(text: string): TimedText[] {
  const offset = offsetOf(text || "");
  const rows: TimedText[] = [];
  for (const sourceLine of (text || "").split(/\r?\n/)) {
    const timestamps = [
      ...sourceLine.matchAll(/\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g),
    ];
    if (!timestamps.length) continue;
    const last = timestamps.at(-1)!;
    const lyric = sourceLine.slice((last.index ?? 0) + last[0].length).trim();
    if (!lyric) continue;
    for (const timestamp of timestamps) {
      rows.push({
        startMs: Math.max(
          0,
          milliseconds(timestamp[1], timestamp[2], timestamp[3]) + offset,
        ),
        text: lyric,
      });
    }
  }
  rows.sort((a, b) => a.startMs - b.startMs);
  // Two simultaneous lines (for example a duet) stay one active, readable lyric line.
  const combined: TimedText[] = [];
  for (const row of rows) {
    const previous = combined.at(-1);
    if (previous?.startMs === row.startMs) {
      if (!previous.text.split("\n").includes(row.text))
        previous.text += "\n" + row.text;
    } else combined.push({ ...row });
  }
  return combined;
}

function lineId(startMs: number, text: string, index: number): string {
  let hash = 2166136261;
  for (const character of text) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return "lyric-" + startMs + "-" + (hash >>> 0).toString(36) + "-" + index;
}

/** NetEase YRC uses absolute millisecond line and word timestamps. */
export function parseYrc(text: string): LyricLine[] {
  const offset = offsetOf(text || "");
  const lines: LyricLine[] = [];
  for (const sourceLine of (text || "").split(/\r?\n/)) {
    const lineMatch = sourceLine.match(/^\s*\[(\d+),(\d+)\](.*)$/);
    if (!lineMatch) continue; // Metadata JSON is intentionally not interpreted as markup.
    const startMs = Math.max(0, Number(lineMatch[1]) + offset);
    const lineDuration = Math.max(0, Number(lineMatch[2]));
    const body = lineMatch[3];
    const markers = [...body.matchAll(/\((\d+),(\d+)(?:,[^)]*)?\)/g)];
    const words: LyricWord[] = [];
    markers.forEach((marker, index) => {
      const from = (marker.index ?? 0) + marker[0].length;
      const to =
        index + 1 < markers.length ? markers[index + 1].index! : body.length;
      const wordText = body.slice(from, to);
      if (!wordText) return;
      words.push({
        text: wordText,
        startMs: Math.max(0, Number(marker[1]) + offset),
        durationMs: Math.max(0, Number(marker[2])),
      });
    });
    words.sort((a, b) => a.startMs - b.startMs);
    const lyric = markers.length
      ? words.map((word) => word.text).join("")
      : body.trim();
    if (!lyric.trim()) continue;
    lines.push({
      id: "",
      text: lyric,
      startMs,
      endMs: Math.max(
        startMs + lineDuration,
        ...words.map((word) => word.startMs + word.durationMs),
      ),
      words,
    });
  }
  lines.sort((a, b) => a.startMs - b.startMs);
  return lines.map((line, index) => ({
    ...line,
    id: lineId(line.startMs, line.text, index),
  }));
}

function auxiliaryRows(text: string): TimedText[] {
  const yrc = parseYrc(text);
  return yrc.length
    ? yrc.map(({ startMs, text: lyric }) => ({ startMs, text: lyric }))
    : parseLrc(text);
}

function nearestText(rows: TimedText[], startMs: number): string | undefined {
  let lo = 0,
    hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (rows[mid].startMs < startMs) lo = mid + 1;
    else hi = mid;
  }
  const candidates = [rows[lo], rows[lo - 1]].filter(
    (row): row is TimedText => !!row,
  );
  candidates.sort(
    (a, b) => Math.abs(a.startMs - startMs) - Math.abs(b.startMs - startMs),
  );
  return candidates[0] && Math.abs(candidates[0].startMs - startMs) <= 750
    ? candidates[0].text
    : undefined;
}

/** YRC → LRC → instrumental. No HTML is created from service text. */
export function parseLyrics(raw: RawLyrics, durationMs = 0): Lyrics {
  if (raw.instrumental)
    return { lines: [], instrumental: true, hasWordTiming: false };
  let lines = parseYrc(raw.yrc);
  if (!lines.length) {
    const rows = parseLrc(raw.lrc);
    lines = rows.map((row, index) => ({
      ...row,
      id: lineId(row.startMs, row.text, index),
      endMs:
        rows[index + 1]?.startMs ??
        (durationMs > row.startMs ? durationMs : row.startMs + 6_000),
      words: [],
    }));
  }
  const translations = auxiliaryRows(raw.translation);
  const romanizations = auxiliaryRows(raw.romanization);
  lines = lines.map((line) => ({
    ...line,
    translation: nearestText(translations, line.startMs),
    romanization: nearestText(romanizations, line.startMs),
  }));
  return {
    lines,
    instrumental: false,
    hasWordTiming: lines.some((line) => line.words.length > 0),
  };
}

/** Greatest timestamp not after the playback position; -1 before the first lyric. */
export function findLyricLineIndex(
  lines: readonly LyricLine[],
  positionMs: number,
  offsetMs = 0,
): number {
  const position = finite(positionMs) + finite(offsetMs);
  let lo = 0,
    hi = lines.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (lines[mid].startMs <= position) lo = mid + 1;
    else hi = mid;
  }
  return lo - 1;
}

export function findLyricWordIndex(
  line: LyricLine,
  positionMs: number,
): number {
  let lo = 0,
    hi = line.words.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (line.words[mid].startMs <= positionMs) lo = mid + 1;
    else hi = mid;
  }
  return lo - 1;
}

export function lyricWordProgress(word: LyricWord, positionMs: number): number {
  if (word.durationMs === 0) return positionMs >= word.startMs ? 1 : 0;
  return clamp((positionMs - word.startMs) / word.durationMs, 0, 1);
}
