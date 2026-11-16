import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import type {MusicHost, MusicRuntime, PlaybackState} from "../domain";
import {parseYrc} from "../lyrics";
import {clampDesktopLyricsPosition, createDesktopWordPainter, defaultDesktopLyricsPosition} from "./DesktopLyrics";
import {MusicSurface} from "./surfaces";

describe("desktop lyric placement and word painting", () => {
  it("keeps drag positions inside narrow viewports and above the real taskbar", () => {
    expect(clampDesktopLyricsPosition({x: 900, y: 900}, {width: 320, height: 568, bottom: 52}, {width: 296, height: 154})).toEqual({x: 12, y: 350});
    expect(clampDesktopLyricsPosition({x: -80, y: -100}, {width: 1366, height: 768, bottom: 56}, {width: 680, height: 146})).toEqual({x: 12, y: 12});
    const repaired = clampDesktopLyricsPosition({x: NaN, y: Infinity}, {width: 1280, height: 800, bottom: 56}, {width: 680, height: 146});
    expect(repaired).toEqual({x: 294, y: 586});
  });

  it("leaves the mini player's row clear at the default and Home positions", () => {
    for (const viewport of [{width: 1366, height: 768, bottom: 56}, {width: 390, height: 844, bottom: 52}]) {
      const size = {width: Math.min(680, viewport.width - 24), height: 146};
      const position = defaultDesktopLyricsPosition(viewport, size);
      expect(position.x).toBeGreaterThanOrEqual(12);
      expect(position.y + size.height).toBeLessThan(viewport.height - 224);
    }
  });

  it("updates only the current word between boundaries and resets correctly after a backward seek", () => {
    const line = parseYrc("[1000,3000](1000,1000,0)潮(2000,1000,0)声(4000,0,0)起")[0];
    const values = ["", "", ""], writes: Array<[number, string]> = [];
    const targets = values.map((_, index) => ({style: {setProperty: (_name: string, value: string) => {values[index] = value; writes.push([index, value]);}}}));
    const paint = createDesktopWordPainter();
    paint(line, 1500, targets);
    expect(values).toEqual(["50.0%", "0%", "0%"]);
    writes.length = 0;
    paint(line, 1600, targets);
    expect(writes).toEqual([[0, "60.0%"]]);
    paint(line, 2200, targets);
    expect(values).toEqual(["100%", "20.0%", "0%"]);
    paint(line, 4000, targets);
    expect(values).toEqual(["100%", "100%", "100.0%"]);
    paint(line, 1800, targets);
    expect(values).toEqual(["80.0%", "0%", "0%"]);
    writes.length = 0;
    paint(line, 1800, targets);
    expect(writes).toEqual([]);
  });

  it("clears the previous line's progress when a new line is rendered", () => {
    const lines = parseYrc("[1000,1000](1000,1000,0)潮来\n[3000,1000](3000,1000,0)月落");
    let value = "";
    const targets = [{style: {setProperty: (_name: string, next: string) => {value = next;}}}], paint = createDesktopWordPainter();
    paint(lines[0], 2000, targets);expect(value).toBe("100.0%");
    paint(lines[1], 3000, targets);expect(value).toBe("0.0%");
  });
});

describe("desktop lyric surface visibility", () => {
  beforeEach(() => {vi.stubGlobal("document", {hidden: false});});
  afterEach(() => {vi.unstubAllGlobals();});
  function render({locked = false, enabled = true, visible = true} = {}) {
    const state: PlaybackState = {queue: [], currentIndex: 0, currentTrack: {id: "1", title: "潮声", artists: [{id: "2", name: "听潮乐团"}], album: {id: "3", title: "夜航", coverUrl: ""}, durationMs: 120000, coverUrl: "", availability: "full"}, status: "paused", positionMs: 0, durationMs: 120000, volume: 0.7, muted: false, mode: "sequence", quality: "exhigh", source: null, error: null, lyrics: {lines: [], instrumental: true, hasWordTiming: false}};
    const subscribe = vi.fn(() => () => {});
    const runtime = {getSnapshot: () => state, subscribe} as unknown as MusicRuntime;
    const host: MusicHost = {theme: () => "dark", themeMode: () => "dark", setThemeMode() {}, isLocked: () => locked, reducedMotion: () => true, desktopLyricsEnabled: () => enabled, setDesktopLyricsEnabled() {}, openMain() {}, setTitle() {}, notify() {}, onStateChange: () => () => {}};
    return {html: renderToStaticMarkup(createElement(MusicSurface, {runtime, host, type: "lyrics", visible})), subscribe};
  }

  it("renders the optional lyric region only while enabled and unlocked", () => {
    expect(render().html).toContain('aria-label="听潮桌面歌词"');
    expect(render({enabled: false}).html).not.toContain('aria-label="听潮桌面歌词"');
    expect(render({locked: true}).html).not.toContain('aria-label="听潮桌面歌词"');
  });

  it("marks an inactive surface hidden and exposes keyboard movement, restore and close controls", () => {
    const {html, subscribe} = render({visible: false});
    expect(html).toContain('hidden=""');
    expect(html).toContain("方向键微调");
    expect(html).toContain("从桌面歌词恢复听潮主窗口");
    expect(html).toContain("关闭桌面歌词，音乐继续");
    expect(subscribe).not.toHaveBeenCalled();
  });
});
