import { motion } from 'framer-motion';
import type { HudProps } from '../../types';
import { ScrollText } from '../../ui/scrollDialog/ScrollFurniture';
import { flyingIcon, paperStamp, scrollPart } from '../../ui/scrollDialog/motion';
import { Icon } from '../Icon';
import './panels.css';

type Props = Pick<HudProps, 'activityReturn' | 'onPanel' | 'landmarks' | 'state' | 'onSelect'> & { reduced: boolean };
const returnPart = scrollPart(.16, -11, 6);
const rowTiming = Array.from({ length: 8 }, (_, index) => ({
  row: scrollPart(.22 + index * .035, 0, 6),
  card: flyingIcon(.24 + index * .035),
  stamp: paperStamp(.33 + index * .035),
}));

export default function CollectionPanel(p: Props) {
  return <>
    {p.activityReturn && <motion.button className="outline-button collection-return" variants={returnPart} custom={p.reduced} onClick={() => p.onPanel('activities')}><span aria-hidden="true">←</span>返回活动一览</motion.button>}
    <p className="collection-intro"><ScrollText text="把走过的风景，珍藏成一页页记忆。" reduced={p.reduced} delay={.18} /></p>
    <ol className="collection-ledger">{p.landmarks.map((item, index) => {
      const known = p.state.discoveredIds.includes(item.id);
      const timing = rowTiming[Math.min(index, rowTiming.length - 1)];
      return <motion.li key={item.id} variants={timing.row} custom={p.reduced}><button type="button" className={`collection-item ${known ? 'is-known' : ''}`} onClick={() => p.onSelect(item.id)}>
        <span className="collection-order" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
        <motion.span className="collection-card-flight" variants={timing.card} custom={p.reduced} aria-hidden="true">
          <span className="collection-mark"><Icon name={known ? item.icon : 'lock'} /></span>
        </motion.span>
        <span className="collection-copy">
          <strong>{item.name}</strong><small>{known ? item.subtitle : '尚未踏访'}</small><span className="sr-only">{known ? '已收入图鉴' : '待发现'}</span>
        </span>
        {known ? <motion.span className="letter-stamp" variants={timing.stamp} custom={p.reduced} aria-hidden="true">录</motion.span> : <span className="letter-stamp is-empty" aria-hidden="true">待</span>}
      </button></motion.li>;
    })}</ol>
  </>;
}
