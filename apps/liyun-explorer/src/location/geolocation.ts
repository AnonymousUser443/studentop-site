import { accuracyRadii, campusMap, GOOD_ACCURACY_M, MAX_LOCATION_AGE_MS } from './campus';
import type { UV } from '../types';
import type { MapSupport } from './vendor/coordinates.mjs';

export type CampusReading = {
  uv: UV; latitude: number; longitude: number; accuracy: number; timestamp: number;
  insideImage: boolean; support: MapSupport; radius: { x: number; y: number };
};
export type LocationStatus = 'idle' | 'locating' | 'tracking' | 'stale' | 'denied' | 'error' | 'paused' | 'stopped';
export type LocationState = { status: LocationStatus; running: boolean; reading: CampusReading | null; message: string };
export const initialLocationState = (): LocationState => ({ status: 'idle', running: false, reading: null, message: '开启定位，在校园地图上查看实际位置' });

export function mapPosition(position: GeolocationPosition, now = Date.now()): CampusReading {
  const { latitude, longitude, accuracy } = position.coords;
  if (![latitude, longitude, accuracy, position.timestamp].every(Number.isFinite) || accuracy <= 0 || Math.abs(latitude) > 85 || Math.abs(longitude) > 180) {
    throw new Error('设备返回的定位数据无效，请重试');
  }
  if (now - position.timestamp > MAX_LOCATION_AGE_MS || position.timestamp > now + 5000) throw new Error('定位数据已过期，正在等待新的位置');
  const point = campusMap.gpsToMap(latitude, longitude);
  const uv = { u: point.u, v: point.v };
  return { uv, latitude, longitude, accuracy, timestamp: position.timestamp,
    insideImage: point.inside_image, support: point.support,
    radius: point.inside_image ? accuracyRadii(uv, latitude, longitude, accuracy) : { x: 0, y: 0 } };
}

export function readingMessage(reading: CampusReading) {
  const accuracy = `设备报告精度约 ±${Math.ceil(reading.accuracy)} 米`;
  if (!reading.insideImage) return `当前位置在地图画布之外；${accuracy}`;
  const quality = reading.accuracy > GOOD_ACCURACY_M ? '精度较低，请到室外开阔处等待' : '位置持续更新';
  const coverage = reading.support.mode === 'calibrated' ? '' : '；此处使用过渡或外推映射，尚未经独立实测';
  return `${quality}；${accuracy}${coverage}`;
}

type GeoProvider = Pick<Geolocation, 'watchPosition' | 'clearWatch'>;
/** Owns one watch, rejects late callbacks, never saves or uploads live GPS. */
export class CampusLocationSession {
  state = initialLocationState();
  private watch: number | null = null;
  private timer: ReturnType<typeof setInterval> | undefined;
  private generation = 0;
  constructor(private geo: GeoProvider | undefined, private update: (state: LocationState) => void,
    private secure = true, private now = () => Date.now()) {}
  private emit(state: LocationState) { this.state = state; this.update(state); }
  private clear() {
    ++this.generation;
    if (this.watch !== null) this.geo?.clearWatch(this.watch);
    this.watch = null;
    clearInterval(this.timer); this.timer = undefined;
  }
  start() {
    this.clear();
    if (!this.secure) { this.emit({ status: 'error', running: false, reading: null, message: '手机定位需要 HTTPS 链接，请通过安全链接打开' }); return; }
    if (!this.geo) { this.emit({ status: 'error', running: false, reading: null, message: '当前浏览器不支持定位，请使用系统浏览器' }); return; }
    const generation = this.generation;
    this.emit({ status: 'locating', running: true, reading: null, message: '正在获取实际位置，请允许定位访问…' });
    try {
      const id = this.geo.watchPosition(position => {
        if (generation !== this.generation) return;
        if (this.state.reading && Number.isFinite(position.timestamp) && position.timestamp < this.state.reading.timestamp) return;
        try {
          const reading = mapPosition(position, this.now());
          this.emit({ status: 'tracking', running: true, reading, message: readingMessage(reading) });
        } catch (error) {
          this.emit({ status: 'error', running: true, reading: null, message: error instanceof Error ? error.message : '位置映射失败，请重新定位' });
        }
      }, error => {
        if (generation !== this.generation) return;
        if (error.code === 1) {
          this.clear(); this.emit({ status: 'denied', running: false, reading: null, message: '定位权限被拒绝，请在浏览器的网站设置中允许定位后重试' });
        } else this.emit({ status: 'error', running: true, reading: null,
          message: error.code === 3 ? '定位超时，请到室外开阔处重新定位' : '暂时无法获取位置，请检查系统定位服务与网络后重试' });
      }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 });
      if (generation !== this.generation) { this.geo.clearWatch(id); return; }
      this.watch = id;
      this.timer = setInterval(() => {
        const reading = this.state.reading;
        if (reading && this.now() - reading.timestamp > MAX_LOCATION_AGE_MS && this.state.status !== 'stale') {
          this.emit({ ...this.state, status: 'stale', message: '位置超过15秒未更新，标记仅代表上次位置，请重新定位' });
        }
      }, 1000);
    } catch {
      this.clear(); this.emit({ status: 'error', running: false, reading: null, message: '无法启动定位，请检查浏览器权限后重试' });
    }
  }
  stop(paused = false) {
    this.clear(); this.emit({ status: paused ? 'paused' : 'stopped', running: false, reading: null,
      message: paused ? '页面已切到后台，定位已暂停；返回后点击继续定位' : '定位已停止，点击定位到我可重新开启' });
  }
  dispose() { this.clear(); }
}
