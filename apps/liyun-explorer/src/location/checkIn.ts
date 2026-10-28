import { campusLandmarks, distanceMeters, GOOD_ACCURACY_M, MAX_LOCATION_AGE_MS } from './campus';
import type { LocationState } from './geolocation';

export type CheckInEligibility = {
  allowed: boolean;
  reason: 'unknown' | 'no-location' | 'stale' | 'poor-accuracy' | 'outside-map' | 'out-of-range' | 'ready';
  radius: number;
  distance: number | null;
  message: string;
};

/** Shared by the details UI and the state transition. Never use the animated
 * playerUV, a saved position, compass, or GPS accuracy to expand the radius. */
export function checkInEligibility(id: string, location: LocationState, now = Date.now()): CheckInEligibility {
  const place = campusLandmarks.find(item => item.id === id);
  const radius = place?.checkInRadius ?? 0;
  const blocked = (reason: CheckInEligibility['reason'], message: string, distance: number | null = null): CheckInEligibility => ({ allowed:false,reason,radius,distance,message });
  if (!place || !Number.isFinite(radius) || radius <= 0) return blocked('unknown','此点位尚未配置打卡范围');
  const fix = location.reading;
  if (!fix || !location.running) return blocked('no-location','请先开启定位，到达点位附近后再打卡');
  if (!Number.isFinite(fix.timestamp) || !Number.isFinite(now) || now - fix.timestamp > MAX_LOCATION_AGE_MS || fix.timestamp > now + 5000 || location.status === 'stale') {
    return blocked('stale','位置已过期，请重新定位后再打卡');
  }
  if (location.status !== 'tracking') return blocked('no-location','定位暂不可用，请重新定位后再打卡');
  if (!Number.isFinite(fix.accuracy) || fix.accuracy <= 0 || fix.accuracy > GOOD_ACCURACY_M) {
    return blocked('poor-accuracy',`定位精度不足，需设备报告误差不超过${GOOD_ACCURACY_M}米后再打卡`);
  }
  if (![fix.latitude,fix.longitude].every(Number.isFinite) || Math.abs(fix.latitude) > 85 || Math.abs(fix.longitude) > 180 || !fix.insideImage) {
    return blocked('outside-map','当前位置不在地图范围内，暂不能打卡');
  }
  const distance = distanceMeters(fix,place);
  if (distance > radius) return blocked('out-of-range',`距点位约${Math.ceil(distance)}米，请到达${radius}米范围内`,distance);
  return {allowed:true,reason:'ready',radius,distance,message:`已进入${radius}米打卡范围，可以确认打卡`};
}
