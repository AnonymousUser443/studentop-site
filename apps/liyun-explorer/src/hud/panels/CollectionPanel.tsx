import type { HudProps } from '../../types';
import { Icon } from '../Icon';
import './panels.css';

type Props = Pick<HudProps, 'activityReturn' | 'onPanel' | 'landmarks' | 'state' | 'onSelect'>;

export default function CollectionPanel(p: Props) {
  return <>
    {p.activityReturn && <button className="outline-button collection-return" onClick={() => p.onPanel('activities')}><span aria-hidden="true">←</span>返回活动一览</button>}
    <p className="collection-intro">把走过的风景，珍藏成一页页记忆。</p>
    <div className="collection-grid">{p.landmarks.map(item => {
      const known = p.state.discoveredIds.includes(item.id);
      return <button key={item.id} className={`collection-item ${known ? 'is-known' : ''}`} onClick={() => p.onSelect(item.id)}><span className="collection-mark"><Icon name={known ? item.icon : 'lock'} /></span><strong>{item.name}</strong><small>{known ? '已收入图鉴' : '待发现'}</small></button>;
    })}</div>
  </>;
}
