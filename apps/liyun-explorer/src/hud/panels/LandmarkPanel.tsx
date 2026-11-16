import { motion } from 'framer-motion';
import type { HudProps, Landmark } from '../../types';
import { ScrollText } from '../../ui/scrollDialog/ScrollFurniture';
import { flyingIcon, paperStamp, scrollPart } from '../../ui/scrollDialog/motion';
import { Icon } from '../Icon';
import './panels.css';

type Props = Pick<HudProps, 'discovered' | 'checkIn' | 'onClose' | 'onCenter' | 'onExplore' | 'onLocate'> & { item: Landmark; reduced: boolean };
const textPart = scrollPart(.39, 0, 8);
const rewardsPart = scrollPart(.47, 0, 11);
const collectedStamp = paperStamp(.31);
const emptyStamp = scrollPart(.31, 4, 2);
const noteCard = flyingIcon(.20);

export default function LandmarkPanel({ item, discovered, checkIn, onClose, onCenter, onExplore, onLocate, reduced }: Props) {
  return <>
    <div className="landmark-letter-lead">
      <motion.span className="landmark-paper-card-flight" variants={noteCard} custom={reduced} aria-hidden="true"><span className="landmark-paper-card"><Icon name={item.icon} /></span></motion.span>
      <p className="landmark-verse"><ScrollText text={item.verse} reduced={reduced} delay={.25} /></p>
      {discovered ? <motion.span className="letter-stamp" variants={collectedStamp} custom={reduced} role="img" aria-label="已收录">录</motion.span> : <motion.span className="letter-stamp is-empty" variants={emptyStamp} custom={reduced} role="img" aria-label="待发现">待</motion.span>}
    </div>
    <motion.div variants={textPart} custom={reduced}>
      <p className="landmark-description">{item.description}</p>
      {!!item.photos?.length&&<div className="landmark-gallery">{item.photos.map(photo=><figure key={photo.url}><img src={photo.url} alt={photo.alt} loading="lazy"/><figcaption>{photo.alt}</figcaption></figure>)}</div>}
    </motion.div>
    <motion.div variants={rewardsPart} custom={reduced}>
      <div className="landmark-reward"><span><Icon name="star" />{discovered ? '这段旅途已收入记忆' : `探索度 +${item.progress}%`}</span><span><Icon name="book" />{discovered ? '地标已收录' : '收录校园地标'}</span></div>
      {!discovered && <div className={`check-in-status ${checkIn?.allowed ? 'is-ready' : ''}`} data-testid="check-in-status" data-reason={checkIn?.reason} role="status"><p>{checkIn?.message}</p><small>{item.isBeacon ? '虚构信标按地图标记位置判定，无实体塔楼。' : ''}打卡范围：{checkIn?.radius ?? item.checkInRadius}米{checkIn?.distance !== null && checkIn?.distance !== undefined ? ` · 当前直线距离约${Math.ceil(checkIn.distance)}米` : ''}</small></div>}
      {discovered ? <button className="parchment-button" onClick={() => { onClose(); onCenter(); }}>返回地图<Icon name="compass" /></button> : <><button className="parchment-button" data-testid="check-in-button" disabled={!checkIn?.allowed} onClick={onExplore}>{checkIn?.allowed ? '确认打卡' : '到达范围后可打卡'}<Icon name="star" /></button>{!checkIn?.allowed && <button className="outline-button check-in-locate" onClick={onLocate}>定位并显示朝向<Icon name="compass" /></button>}</>}
      {!discovered && <p className="panel-footnote">到达地图点位附近，使用有效定位完成打卡</p>}
    </motion.div>
  </>;
}
