import type gsap from 'gsap';
import { audio } from './audio';

export function addStageImpact(tl: gsap.core.Timeline, root: HTMLElement, at: number, label = false) {
  tl.call(() => {
    if (root.hasAttribute('data-spectator')) navigator.vibrate?.(label ? 22 : 40);
    else audio.play('seal-stamp');
    const offset = label ? 8 : 14;
    root.animate([
      { transform: 'scale(1.016) translate(0, 0)' },
      { transform: `scale(1.016) translate(${offset}px, 6px)`, offset: .12 },
      { transform: `scale(1.012) translate(${-offset * .64}px, -4px)`, offset: .3 },
      { transform: `scale(1.008) translate(${offset * .4}px, 2px)`, offset: .49 },
      { transform: 'scale(1) translate(0, 0)' },
    ], { duration: label ? 270 : 380, easing: 'ease-out' });
  }, [], at);
}

export function addSceneImpacts(tl: gsap.core.Timeline, root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[data-review-impact]').forEach(node => {
    const time = Number(node.dataset.impactDelay ?? .6);
    if (Number.isFinite(time) && time >= 0) addStageImpact(tl, root, time, node.dataset.reviewImpact === 'label');
  });
}
