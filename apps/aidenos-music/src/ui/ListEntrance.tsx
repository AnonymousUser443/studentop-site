import {
  useContext,
  useLayoutEffect,
  useRef,
  type HTMLAttributes,
  type ReactNode,
  type RefObject,
} from "react";
import { animate, useReducedMotionConfig } from "motion/react";
import { PlaybackVisibilityContext, useDocumentVisible } from "./hooks";
import styles from "./ListEntrance.module.css";

export interface ListEntranceOptions {
  /** Stable view/account identity. Seen items survive virtual unmounts and revisits. */
  key: string;
  selector?: string;
  active?: boolean;
  reducedMotion?: boolean;
  /** Initial phase in milliseconds; elapsed page time is deducted on later scrolls. */
  phase?: number;
  /** Maximum stagger within each newly visible batch, in milliseconds. */
  stagger?: number;
  distance?: number;
}

const histories = new Map<string, Set<string>>();
const MAX_SCOPES = 48;
const MAX_SEEN_ITEMS = 4000;
const MAX_RUNNING = 24;

function historyFor(key: string) {
  let seen = histories.get(key);
  if (!seen) seen = new Set<string>();
  histories.delete(key);
  histories.set(key, seen);
  while (histories.size > MAX_SCOPES)
    histories.delete(histories.keys().next().value!);
  return seen;
}

function remember(seen: Set<string>, key: string) {
  seen.delete(key);
  seen.add(key);
  while (seen.size > MAX_SEEN_ITEMS) seen.delete(seen.values().next().value!);
}

interface Item {
  element: HTMLElement;
  key: string;
  index: number;
  phase: number;
  opacity: string;
  transform: string;
  willChange: string;
  animation?: ReturnType<typeof animate>;
}

function attach(
  root: HTMLElement,
  options: Required<Omit<ListEntranceOptions, "active" | "reducedMotion">>,
) {
  const seen = historyFor(options.key);
  const items = new Map<HTMLElement, Item>();
  const queued = new Set<Item>();
  const running = new Set<Item>();
  const startedAt = performance.now();
  let frame = 0;
  let disposed = false;
  root.dataset.listScope = options.key;

  const restore = (item: Item) => {
    item.element.classList.remove(styles.pending);
    item.element.style.opacity = item.opacity;
    item.element.style.transform = item.transform;
    item.element.style.willChange = item.willChange;
    item.element.style.removeProperty("--list-enter-distance");
    item.element.dataset.listState = "entered";
  };
  const finish = (item: Item) => {
    item.animation?.stop();
    item.animation = undefined;
    running.delete(item);
    queued.delete(item);
    restore(item);
  };
  const flush = () => {
    frame = 0;
    if (disposed) return;
    const batch = [...queued]
      .filter((item) => item.element.isConnected)
      .sort((a, b) => a.phase - b.phase || a.index - b.index);
    queued.clear();
    batch.forEach((item, rank) => {
      if (seen.has(item.key)) {
        restore(item);
        return;
      }
      while (running.size >= MAX_RUNNING) finish(running.values().next().value!);
      remember(seen, item.key);
      observer.unobserve(item.element);
      const initialPhase = Math.max(
        0,
        Math.min(600, options.phase + item.phase) - (performance.now() - startedAt),
      );
      const stagger = Math.min(
        options.stagger,
        44 * Math.pow(rank, 0.74) + (rank % 3) * 9,
      );
      item.element.dataset.listState = "entering";
      item.element.style.willChange = "transform, opacity";
      running.add(item);
      item.animation = animate(
        item.element,
        {
          opacity: [0, 1],
          transform: [
            `translate3d(${-options.distance}px,0,0)`,
            "translate3d(0,0,0)",
          ],
        },
        {
          duration: 0.52,
          delay: (initialPhase + stagger) / 1000,
          ease: [0.16, 1, 0.3, 1],
          onComplete: () => {
            if (!disposed) finish(item);
          },
        },
      );
    });
  };
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const item = items.get(entry.target as HTMLElement);
        if (!item) continue;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.12) {
          queued.add(item);
        } else {
          queued.delete(item);
        }
      }
      if (queued.size && !frame) frame = requestAnimationFrame(flush);
    },
    // The viewport observer also clips against every overflow ancestor. Virtual
    // overscan nodes remain pending until they enter the actual scroll viewport.
    { threshold: [0, 0.12], rootMargin: "0px" },
  );
  const scan = () => {
    const current = new Set(
      Array.from(root.querySelectorAll<HTMLElement>(options.selector)).filter(
        (element) => element.closest("[data-list-scope]") === root,
      ),
    );
    for (const [element, item] of items) {
      if (!current.has(element) || (element.dataset.listKey || element.id) !== item.key) {
        observer.unobserve(element);
        finish(item);
        items.delete(element);
      }
    }
    let order = 0;
    for (const element of current) {
      const itemKey = element.dataset.listKey || element.id;
      if (!itemKey || items.has(element)) continue;
      const item: Item = {
        element,
        key: itemKey,
        index: Number(element.dataset.listIndex) || order,
        phase: Math.max(0, Number(element.dataset.listPhase) || 0),
        opacity: element.style.opacity,
        transform: element.style.transform,
        willChange: element.style.willChange,
      };
      order += 1;
      items.set(element, item);
      if (seen.has(itemKey)) restore(item);
      else {
        element.style.setProperty("--list-enter-distance", `${options.distance}px`);
        element.classList.add(styles.pending);
        element.dataset.listState = "pending";
        observer.observe(element);
      }
    }
  };
  const mutations = new MutationObserver(scan);
  mutations.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-list-key", "data-list-index", "data-list-phase"],
  });
  const focus = (event: FocusEvent) => {
    const element = (event.target as HTMLElement).closest<HTMLElement>(options.selector);
    const item = element && items.get(element);
    if (item) {
      remember(seen, item.key);
      observer.unobserve(item.element);
      finish(item);
    }
  };
  root.addEventListener("focusin", focus);
  scan();
  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    mutations.disconnect();
    root.removeEventListener("focusin", focus);
    for (const item of items.values()) finish(item);
    if (root.dataset.listScope === options.key) delete root.dataset.listScope;
  };
}

/**
 * Mark existing row/card roots with data-list-item and a stable data-list-key.
 * No wrapper or layout measurement is introduced, including for virtual lists.
 */
export function useListEntrance(
  ref: RefObject<HTMLElement | null>,
  {
    key,
    selector = "[data-list-item]",
    active,
    reducedMotion,
    phase = 0,
    stagger = 240,
    distance = 24,
  }: ListEntranceOptions,
) {
  const inheritedActive = useContext(PlaybackVisibilityContext);
  const documentVisible = useDocumentVisible();
  const configuredReduced = useReducedMotionConfig();
  const enabled = (active ?? inheritedActive) && documentVisible;
  const reduced = reducedMotion ?? !!configuredReduced;
  const attached = useRef<{
    root: HTMLElement;
    signature: string;
    cleanup: () => void;
  } | null>(null);
  // Check after every commit: resource-driven pages can mount their ref after an
  // initial loading return, and virtual render batches replace nodes in place.
  useLayoutEffect(() => {
    const root = ref.current;
    const signature = JSON.stringify([key, selector, phase, stagger, distance]);
    if (
      attached.current &&
      (attached.current.root !== root ||
        attached.current.signature !== signature ||
        !enabled ||
        reduced)
    ) {
      attached.current.cleanup();
      attached.current = null;
    }
    if (
      root &&
      enabled &&
      !reduced &&
      !attached.current &&
      typeof IntersectionObserver !== "undefined"
    ) {
      attached.current = {
        root,
        signature,
        cleanup: attach(root, {
          key,
          selector,
          phase: Math.max(0, phase),
          stagger: Math.max(0, Math.min(400, stagger)),
          distance: Math.max(0, Math.min(48, distance)),
        }),
      };
    }
  });
  useLayoutEffect(() => () => {
    attached.current?.cleanup();
    attached.current = null;
  }, []);
}

export function ListEntrance({
  entranceKey,
  active,
  reducedMotion,
  selector,
  phase,
  stagger,
  distance,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> &
  Omit<ListEntranceOptions, "key"> & {
    entranceKey: string;
    children: ReactNode;
  }) {
  const ref = useRef<HTMLDivElement>(null);
  useListEntrance(ref, {
    key: entranceKey,
    active,
    reducedMotion,
    selector,
    phase,
    stagger,
    distance,
  });
  return <div {...props} ref={ref}>{children}</div>;
}
