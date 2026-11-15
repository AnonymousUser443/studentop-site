import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { MusicHost, MusicRuntime, PlaybackState } from "../domain";

export const PlaybackVisibilityContext = createContext(true);

export function usePlayback<T>(
  runtime: MusicRuntime,
  selector: (state: PlaybackState) => T,
  equal: (a: T, b: T) => boolean = Object.is,
  active?: boolean,
): T {
  const inheritedActive = useContext(PlaybackVisibilityContext),
    enabled = active ?? inheritedActive;
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  const cache = useRef<{ state: PlaybackState; value: T } | null>(null);
  // Inactive views freeze their last selection; the independent audio runtime keeps playing.
  const read = () => {
    if (!enabled && cache.current) return cache.current.value;
    const state = runtime.getSnapshot(),
      value = selectorRef.current(state);
    if (cache.current && equal(cache.current.value, value)) {
      cache.current.state = state;
      return cache.current.value;
    }
    cache.current = { state, value };
    return value;
  };
  const subscribe = useCallback(
    (listener: () => void) =>
      enabled ? runtime.subscribe(listener) : () => {},
    [runtime, enabled],
  );
  return useSyncExternalStore(subscribe, read, read);
}
export function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) =>
      Object.is(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
      ),
    )
  );
}
export function useHost(host: MusicHost) {
  const [revision, setRevision] = useState(0);
  useEffect(() => host.onStateChange(() => setRevision((x) => x + 1)), [host]);
  return { locked: host.isLocked(), reduced: host.reducedMotion(), revision };
}
export function useDocumentVisible() {
  const [visible, setVisible] = useState(() => !document.hidden);
  useEffect(() => {
    const onChange = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);
  return visible;
}
export function useResource<T>(
  load: (signal: AbortSignal) => Promise<T>,
  key: string,
  enabled = true,
) {
  const loader = useRef(load);
  loader.current = load;
  const [resolved, setResolved] = useState<{ key: string; value: T } | null>(
      null,
    ),
    [error, setError] = useState<Error | null>(null),
    [loading, setLoading] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    loader
      .current(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResolved({ key, value: data });
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(
            err instanceof Error
              ? err
              : new Error("暂时无法载入，请稍后重试。"),
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [key, enabled, revision]);
  return {
    value: resolved?.key === key ? resolved.value : null,
    error,
    loading,
    retry: () => setRevision((x) => x + 1),
  };
}
export function formatTime(ms: number) {
  const seconds = Math.max(
    0,
    Math.floor((Number.isFinite(ms) ? ms : 0) / 1000),
  );
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
export function formatCount(value: number) {
  if (value >= 1e8) return `${(value / 1e8).toFixed(1).replace(/\.0$/, "")}亿`;
  if (value >= 1e4) return `${(value / 1e4).toFixed(1).replace(/\.0$/, "")}万`;
  return String(Math.max(0, value));
}
export function readStored<T>(key: string, fallback: T): T {
  try {
    const data = localStorage.getItem(key);
    return data ? (JSON.parse(data) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function writeStored(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Optional preferences never block playback. */
  }
}
