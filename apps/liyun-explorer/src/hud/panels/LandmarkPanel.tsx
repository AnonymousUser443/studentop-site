import type { HudProps, Landmark } from '../../types';
import { Icon } from '../Icon';
import './panels.css';

type Props = Pick<HudProps, 'discovered' | 'checkIn' | 'onClose' | 'onCenter' | 'onExplore' | 'onLocate'> & { item: Landmark };

export default function LandmarkPanel({ item, discovered, checkIn, onClose, onCenter, onExplore, onLocate }: Props) {
  return <>
    <div className={`landmark-seal ${item.isBeacon ? 'beacon-seal' : ''}`}><div className="seal-orbit" /><Icon name={item.icon} /><span>{discovered ? '已 点 亮' : '待 发 现'}</span></div>
    <p className="landmark-verse">{item.verse}</p><div className="ornament-divider"><span>◆</span></div><p className="landmark-description">{item.description}</p>
    {!!item.photos?.length&&<div className="landmark-gallery">{item.photos.map(photo=><figure key={photo.url}><img src={photo.url} alt={photo.alt} loading="lazy"/><figcaption>{photo.alt}</figcaption></figure>)}</div>}
    <div className="landmark-reward"><span><Icon name="star" />{discovered ? '这段旅途已收入记忆' : `探索度 +${item.progress}%`}</span><span><Icon name="book" />{discovered ? '地标已收录' : '收录校园地标'}</span></div>
    {!discovered && <div className={`check-in-status ${checkIn?.allowed ? 'is-ready' : ''}`} data-testid="check-in-status" data-reason={checkIn?.reason} role="status"><p>{checkIn?.message}</p><small>{item.isBeacon ? '虚构信标按地图标记位置判定，无实体塔楼。' : ''}打卡范围：{checkIn?.radius ?? item.checkInRadius}米{checkIn?.distance !== null && checkIn?.distance !== undefined ? ` · 当前直线距离约${Math.ceil(checkIn.distance)}米` : ''}</small></div>}
    {discovered ? <button className="parchment-button" onClick={() => { onClose(); onCenter(); }}>返回地图<Icon name="compass" /></button> : <><button className="parchment-button" data-testid="check-in-button" disabled={!checkIn?.allowed} onClick={onExplore}>{checkIn?.allowed ? '确认打卡' : '到达范围后可打卡'}<Icon name="star" /></button>{!checkIn?.allowed && <button className="outline-button check-in-locate" onClick={onLocate}>定位并显示朝向<Icon name="compass" /></button>}</>}
    {!discovered && <p className="panel-footnote">到达地图点位附近，使用有效定位完成打卡</p>}
  </>;
}
