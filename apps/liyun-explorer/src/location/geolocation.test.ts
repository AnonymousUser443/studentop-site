import { afterEach, describe, expect, it, vi } from 'vitest';
import { campusMap } from './campus';
import { CampusLocationSession, mapPosition } from './geolocation';

const gps = campusMap.uvToGeo(.34, .49);
const position = (timestamp = Date.now(), accuracy = 5): GeolocationPosition => ({
  timestamp, coords: { latitude:gps.latitude, longitude:gps.longitude, accuracy,
    altitude:null, altitudeAccuracy:null, heading:null, speed:null, toJSON:()=>({}) }, toJSON:()=>({}),
});
function harness() {
  const callbacks: { success: PositionCallback; error: PositionErrorCallback | null | undefined }[] = [];
  const clearWatch = vi.fn();
  const watchPosition = vi.fn((success: PositionCallback, error?: PositionErrorCallback | null) => {
    callbacks.push({ success, error }); return callbacks.length - 1;
  });
  const update = vi.fn();
  const session = new CampusLocationSession({watchPosition,clearWatch},update);
  return {session,callbacks,clearWatch,watchPosition,update};
}
const error = (code: number) => ({code,message:'provider error',PERMISSION_DENIED:1,POSITION_UNAVAILABLE:2,TIMEOUT:3}) as GeolocationPositionError;
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

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
    vi.useFakeTimers();const h=harness();h.session.start();h.callbacks[0].success(position());
    const before=h.session.state.reading;vi.advanceTimersByTime(16_000);
    expect(h.session.state.status).toBe('stale');expect(h.session.state.reading).toBe(before);
    h.session.dispose();expect(vi.getTimerCount()).toBe(0);
  });
  it('rejects invalid, future and stale device data', () => {
    const now=Date.now();expect(()=>mapPosition(position(now-16_000),now)).toThrow('过期');
    expect(()=>mapPosition(position(now+6000),now)).toThrow('过期');
    expect(()=>mapPosition(position(now,NaN),now)).toThrow('无效');
  });
  it('ignores out-of-order samples without replacing a newer fix', () => {
    const h=harness();h.session.start();const now=Date.now();h.callbacks[0].success(position(now));
    h.callbacks[0].success(position(now-1000));expect(h.session.state.reading?.timestamp).toBe(now);h.session.dispose();
  });
  it('ignores an expired out-of-order sample without clearing the current valid location', () => {
    const h=harness();h.session.start();const now=Date.now();h.callbacks[0].success(position(now));
    h.callbacks[0].success(position(now-20_000));expect(h.session.state.status).toBe('tracking');
    expect(h.session.state.reading?.timestamp).toBe(now);h.session.dispose();
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
