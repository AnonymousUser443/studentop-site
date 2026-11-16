import type { ThemeKey } from './events';

export const ACTIVITY_ART = {
  ambient: '/assets/activity/ambient-room-blur.webp',
  branch: '/assets/activity/ginkgo-bough.webp',
  journal: '/assets/activity/travel-journal.webp',
};

export const ACTIVITY_PAINTINGS: Record<ThemeKey, string> = {
  frost: '/assets/paintings/waterbirds.webp',
  seasons: '/assets/paintings/north-lake.webp',
  mystery: '/assets/paintings/library.webp',
  encounters: '/assets/paintings/waterbirds.webp',
  archive: '/assets/paintings/library.webp',
};

export const ACTIVITY_REWARDS: Readonly<Record<string, string>> = {
  ginkgo: '/assets/activity/reward-ginkgo.webp',
  journal: '/assets/activity/reward-journal.webp',
  seal: '/assets/activity/reward-seal.webp',
  starlight: '/assets/activity/reward-starlight.webp',
};

// Artwork shared by multiple chapters should be downloaded and decoded just once per visit.
const painted = new Set<string>();
const pending = new Map<string, Promise<boolean>>();
export const artworkReady = (src: string) => painted.has(src);

export function warmArtwork(src: string): Promise<boolean> {
  if (artworkReady(src)) return Promise.resolve(true);
  const ongoing = pending.get(src);
  if (ongoing) return ongoing;
  const promise = new Promise<boolean>(resolve => {
    const image = new Image();
    image.decoding = 'async';
    const complete = (loaded: boolean) => {
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      resolve(loaded);
    };
    const timer = setTimeout(() => complete(false), 3500);
    image.onload = () => {
      // Some browsers reject decode for a successfully loaded image; an <img> can still draw it.
      if (typeof image.decode === 'function') void image.decode().then(() => complete(true), () => complete(image.naturalWidth > 0));
      else complete(true);
    };
    image.onerror = () => complete(false);
    image.src = src;
  }).then(loaded => {
    pending.delete(src);
    if (loaded) painted.add(src);
    return loaded;
  });
  pending.set(src, promise);
  return promise;
}

const opening = [ACTIVITY_PAINTINGS.frost, ACTIVITY_ART.branch, ACTIVITY_ART.journal, ACTIVITY_ART.ambient];
export function prepareOpeningActivityArtwork() {
  return Promise.all(opening.map(warmArtwork));
}

/** The entire pack is already on disk. Don't decode every chapter while the map enters. */
export function prepareLaterActivityArtwork() {
  const queue = [...new Set([...Object.values(ACTIVITY_REWARDS), ...Object.values(ACTIVITY_PAINTINGS)])]
    .filter(src => !opening.includes(src));
  function next() {
    const src = queue.shift();
    if (!src) return;
    const warm = () => { void warmArtwork(src).then(next); };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(warm, { timeout: 2400 });
    else setTimeout(warm, 300);
  }
  next();
}
