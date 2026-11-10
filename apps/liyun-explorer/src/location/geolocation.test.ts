import { afterEach, describe, expect, it, vi } from 'vitest';
import { campusMap } from './campus';
import { CampusLocationSession, mapPosition } from './geolocation';

const gps = campusMap.uvToGeo(.34, .49);
const position = (timestamp = Date.now(), accuracy = 5): GeolocationPosition => ({
  timestamp, coords: { latitude:gps.latitude, longitude:gps.longitude, accuracy,
    altitude:null, altitudeAccuracy:null, heading:null, speed:null, toJSON:()=>({}) }, toJSON:()=>({}),
});
function harness(now?: () => number) {
  const callbacks: { success: PositionCallback; error: PositionErrorCallback | null | undefined }[] = [];
  const clearWatch = vi.fn();
  const watchPosition = vi.fn((success: PositionCallback, error?: PositionErrorCallback | null) => {
    callbacks.push({ success, error }); return callbacks.length - 1;
  });
  const update = vi.fn();
  const session = new CampusLocationSession({watchPosition,clearWatch},update,true,now);
  return {session,callbacks,clearWatch,watchPosition,update};
}
const error = (code: number) => ({code,message:'provider error',PERMISSION_DENIED:1,POSITION_UNAVAILABLE:2,TIMEOUT:3}) as GeolocationPositionError;
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('real location lifecycle', () => {
  it('requests no GPS before an explicit start; uses high accuracy WGS84 with no cached fix', () => {
    const h = harness(); expect(h.watchPosition).not.toHaveBeenCalled();
    h.session.start();
    expect(h.session.state.reading).toBeNull();
    expect(h.watchPosition.mock.calls[0]).toHaveLength(3);
    h.callbacks[0].success(position());
    expect(h.session.state.status).toBe('tracking');
    expect(h.session.state.reading?.uv.u).toBeCloseTo(.34,7);
    h.session.dispose();
  });
  it('surfaces permission denial and can explicitly retry', () => {
    const h=harness();h.session.start();h.callbacks[0].error?.(error(1));
    expect(h.session.state.status).toBe('denied');expect(h.clearWatch).toHaveBeenCalledWith(0);
    h.session.start();h.callbacks[1].success(position());expect(h.session.state.status).toBe('tracking');h.session.dispose();
  });
  it.each([2,3])('reports provider error %s and recovers on a new fix', code => {
    const h=harness();h.session.start();h.callbacks[0].error?.(error(code));
    expect(h.session.state.status).toBe('error');expect(h.session.state.reading).toBeNull();
    h.callbacks[0].success(position());expect(h.session.state.status).toBe('tracking');h.session.dispose();
  });
  it('invalidates old fixes after 15 seconds without inventing movement', () => {
    vi.useFakeTimers({toFake:['Date','performance','setInterval','clearInterval']});
    const h=harness();h.session.start();h.callbacks[0].success(position());
    const before=h.session.state.reading;vi.advanceTimersByTime(16_000);
    expect(h.session.state.status).toBe('stale');expect(h.session.state.reading).toBe(before);
    h.session.dispose();expect(vi.getTimerCount()).toBe(0);
  });
  it.each([0,10_000,40_000,-1,NaN,Infinity,Date.UTC(2000,0,1),Date.UTC(2100,0,1)])('accepts valid coordinates independently of device timestamp %s', timestamp => {
    const reading=mapPosition(position(timestamp),1234);
    expect(reading.receivedAt).toBe(1234);
    expect(reading.uv.u).toBeCloseTo(.34,7);
  });
  it('never reads the provider timestamp, including for callback ordering', () => {
    let now=100;
    const h=harness(()=>now), fix=position();
    Object.defineProperty(fix,'timestamp',{get:()=>{throw new Error('provider timestamp must not be read');}});
    h.session.start();h.callbacks[0].success(fix);
    expect(h.session.state.status).toBe('tracking');expect(h.session.state.reading?.receivedAt).toBe(100);
    now=200;h.callbacks[0].success(fix);
    expect(h.session.state.status).toBe('tracking');expect(h.session.state.reading?.receivedAt).toBe(200);
    h.session.dispose();
  });
  it('still rejects invalid coordinates, accuracy and local receipt times', () => {
    for(const accuracy of [0,-1,NaN,Infinity]) expect(()=>mapPosition(position(10_000,accuracy),100)).toThrow('无效');
    for(const coords of [{latitude:NaN},{latitude:90},{longitude:Infinity},{longitude:181}]) {
      const fix=position(10_000);Object.assign(fix.coords,coords);
      expect(()=>mapPosition(fix,100)).toThrow('无效');
    }
    for(const receivedAt of [-1,NaN,Infinity]) expect(()=>mapPosition(position(10_000),receivedAt)).toThrow('无效');
  });
  it('refreshes on every callback even when the device timestamp stays fixed, then expires after updates stop', () => {
    vi.useFakeTimers({toFake:['Date','performance','setInterval','clearInterval']});
    const h=harness();h.session.start();h.callbacks[0].success(position(10_000));
    expect(h.session.state.status).toBe('tracking');
    vi.advanceTimersByTime(14_000);h.callbacks[0].success(position(10_000));
    expect(h.session.state.reading?.receivedAt).toBe(14_000);
    vi.advanceTimersByTime(14_000);expect(h.session.state.status).toBe('tracking');
    vi.advanceTimersByTime(2000);expect(h.session.state.status).toBe('stale');
    h.callbacks[0].success(position(40_000));expect(h.session.state.status).toBe('tracking');
    h.session.dispose();expect(vi.getTimerCount()).toBe(0);
  });
  it('uses callback arrival order when device timestamps jump or run backwards', () => {
    let now=100;
    const h=harness(()=>now);h.session.start();
    for(const timestamp of [Date.now(),40_000,10_000,0]) {
      now+=100;h.callbacks[0].success(position(timestamp));
      expect(h.session.state.status).toBe('tracking');expect(h.session.state.reading?.receivedAt).toBe(now);
    }
    h.session.dispose();
  });
  it('does not expire fresh callbacks when the system wall clock changes', () => {
    vi.useFakeTimers({toFake:['Date','performance','setInterval','clearInterval']});
    const h=harness();h.session.start();h.callbacks[0].success(position(10_000));
    vi.setSystemTime(new Date('2100-01-01T00:00:00Z'));
    vi.advanceTimersByTime(14_000);expect(h.session.state.status).toBe('tracking');
    vi.setSystemTime(new Date('2000-01-01T00:00:00Z'));
    vi.advanceTimersByTime(2000);expect(h.session.state.status).toBe('stale');
    h.session.dispose();
  });
  it('keeps poor accuracy visible as a warning, not a precise fix', () => {
    const h=harness();h.session.start();h.callbacks[0].success(position(Date.now(),150));
    expect(h.session.state.message).toContain('精度较低');expect(h.session.state.reading?.accuracy).toBe(150);h.session.dispose();
  });
  it('cleans watch id zero on pause, rejects late callbacks, and does not auto-resume', () => {
    const h=harness();h.session.start();h.session.stop(true);
    expect(h.clearWatch).toHaveBeenCalledWith(0);h.callbacks[0].success(position());
    expect(h.session.state.status).toBe('paused');expect(h.session.state.reading).toBeNull();
    expect(h.watchPosition).toHaveBeenCalledTimes(1);h.session.dispose();
  });
  it('cleans the previous watch on retry and ignores its success/error callbacks', () => {
    const h=harness();h.session.start();h.session.start();
    h.callbacks[0].success(position());h.callbacks[0].error?.(error(1));
    expect(h.session.state.status).toBe('locating');h.callbacks[1].success(position());
    expect(h.session.state.status).toBe('tracking');h.session.dispose();expect(h.clearWatch).toHaveBeenCalledWith(1);
  });
  it('provides clear errors for insecure or unsupported browsers', () => {
    const h=harness();const update=vi.fn();
    const insecure=new CampusLocationSession({watchPosition:h.watchPosition,clearWatch:h.clearWatch},update,false);insecure.start();
    expect(insecure.state.message).toContain('HTTPS');expect(h.watchPosition).not.toHaveBeenCalled();
    const missing=new CampusLocationSession(undefined,update);missing.start();expect(missing.state.message).toContain('不支持');
  });
});
