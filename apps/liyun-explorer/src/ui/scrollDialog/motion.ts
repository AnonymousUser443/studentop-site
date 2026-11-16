import type { Variants } from 'framer-motion';
import { EASE, tween } from '../../motion/transitions';

const laid = 'inset(-12% -8% -10% -8%)';
const tucked = 'inset(-12% -8% 42% -8%)';
const sealed = 'inset(-12% -8% 100% -8%)';
const draw = { duration: .36, ease: EASE.out };
const seal = { duration: .34, ease: [.34, 0, .32, 1] as const };
const contentStart = draw.duration + .045;
const paperRetract = .26;
const flat = { y: 0, scale: 1, rotateX: 0, transformPerspective: 1050 };
const inkLanding = [.22, .87, .36, 1] as const;

/** One presence timeline: paper -> ink on entry, ink -> paper on exit. */
export const scrollPaper: Variants = {
  rolled: (reduced: boolean) => reduced
    ? { ...flat, opacity: 0, clipPath: laid }
    : { y: 26, scale: .96, rotateX: 7, transformPerspective: 1050, opacity: 1, clipPath: tucked },
  open: (reduced: boolean) => ({ ...flat, opacity: 1, clipPath: laid, transition: reduced ? tween.tap : draw }),
  closing: (reduced: boolean) => reduced
    ? { opacity: 0, transition: tween.tap }
    : { y: -11, scale: .96, rotateX: 9, clipPath: sealed, opacity: 0,
      transition: { ...seal, delay: paperRetract, opacity: { delay: paperRetract + .29, duration: .05, ease: EASE.soft } } },
};

export const scrollScrim: Variants = {
  rolled: { opacity: 0 },
  open: { opacity: 1, transition: tween.base },
  closing: (reduced: boolean) => ({ opacity: 0, transition: reduced ? tween.tap : { ...tween.base, delay: paperRetract + .08 } }),
};

// Entry has its own sheet inside the scrim. Finish the overlay after that sheet
// even when the user presses the button before all its words have arrived.
export const entryScrim: Variants = {
  ...scrollScrim,
  closing: (reduced: boolean) => ({ opacity: 0, transition: reduced ? tween.tap : { ...tween.base, delay: paperRetract + .11 } }),
};

const inkIn = (delay: number, duration = .25) => ({ delay: contentStart + delay, duration, ease: inkLanding });
// Lower rows and later elements go first; earlier marks linger before folding.
const inkOut = (delay: number) => ({ delay: Math.max(.005, .12 - delay * .32), duration: .13, ease: EASE.soft });

export const glyphTiming = (delay: number) => ({ enter: inkIn(delay).delay, exit: inkOut(delay).delay });

export function scrollPart(delay = .14, x = 0, y = 8): Variants {
  return {
    rolled: (reduced: boolean) => reduced ? { opacity: 1, x: 0, y: 0 } : { opacity: 0, x, y },
    open: (reduced: boolean) => ({ opacity: 1, x: 0, y: 0, transition: reduced ? tween.tap : inkIn(delay) }),
    closing: (reduced: boolean) => reduced ? { opacity: 1 } : { opacity: 0, x: x * .45, y: -Math.abs(y) * .6, transition: inkOut(delay) },
  };
}

export function flyingIcon(delay = .055): Variants {
  const flatIcon = { opacity: 1, x: 0, y: 0, rotate: 0 };
  return {
    rolled: (reduced: boolean) => reduced ? flatIcon : { opacity: 0, x: -15, y: -10, rotate: -9 },
    open: (reduced: boolean) => ({ ...flatIcon, transition: reduced ? tween.tap : { ...inkIn(delay, .33), ease: [.2, 1.07, .35, 1] } }),
    closing: (reduced: boolean) => reduced ? flatIcon : { opacity: 0, x: -6, y: -5, rotate: -4, transition: inkOut(delay) },
  };
}
export const scrollIcon = flyingIcon();

export function paperStamp(delay = .25): Variants {
  const imprint = { opacity: .94, y: 0, scale: 1, rotate: -6 };
  return {
    rolled: (reduced: boolean) => reduced ? imprint : { opacity: 0, y: -15, scale: 1.28, rotate: -12 },
    open: (reduced: boolean) => ({ ...imprint, transition: reduced ? tween.tap : { ...inkIn(delay, .27), ease: [.26, 1.09, .36, 1] } }),
    closing: (reduced: boolean) => reduced ? imprint : { opacity: 0, y: -5, scale: 1.04, rotate: -6, transition: inkOut(delay) },
  };
}

export const paperEdge: Variants = {
  rolled: (reduced: boolean) => ({ y: '58%', opacity: reduced ? 0 : .64 }),
  open: (reduced: boolean) => ({
    y: '110%', opacity: 0, transition: reduced ? tween.tap : { ...draw, opacity: { delay: .25, duration: .11, ease: EASE.soft } },
  }),
  closing: (reduced: boolean) => ({
    y: '0%', opacity: reduced ? 0 : .63,
    transition: reduced ? tween.tap : { ...seal, delay: paperRetract, opacity: { delay: paperRetract, duration: .08, ease: EASE.soft } },
  }),
};

export const fretTiming = (delay: number, frame = false) =>
  ({ enter: delay, enterDuration: frame ? .37 : .29, exit: paperRetract - .09 - delay * .2 });
