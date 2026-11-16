import { describe, expect, it } from "vitest";
import type { PlaybackState } from "../domain";
import { connectLyricClock, type FrameScheduler } from "./lyricClock";

function fixture() {
  let now = 0, id = 0;
  let state = {positionMs:1000,durationMs:20000,status:"playing"} as PlaybackState;
  const callbacks = new Map<number,(time:number)=>void>(), listeners = new Set<()=>void>();
  const writes:number[]=[];
  const scheduler:FrameScheduler = {now:()=>now,request:(fn)=>{callbacks.set(++id,fn);return id;},cancel:(id)=>{callbacks.delete(id);}};
  const runtime = {getSnapshot:()=>state,subscribe:(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};}};
  return {
    callbacks,listeners,writes,
    connect:(offset=0)=>connectLyricClock(runtime,{set:(value)=>writes.push(value)},offset,scheduler),
    advance:(time:number)=>{now=time;const work=[...callbacks.values()];callbacks.clear();work.forEach(fn=>fn(time));},
    update:(patch:Partial<PlaybackState>)=>{state={...state,...patch};listeners.forEach(fn=>fn());},
  };
}
describe("lyric clock lifecycle", () => {
  it("interpolates, applies offset, clamps stalled anchors and bounds duration", () => {
    const f=fixture(), stop=f.connect(250);
    expect(f.writes.at(-1)).toBe(.75);
    f.advance(200);expect(f.writes.at(-1)).toBe(.95);
    f.advance(900);expect(f.writes.at(-1)).toBe(1.2);
    f.update({positionMs:19900});f.advance(1300);expect(f.writes.at(-1)).toBe(19.75);
    stop();
  });
  it("stops RAF on pause/buffering and immediately follows backward seeks", () => {
    const f=fixture(), stop=f.connect();
    expect(f.callbacks.size).toBe(1);
    f.update({status:"paused",positionMs:8000});expect(f.callbacks.size).toBe(0);
    f.update({positionMs:2000});expect(f.writes.at(-1)).toBe(2);
    f.update({status:"playing"});expect(f.callbacks.size).toBe(1);
    f.advance(100);expect(f.writes.at(-1)).toBe(2.1);
    f.update({status:"loading"});expect(f.callbacks.size).toBe(0);
    stop();
  });
  it("unsubscribes and cancels every owned frame on hidden/unmount, without changing audio", () => {
    const f=fixture(), stop=f.connect();
    const pending=[...f.callbacks.values()];
    stop();expect(f.callbacks.size).toBe(0);expect(f.listeners.size).toBe(0);
    const count=f.writes.length;
    pending.forEach(fn=>fn(2000));f.update({positionMs:8000});
    expect(f.writes.length).toBe(count);
    const stopAgain=f.connect();expect(f.writes.at(-1)).toBe(8);
    expect(f.callbacks.size).toBe(1);stopAgain();
  });
});
