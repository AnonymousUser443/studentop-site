import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeviceHeadingSession, HEADING_MAX_AGE_MS, headingDifference, readDeviceHeading } from './deviceHeading';
import { campusMap, headingOnMap } from './campus';

class Browser extends EventTarget {
  isSecureContext = true;
  document = {hidden:false};
  orientation = 0;
  DeviceOrientationEvent: {requestPermission?: (absolute?: boolean) => Promise<string>} | undefined = {};
}
const send = (browser: Browser, sample: Record<string,unknown>) => browser.dispatchEvent(Object.assign(new Event('deviceorientation'),sample));
const sample = {webkitCompassHeading:90,webkitCompassAccuracy:5,beta:0,gamma:0};
afterEach(() => {vi.clearAllTimers();vi.useRealTimers();});

describe('compass bearing and calibrated map direction', () => {
  it.each([0,90,180,270])('accounts for display rotation %s on Safari and absolute Android', angle => {
    expect(readDeviceHeading(sample,angle).bearing).toBe((90+angle)%360);
    expect(readDeviceHeading({absolute:true,alpha:270,beta:0,gamma:0},angle).bearing).toBe((90+angle)%360);
  });
  it('rejects relative alpha, bad compass accuracy and a vertical display top', () => {
    expect(readDeviceHeading({alpha:20,absolute:false}).bearing).toBeNull();
    expect(readDeviceHeading({...sample,webkitCompassAccuracy:65}).issue).toBe('calibrating');
    expect(readDeviceHeading({...sample,webkitCompassHeading:-1}).bearing).toBeNull();
    expect(readDeviceHeading({absolute:true,alpha:0,beta:90,gamma:0},0).issue).toBe('tilt');
  });
  it('does not invent a bearing from absolute alpha when the display pose is incomplete', () => {
    expect(readDeviceHeading({absolute:true,alpha:0,beta:null,gamma:null} as never).bearing).toBeNull();
    expect(readDeviceHeading({absolute:true,alpha:0,beta:NaN,gamma:20} as never).bearing).toBeNull();
    expect(readDeviceHeading({absolute:true,alpha:0,beta:null,gamma:null} as never).issue).toBe('tilt');
    // Safari's own compass heading stays usable without a pose sample.
    expect(readDeviceHeading({webkitCompassHeading:90,webkitCompassAccuracy:5} as never).bearing).toBe(90);
  });
  it('projects a tilted landscape display instead of treating alpha as a flat compass', () => {
    // At beta=30/gamma=30 the display's right edge projects east+north,
    // so landscape top is about 73.90 degrees, rather than a flat 90.
    expect(readDeviceHeading({absolute:true,alpha:0,beta:30,gamma:30},90).bearing).toBeCloseTo(73.89789,4);
  });
  it('projects compass north/east/south/west onto the original model with no image changes', () => {
    const gps=campusMap.uvToGeo(.34,.49);
    const angles=[0,90,180,270].map(bearing=>headingOnMap(gps,bearing)!);
    for (const [i,angle] of angles.entries()) expect(Math.abs(headingDifference(angle,i*90))).toBeLessThan(15);
    expect(Math.abs(headingDifference(angles[2],angles[0]))).toBeGreaterThan(179);
    expect(headingOnMap(gps,NaN)).toBeNull();
  });
});

describe('one-click heading permission and lifetime', () => {
  it('does not request until start and invokes permission synchronously, only once when already active', async () => {
    const browser=new Browser(),permission=vi.fn(async ()=>'granted');browser.DeviceOrientationEvent={requestPermission:permission};
    const tracker=new DeviceHeadingSession(browser,vi.fn());expect(permission).not.toHaveBeenCalled();
    const pending=tracker.start();expect(permission).toHaveBeenCalledExactlyOnceWith(true);
    await tracker.start();await pending;send(browser,sample);expect(tracker.state.status).toBe('active');
    await tracker.start();expect(permission).toHaveBeenCalledTimes(1);tracker.dispose();
  });
  it('reuses a granted permission when explicitly resumed after stop/background', async () => {
    const browser=new Browser(),permission=vi.fn(async ()=>'granted');browser.DeviceOrientationEvent={requestPermission:permission};
    const tracker=new DeviceHeadingSession(browser,vi.fn());await tracker.start();tracker.stop(true);
    expect(tracker.state.status).toBe('paused');send(browser,sample);expect(tracker.state.bearing).toBeNull();
    await tracker.start();send(browser,sample);expect(tracker.state.status).toBe('active');expect(permission).toHaveBeenCalledTimes(1);tracker.dispose();
  });
  it('keeps denied state separate and can retry on a later explicit click', async () => {
    const browser=new Browser(),permission=vi.fn().mockResolvedValueOnce('denied').mockResolvedValue('granted');
    browser.DeviceOrientationEvent={requestPermission:permission};const tracker=new DeviceHeadingSession(browser,vi.fn());
    await tracker.start();expect(tracker.state.status).toBe('denied');send(browser,sample);expect(tracker.state.bearing).toBeNull();
    await tracker.start();send(browser,sample);expect(tracker.state.status).toBe('active');tracker.dispose();
  });
  it('ignores permission resolution after a stop', async () => {
    const browser=new Browser();let finish!:(value:string)=>void;
    browser.DeviceOrientationEvent={requestPermission:()=>new Promise(resolve=>{finish=resolve;})};
    const tracker=new DeviceHeadingSession(browser,vi.fn());const pending=tracker.start();tracker.stop();finish('granted');await pending;
    send(browser,sample);expect(tracker.state.status).toBe('off');expect(tracker.state.bearing).toBeNull();tracker.dispose();
  });
  it('smooths across 359/0 using the shorter direction', async () => {
    vi.useFakeTimers();const browser=new Browser(),tracker=new DeviceHeadingSession(browser,vi.fn());await tracker.start();
    send(browser,{...sample,webkitCompassHeading:359});vi.advanceTimersByTime(100);send(browser,{...sample,webkitCompassHeading:1});
    expect(Math.abs(headingDifference(tracker.state.bearing!,0))).toBeLessThan(1);tracker.dispose();
  });
  it('hides stale readings; screen rotation alone cannot refresh them', async () => {
    vi.useFakeTimers();const browser=new Browser(),tracker=new DeviceHeadingSession(browser,vi.fn());await tracker.start();send(browser,sample);
    vi.advanceTimersByTime(HEADING_MAX_AGE_MS+501);expect(tracker.state.status).toBe('stale');expect(tracker.state.bearing).toBeNull();
    browser.orientation=90;browser.dispatchEvent(new Event('orientationchange'));expect(tracker.state.bearing).toBeNull();tracker.dispose();
  });
  it('does not allow relative alpha events to replace an absolute bearing', async () => {
    const browser=new Browser(),tracker=new DeviceHeadingSession(browser,vi.fn());await tracker.start();send(browser,sample);
    send(browser,{alpha:200,absolute:false});expect(tracker.state.bearing).toBe(90);tracker.dispose();
  });
  it('immediately hides a bad compass fix and cannot restore it from a screen change', async () => {
    const browser=new Browser(),tracker=new DeviceHeadingSession(browser,vi.fn());await tracker.start();send(browser,sample);
    send(browser,{...sample,webkitCompassAccuracy:100});expect(tracker.state.status).toBe('calibrating');
    browser.dispatchEvent(new Event('orientationchange'));expect(tracker.state.bearing).toBeNull();tracker.dispose();
  });
  it('handles orientation changes and removes listeners and monitor on dispose', async () => {
    vi.useFakeTimers();const browser=new Browser(),update=vi.fn(),tracker=new DeviceHeadingSession(browser,update);await tracker.start();send(browser,sample);
    browser.orientation=90;browser.dispatchEvent(new Event('orientationchange'));expect(tracker.state.bearing).toBe(180);
    tracker.dispose();const count=update.mock.calls.length;send(browser,sample);vi.advanceTimersByTime(15000);
    expect(update).toHaveBeenCalledTimes(count);expect(vi.getTimerCount()).toBe(0);
  });
  it('reports insecure, unsupported and relative-only devices without inventing north', async () => {
    vi.useFakeTimers();const browser=new Browser(),tracker=new DeviceHeadingSession(browser,vi.fn());
    browser.isSecureContext=false;await tracker.start();expect(tracker.state.status).toBe('insecure');
    browser.isSecureContext=true;browser.DeviceOrientationEvent=undefined;await tracker.start();expect(tracker.state.status).toBe('unsupported');
    browser.DeviceOrientationEvent={};await tracker.start();send(browser,{alpha:25,absolute:false});vi.advanceTimersByTime(11000);
    expect(tracker.state.status).toBe('unavailable');expect(tracker.state.bearing).toBeNull();tracker.dispose();
  });
});
