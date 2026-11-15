import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from "react";

const CacheContext = createContext<Map<string, unknown> | null>(null);
const PageContext = createContext("");
export function ViewCacheProvider({ children }: { children: ReactNode }) {
  const cache = useRef(new Map<string, unknown>());
  return (
    <CacheContext.Provider value={cache.current}>
      {children}
    </CacheContext.Provider>
  );
}
export function PageMemory({
  cacheKey,
  children,
}: {
  cacheKey: string;
  children: ReactNode;
}) {
  return (
    <PageContext.Provider value={cacheKey}>{children}</PageContext.Provider>
  );
}
export function useViewState<T>(
  key: string,
  initial: T,
): [T, Dispatch<SetStateAction<T>>] {
  const cache = useContext(CacheContext),
    [state, setState] = useState(() => ({
      key,
      value: cache?.has(key) ? (cache.get(key) as T) : initial,
    }));
  const value =
    state.key === key
      ? state.value
      : cache?.has(key)
        ? (cache.get(key) as T)
        : initial;
  const update: Dispatch<SetStateAction<T>> = (action) =>
    setState((old) => {
      const previous =
        old.key === key
          ? old.value
          : cache?.has(key)
            ? (cache.get(key) as T)
            : initial;
      const next =
        typeof action === "function"
          ? (action as (v: T) => T)(previous)
          : action;
      cache?.set(key, next);
      return { key, value: next };
    });
  return [value, update];
}
export function useScrollMemory(
  ref: RefObject<HTMLElement | null>,
  slot: string,
  ready: number,
) {
  const cache = useContext(CacheContext),
    page = useContext(PageContext),
    key = `scroll:${page}:${slot}`;
  useEffect(() => {
    const element = ref.current;
    if (!element || !cache) return;
    const saved = cache.get(key) as number | undefined;
    const frame = requestAnimationFrame(() => {
      if (typeof saved === "number") element.scrollTop = saved;
    });
    const remember = () => cache.set(key, element.scrollTop);
    element.addEventListener("scroll", remember, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener("scroll", remember);
    };
  }, [cache, key, ready, ref]);
}
