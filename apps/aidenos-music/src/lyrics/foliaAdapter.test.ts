import { describe, expect, it } from "vitest";
import type { Lyrics } from "../domain";
import { findLyricIndex, makeFoliaTheme, TINGCHAO_SONNET_TUNING, toFoliaLines } from "./foliaAdapter";
import { compileSonnetProgram, findSonnetParagraphIndexAtTime } from "../vendor/folia/components/visualizer/sonnet/sonnetProgram";

const lyrics: Lyrics = {
  instrumental: false, hasWordTiming: true,
  lines: [
    {id:"a",text:"听见潮声",startMs:1000,endMs:4000,translation:"Hear the tide",romanization:"ting jian chao sheng",words:[
      {text:"听见",startMs:1000,durationMs:1200},{text:"潮声",startMs:2200,durationMs:1800},
    ]},
    {id:"b",text:"风向着海",startMs:5500,endMs:8500,words:[]},
    {id:"c",text:"把此刻留下",startMs:10000,endMs:14000,words:[]},
  ],
};
describe("Folia rendering boundary", () => {
  it("preserves genuine word/line timing and translations without mutating API data", () => {
    const before = JSON.stringify(lyrics), result = toFoliaLines(lyrics);
    expect(result[0]).toMatchObject({startTime:1,endTime:4,fullText:"听见潮声",translation:"Hear the tide"});
    expect(result[0].words[1]).toEqual({text:"潮声",startTime:2.2,endTime:4});
    expect(result[0].romanization).toBe("ting jian chao sheng");
    expect(JSON.stringify(lyrics)).toBe(before);
  });
  it("does not synthesize word timing from LRC or empty/instrumental lyrics", () => {
    expect(toFoliaLines({...lyrics,hasWordTiming:false})[0].words).toEqual([]);
    expect(toFoliaLines(null)).toEqual([]);
    expect(toFoliaLines({lines:[],instrumental:true,hasWordTiming:false})).toEqual([]);
  });
  it("sanitizes nonfinite and negative timing at the renderer boundary", () => {
    const bad = {...lyrics,lines:[{...lyrics.lines[0],startMs:NaN,endMs:-50,words:[{text:"潮",startMs:Infinity,durationMs:500}]}]};
    expect(toFoliaLines(bad)[0]).toMatchObject({startTime:0,endTime:0,words:[]});
  });
  it("compiles a deterministic, seekable upstream Sonnet program", () => {
    const lines = toFoliaLines(lyrics);
    const first = compileSonnetProgram(lines,"netease:qa"), second = compileSonnetProgram(lines,"netease:qa");
    expect(first).toEqual(second);
    expect(first.paragraphs.length).toBeGreaterThan(0);
    const atFirst = findSonnetParagraphIndexAtTime(first,2);
    const atLater = findSonnetParagraphIndexAtTime(first,12);
    expect(atFirst).toBeGreaterThanOrEqual(0);
    expect(atLater).toBeGreaterThanOrEqual(atFirst);
    expect(findSonnetParagraphIndexAtTime(first,2)).toBe(atFirst);
    expect(findLyricIndex(lines,0.99)).toBe(-1);
    expect(findLyricIndex(lines,5.5)).toBe(1);
    expect(findLyricIndex(lines,1.01)).toBe(0);
  });
  it("uses host palette values verbatim and avoids competing visual effects", () => {
    for (const palette of [
      {background:"#102630",text:"#f3f0e7",teal:"#64c7b4",gold:"#d5bd86"},
      {background:"#e7eee3",text:"#29483e",teal:"#237e70",gold:"#89682f"},
    ]) {
      const theme = makeFoliaTheme(palette);
      expect([theme.backgroundColor,theme.primaryColor,theme.accentColor,theme.secondaryColor]).toEqual(Object.values(palette));
      expect(theme.animationIntensity).toBe("calm");
      expect(theme.lyricsIcons).toEqual([]);
    }
    expect(TINGCHAO_SONNET_TUNING.postProcessEnabled).toBe(false);
    expect(TINGCHAO_SONNET_TUNING.outerFrameMode).toBe("none");
  });
});
