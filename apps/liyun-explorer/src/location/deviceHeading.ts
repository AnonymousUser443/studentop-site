/** Compass reference only. GPS course/relative alpha cannot replace a compass. */
export const normalizeHeading = (angle: number) => ((angle % 360) + 360) % 360;
export const headingDifference = (target: number, current: number) => normalizeHeading(target - current + 180) - 180;
export const describeHeading = (angle: number) => {
  const directions = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
  const bearing = normalizeHeading(angle);
  return `${directions[Math.round(bearing / 45) % 8]} ${Math.round(bearing) % 360}°`;
};
export const HEADING_MAX_AGE_MS = 3000;
const radians = (angle: number) => angle * Math.PI / 180;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export type OrientationSample = {
  type?: string; absolute?: boolean; alpha?: number | null; beta?: number | null; gamma?: number | null;
  webkitCompassHeading?: number; webkitCompassAccuracy?: number;
};
type BearingResult = { bearing: number | null; issue?: 'relative' | 'calibrating' | 'tilt' };

// Project the upper edge of the *display*, not the AR rear camera, using the
// W3C Z-X'-Y'' matrix. The screen angle also covers both landscape directions.
function projectTop(alpha: number, beta: number, gamma: number, screenAngle: number) {
  const a = radians(alpha), b = radians(beta), g = radians(gamma), s = radians(screenAngle);
  const x = Math.sin(s), y = Math.cos(s);
  const east = (Math.cos(a) * Math.cos(g) - Math.sin(a) * Math.sin(b) * Math.sin(g)) * x - Math.cos(b) * Math.sin(a) * y;
  const north = (Math.sin(a) * Math.cos(g) + Math.cos(a) * Math.sin(b) * Math.sin(g)) * x + Math.cos(a) * Math.cos(b) * y;
  if (Math.hypot(east, north) < .25) return null;
  return normalizeHeading(Math.atan2(east, north) * 180 / Math.PI);
}

export function readDeviceHeading(event: OrientationSample, screenAngle = 0): BearingResult {
  const angle = finite(screenAngle) ? screenAngle : 0;
  const hasPose = finite(event.beta) && finite(event.gamma);
  if (finite(event.webkitCompassHeading)) {
    const accuracy = event.webkitCompassAccuracy;
    if (event.webkitCompassHeading < 0 || (finite(accuracy) && (accuracy < 0 || accuracy > 45))) return { bearing:null, issue:'calibrating' };
    let correction = angle;
    if (hasPose) {
      // Safari's heading already refers to the natural top edge. Rotate that
      // horizontal projection to the actual display top; don't count alpha twice.
      const natural = projectTop(0, event.beta!, event.gamma!, 0);
      const display = projectTop(0, event.beta!, event.gamma!, angle);
      if (natural === null || display === null) return { bearing:null, issue:'tilt' };
      correction = headingDifference(display, natural);
    }
    return { bearing:normalizeHeading(event.webkitCompassHeading + correction) };
  }
  if (!(event.absolute === true || event.type === 'deviceorientationabsolute') || !finite(event.alpha)) return { bearing:null, issue:'relative' };
  const bearing = hasPose ? projectTop(event.alpha, event.beta!, event.gamma!, angle) : normalizeHeading(360 - event.alpha + angle);
  return bearing === null ? { bearing:null, issue:'tilt' } : { bearing };
}

export type HeadingStatus = 'off' | 'requesting' | 'waiting' | 'active' | 'calibrating' | 'tilt' | 'stale' | 'denied' | 'unsupported' | 'unavailable' | 'paused' | 'insecure';
export type HeadingState = { status: HeadingStatus; bearing: number | null };
export const initialHeadingState = (): HeadingState => ({status:'off',bearing:null});
export type HeadingPlatform = Pick<EventTarget, 'addEventListener' | 'removeEventListener'> & {
  isSecureContext: boolean;
  document: { hidden: boolean };
  DeviceOrientationEvent?: { requestPermission?: (absolute?: boolean) => Promise<string> };
  screen?: { orientation?: Pick<ScreenOrientation, 'angle' | 'addEventListener' | 'removeEventListener'> };
  orientation?: number;
};

/** Permission is invoked synchronously from start(), before its first await.
 * No DeviceMotion request, no redundant request on re-centre/resume once granted. */
export class DeviceHeadingSession {
  state = initialHeadingState();
  private listening = false;
  private granted = false;
  private generation = 0;
  private timer: ReturnType<typeof setInterval> | undefined;
  private lastEvent: OrientationSample | null = null;
  private lastValidAt = 0;
  private waitingSince = 0;
  private publishedAt = 0;
  constructor(private browser: HeadingPlatform, private update: (state: HeadingState) => void, private now = () => Date.now()) {}
  private emit(status: HeadingStatus, bearing: number | null = null) {
    if (this.state.status === status && this.state.bearing === bearing) return;
    this.state = {status,bearing};this.update(this.state);
  }
  private screenAngle() {
    const value = this.browser.screen?.orientation?.angle ?? this.browser.orientation ?? 0;
    return finite(value) ? value : 0;
  }
  private read(event: OrientationSample, force = false) {
    if (!this.listening || this.browser.document.hidden) return;
    const result = readDeviceHeading(event, this.screenAngle());
    if (result.bearing === null) {
      // Ignore relative events racing with an absolute stream; never renew age.
      if (result.issue === 'calibrating' || result.issue === 'tilt') { this.lastEvent = null;this.emit(result.issue); }
      return;
    }
    const now = this.now();
    if (!force) { this.lastEvent = event; this.lastValidAt = now; }
    if (!force && this.state.bearing !== null && now - this.publishedAt < 80) return;
    const bearing = this.state.bearing === null || force ? result.bearing
      : normalizeHeading(this.state.bearing + headingDifference(result.bearing, this.state.bearing) * .35);
    this.publishedAt = now;this.emit('active',bearing);
  }
  private onReading: EventListener = event => this.read(event as DeviceOrientationEvent);
  private onScreenChange: EventListener = () => {
    if (this.lastEvent && this.now() - this.lastValidAt <= HEADING_MAX_AGE_MS) this.read(this.lastEvent, true);
  };
  private detach() {
    this.browser.removeEventListener('deviceorientationabsolute', this.onReading);
    this.browser.removeEventListener('deviceorientation', this.onReading);
    this.browser.removeEventListener('orientationchange', this.onScreenChange);
    this.browser.screen?.orientation?.removeEventListener('change', this.onScreenChange);
    clearInterval(this.timer);this.timer = undefined;
    this.listening = false;this.lastEvent = null;
  }
  private attach() {
    this.detach();this.listening = true;this.lastValidAt = 0;this.publishedAt = 0;this.waitingSince = this.now();
    this.emit('waiting');
    this.browser.addEventListener('deviceorientationabsolute',this.onReading);
    this.browser.addEventListener('deviceorientation',this.onReading);
    this.browser.addEventListener('orientationchange',this.onScreenChange);
    this.browser.screen?.orientation?.addEventListener('change',this.onScreenChange);
    this.timer = setInterval(() => {
      const age = this.now() - Math.max(this.lastValidAt,this.waitingSince);
      if (age > HEADING_MAX_AGE_MS && this.state.bearing !== null) this.emit('stale');
      if (age > 10_000 && this.state.bearing === null && this.state.status !== 'tilt' && this.state.status !== 'calibrating') this.emit('unavailable');
    }, 500);
  }
  async start() {
    if (this.state.status === 'requesting' || (this.listening && ['active','waiting'].includes(this.state.status))) return;
    if (!this.browser.isSecureContext) { this.emit('insecure');return; }
    const api = this.browser.DeviceOrientationEvent;
    if (!api) { this.emit('unsupported');return; }
    const generation = ++this.generation;
    this.detach();this.emit('requesting');
    try {
      if (!this.granted && typeof api.requestPermission === 'function') {
        const permission = await api.requestPermission(true);
        if (generation !== this.generation) return;
        if (permission !== 'granted') { this.emit('denied');return; }
        this.granted = true;
      }
      if (generation !== this.generation) return;
      if (this.browser.document.hidden) { this.emit('paused');return; }
      this.attach();
    } catch {
      if (generation === this.generation) { this.detach();this.emit('denied'); }
    }
  }
  stop(paused = false) {
    ++this.generation;this.detach();
    if (paused && this.state.status === 'off') return;
    this.emit(paused ? 'paused' : 'off');
  }
  dispose() { ++this.generation;this.detach(); }
}
