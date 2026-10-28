import { GOOD_ACCURACY_M } from './campus';
import type { LocationState } from './geolocation';
import { describeHeading, type HeadingState } from './deviceHeading';
import './location.css';

export default function LocationControls({ state, heading, following, distance, onLocate, onStop }: {
  state: LocationState; heading: HeadingState; following: boolean; distance: string; onLocate: () => void; onStop: () => void;
}) {
  const good = state.status === 'tracking' && state.reading?.insideImage && state.reading.accuracy <= GOOD_ACCURACY_M;
  const headingMessages: Record<HeadingState['status'],string> = {
    off:'', requesting:'正在申请方向访问；允许后自动显示朝向', waiting:'正在获取朝向，请稍微放平手机',
    active:good && heading.bearing !== null ? `手机朝向：${describeHeading(heading.bearing)} · 指南针参考` : '已获取朝向，定位有效且精度改善后显示方向指针',
    calibrating:'指南针精度不足，请远离磁铁并转动手机校准', tilt:'请稍微放平手机，再查看屏幕上边缘的朝向',
    stale:'朝向数据已过期，已隐藏方向指针', denied:'未允许方向访问，仍可定位；允许后点「定位到我」重试',
    unsupported:'当前设备不支持指南针，仍可正常定位', unavailable:'未收到指南针数据，仍可定位；可稍微放平手机或重新定位',
    paused:'朝向已暂停，点「继续定位」一起恢复', insecure:'方向访问需要 HTTPS 链接',
  };
  return <section className={`location-controls ${good ? 'location-good' : ''}`} aria-label="校园真实定位" data-status={state.status} data-heading-status={heading.status}>
    <div className="location-actions">
      <button type="button" className="location-primary" onClick={onLocate} disabled={state.status === 'locating'}>
        <span aria-hidden="true">◎</span> {state.status === 'locating' ? '定位中…' : state.status === 'paused' ? '继续定位' : good ? following ? '跟随中 · 定位到我' : '回到我的位置' : '定位到我'}
      </button>
      {state.running && <button type="button" onClick={onStop}>停止定位</button>}
    </div>
    <p role="status" aria-live="polite">{state.message}</p>
    {headingMessages[heading.status] && <p className="location-heading-status" role="status">{headingMessages[heading.status]}</p>}
    {distance && <p className="location-distance">{distance}</p>}
  </section>;
}
