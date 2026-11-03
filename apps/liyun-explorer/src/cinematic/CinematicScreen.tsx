import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { getRegion } from '../content/regions';
import { LANDMARKS } from '../content/catalog';
import { useMotionPreferences } from '../motion/useMotionPreferences';
import type { CinematicPayload } from '../app/stores/useCinematic';
import styles from './cinematic.module.css';
import type { gsap as Gsap } from 'gsap';

type Props = { payload: CinematicPayload | null; onComplete: (id: number) => void };

export default function CinematicScreen({ payload, onComplete }: Props) {
  return payload ? <Presentation key={payload.id} payload={payload} onComplete={onComplete} /> : null;
}

function Presentation({ payload, onComplete }: { payload: CinematicPayload; onComplete: Props['onComplete'] }) {
  const host = useRef<HTMLDivElement>(null);
  const continueButton = useRef<HTMLButtonElement>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const engine = useRef<typeof Gsap | null>(null);
  const closing = useRef(false);
  const { reducedMotion, reduceFlash } = useMotionPreferences();
  const [imageFailed, setImageFailed] = useState(false);
  const [shownDelta, setShownDelta] = useState(0);
  const region = getRegion(payload.contentId);
  const landmark = LANDMARKS.find(item => item.id === payload.contentId);
  const title = region?.name ?? landmark?.name ?? '校园新章';
  const subtitle = region?.subtitle ?? landmark?.subtitle ?? '寻踪拾忆';
  const chapter = region?.story.chapter ?? '校园手札 · 新章';
  const story = region?.story.body ?? landmark?.description ?? '走过的路，正在成为这座校园里属于你的记忆。';
  const verse = region?.story.verse ?? landmark?.verse ?? '一页书香，一程山水。';
  const hero = region?.art.hero ?? `/assets/landmarks/${payload.contentId}/hero.webp`;
  const palette = region?.art.palette ?? ['#21493e', '#577f68', '#e8cf83'];
  const duration = reducedMotion ? 1 : payload.quick ? 2.4 : 5.2;

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    timeline.current?.seek(timeline.current.duration());
    const element = host.current;
    const finish = () => onComplete(payload.id);
    window.dispatchEvent(new CustomEvent('liyun:ui-sfx', { detail: 'cancel' }));
    if (element && engine.current) engine.current.to(element, {
      opacity: 0, duration: reducedMotion ? 0.12 : 0.32, ease: 'power2.in', onComplete: finish,
    });
    else finish();
  }, [onComplete, payload.id, reducedMotion]);

  useLayoutEffect(() => {
    if (reducedMotion) setShownDelta(payload.progressDelta);
    let disposed = false;
    let context: gsap.Context | undefined;
    void import('gsap').then(({ gsap }) => {
      if (disposed || closing.current || !host.current) return;
      engine.current = gsap;
      context = gsap.context(() => {
        const root = host.current!;
        const art = root.querySelector('[data-cinema-art]');
        const text = root.querySelectorAll('[data-cinema-copy]');
        const seal = root.querySelector('[data-cinema-seal]');
        const rule = root.querySelector('[data-cinema-rule]');
        const tl = gsap.timeline();
        timeline.current = tl;
        if (reducedMotion) {
          tl.fromTo(root, { opacity: 0 }, { opacity: 1, duration: .2 });
          tl.to({}, { duration: Math.max(0, duration - .2) });
        } else {
          const speed = payload.quick ? .48 : 1;
          tl.fromTo(root, { opacity: 0 }, { opacity: 1, duration: .32 * speed }, 0)
            .fromTo(art, { clipPath: 'inset(0 50% 0 50%)' }, { clipPath: 'inset(0 0% 0 0%)', duration: .58 * speed, ease: 'power3.out' }, .24 * speed)
            .fromTo(seal, { scale: reduceFlash ? 1 : 1.65, opacity: 0, rotate: -12 }, { scale: 1, opacity: 1, rotate: -8, duration: .42 * speed, ease: 'back.out(1.5)' }, .24 * speed)
            .fromTo(text, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .45 * speed, stagger: .11 * speed }, .6 * speed)
            .fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: .8 * speed, ease: 'power2.inOut' }, .8 * speed);
          const number = { value: 0 };
          tl.to(number, { value: payload.progressDelta, duration: .72 * speed,
            onUpdate: () => setShownDelta(Math.round(number.value)), ease: 'power2.out' }, 1.3 * speed);
          tl.to({}, { duration: Math.max(0, duration - tl.duration()) });
          // Independent child visual, never sharing transform ownership with framer.
          if (!reduceFlash) gsap.fromTo(root.querySelector('[data-cinema-hero]'), { scale: 1.025 }, { scale: 1.075, duration: 8, ease: 'none' });
        }
        root.dataset.timelineReady = 'true';
        root.dataset.timelineDuration = String(tl.duration());
      }, host);
      window.dispatchEvent(new CustomEvent('liyun:ui-sfx', { detail: 'confirm' }));
    }).catch(() => {
      if (!disposed && host.current) { host.current.style.opacity = '1'; setShownDelta(payload.progressDelta); }
    });
    return () => { disposed = true; context?.revert(); timeline.current = null; };
  }, [duration, payload.progressDelta, payload.quick, reduceFlash, reducedMotion]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== ' ' || event.altKey || event.ctrlKey || event.metaKey) return;
      event.preventDefault(); close();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [close]);

  return <Dialog.Root open onOpenChange={open => { if (!open) close(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className={styles.overlay} />
      <Dialog.Content asChild onOpenAutoFocus={event => { event.preventDefault(); continueButton.current?.focus(); }}
        onCloseAutoFocus={event => { event.preventDefault(); }} onEscapeKeyDown={event => { event.preventDefault(); close(); }}>
        <div className={styles.screen} ref={host} data-testid="cinematic-screen" data-cinematic-id={payload.contentId}
          data-duration={duration} data-quick={payload.quick || undefined} onClick={close}>
          <Dialog.Description className="sr-only">打卡进度已保存。点击任意处、按空格或 Escape 继续探索，跳过演出不会改变记录。</Dialog.Description>
          <header className={styles.header}>
            <span>{chapter}</span><span className={styles.gain}>{payload.progressDelta ? <>探索度 +<b>{shownDelta}</b>%</> : '新区域已启'}</span>
          </header>
          <div className={styles.layout}>
            <figure className={styles.art} data-cinema-art data-art-state={imageFailed ? 'fallback' : 'hero'}>
              <div className={styles.artImage} data-cinema-hero>
                {imageFailed ? <PaperLandscape palette={palette} /> : <img src={hero} alt={`${title} · 概念占位插画`} onError={() => setImageFailed(true)} />}
              </div>
              <figcaption>{imageFailed ? '剪纸山水占位 · 内容待补充' : '概念占位插画 · 待实景替换'}</figcaption>
            </figure>
            <section className={styles.story}>
              <p className={styles.eyebrow} data-cinema-copy>{payload.type === 'region' ? '分区已启' : '校园记忆 · 新收录'}</p>
              <Dialog.Title className={styles.title} data-cinema-copy>{title}</Dialog.Title>
              <p className={styles.subtitle} data-cinema-copy>{subtitle}</p>
              <div className={styles.rule} data-cinema-rule />
              <p className={styles.verse} data-cinema-copy>「{verse}」</p>
              <p className={styles.body} data-cinema-copy>{story}</p>
              {!!payload.unlockedRegions?.length && <p className={styles.regionNote} data-cinema-copy>同时点亮 · {payload.unlockedRegions.map(id => getRegion(id)?.name ?? id).join('、')}</p>}
              <button ref={continueButton} className={styles.continue} type="button" onClick={close}>继续探索 <span aria-hidden="true">◇</span></button>
            </section>
          </div>
          <span className={styles.seal} data-cinema-seal aria-hidden="true">已<br />收录</span>
          <footer className={styles.footer}><span>循光而至 · 珍藏此刻</span><span>点击任意处继续 / Esc 跳过</span></footer>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

function PaperLandscape({ palette }: { palette: string[] }) {
  return <svg viewBox="0 0 960 540" width="960" height="540" role="img" aria-label="程序化剪纸山水占位插画">
    <rect width="960" height="540" fill="var(--paper-200)" />
    <circle cx="680" cy="160" r="68" fill={palette[2] ?? 'var(--gold-300)'} opacity=".7" />
    <path d="M0 340 180 130 320 300 490 180 680 330 810 190 960 320V540H0Z" fill={palette[1] ?? 'var(--jade-400)'} opacity=".55" />
    <path d="M0 430 180 290 340 410 530 260 710 410 830 320 960 420V540H0Z" fill={palette[0] ?? 'var(--jade-700)'} opacity=".9" />
    <path d="M0 450Q220 370 450 460T960 410V540H0Z" fill="var(--paper-300)" />
    <path d="M0 480Q260 410 510 490T960 465" fill="none" stroke="var(--gold-400)" strokeWidth="3" />
  </svg>;
}
