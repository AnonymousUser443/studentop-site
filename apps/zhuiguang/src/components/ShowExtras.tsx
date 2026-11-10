import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { audio } from '../core/audio';
import { reducedMotion } from '../core/deck';
import { appUrl, showId } from '../core/url';
import { useAudienceQr } from './RoomQr';
import type { RaffleView } from '../core/sync';

export function AudienceQr() {
  const qr = useAudienceQr(showId);
  return <section className="show-qr-stage" aria-label="观众入口二维码">
    <div className="show-qr-copy"><small>睿信之星 · 现场互动</small><h1>追光者</h1><p>扫码进入观众端</p><span>跟随现场画面 · 参与互动 · 写一封信</span></div>
    <figure>{qr.src ? <img src={qr.src} alt={showId ? `扫码加入场次 ${showId}` : "扫码打开《追光者》观众端"}/> : <p className="room-qr-placeholder" role="status">{qr.failed ? "请手动输入场次号" : "正在生成二维码…"}</p>}<figcaption>{showId ? `观众入口 · 场次 ${showId}` : "观众入口 · 扫码后输入场次号"}</figcaption></figure>
  </section>;
}

export function RaffleStage({ raffle }: { raffle: RaffleView }) {
  const stage = useRef<HTMLElement>(null);
  const previouslyRevealed = useRef(raffle.winners.length);
  useLayoutEffect(() => {
    if (raffle.winners.length > previouslyRevealed.current) audio.play('light-on', 1 + raffle.winners.length * .09);
    previouslyRevealed.current = raffle.winners.length;
  }, [raffle.winners.length]);
  const drawing = raffle.startedAt !== null && raffle.winners.length < 4;
  useLayoutEffect(() => {
    if (!drawing || reducedMotion || !stage.current) return;
    const cards = stage.current.querySelectorAll('.raffle-lantern');
    const context = gsap.context(() => {
      const timeline = gsap.timeline();
      timeline.to(cards, { y: (i: number) => -26 - (i % 4) * 12, rotate: (i: number) => i % 2 ? 11 : -11, ease: 'power2.out', duration: .44, stagger: .026 });
      timeline.to(cards, { x: (i: number) => 515 - i * 50, y: (i: number) => -90 - (i % 4) * 7, scale: .62, opacity: .48, ease: 'power3.inOut', duration: .72, stagger: .013 }, .65);
      timeline.to(cards, { scale: .16, opacity: 0, duration: .4, ease: 'power2.in' }, 1.67);
    }, stage.current);
    return () => context.revert();
  }, [drawing, raffle.startedAt]);
  return <section ref={stage} className="show-raffle-stage" data-review-motion={reducedMotion ? "off" : "on"} aria-label="追光者现场抽奖">
    <header><small>追光者 · 现场抽签</small><h1>抽四盏灯</h1><p>{raffle.count < 4 ? `当前有 ${raffle.count} 位入池 · 至少 4 位可抽签` : `从互动轮次最多的 ${raffle.count} 位观众中，随机抽出 4 位`}</p></header>
    <div className="raffle-lanterns" data-finished={raffle.winners.length === 4} aria-hidden="true">{Array.from({length: raffle.count}, (_, i) => <i className="raffle-lantern" key={i}/>)}</div>
    <div className="raffle-slips">{Array.from({length: 4}, (_, i) => <div className="raffle-slip" key={i}>
      <small>第 {i + 1} 签</small><strong key={raffle.winners[i] || 'empty'} className={raffle.winners[i] ? 'raffle-code' : ''}>{raffle.winners[i] || '······'}</strong>
    </div>)}</div>
    <div className="raffle-prize"><img src={appUrl('/assets/img/supplement/prize-back.webp')} alt="奖品背面"/><img src={appUrl('/assets/img/supplement/prize-front.webp')} alt="奖品正面"/></div>
    <footer>{raffle.winners.length ? '中奖的同学，请出示观众端领奖码' : drawing ? '抽签进行中' : '每轮有效互动计一分 · 抽中的同学将在手机上收到领奖码'}</footer>
  </section>;
}
