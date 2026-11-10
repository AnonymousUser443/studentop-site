import { useEffect, useState } from 'react';
import { preloadAssets, registerOffline, type PreloadProgress } from './preload';

const initialProgress: PreloadProgress = {
  phase: 'manifest', total: 0, loaded: 0, failed: [], bytesLoaded: 0,
  totalBytes: 0, percent: 0, current: '读取素材清单', persistent: false,
};

/** A complete show package, shared by the projector and the audience. */
export function useShowAssets(enabled: boolean) {
  const [progress, setProgress] = useState(initialProgress);
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const { signal } = controller;
    setReady(false);
    setOfflineReady(false);
    void navigator.storage?.persist?.().catch(() => false);
    void Promise.all([preloadAssets(setProgress, { signal, includeVideo: true }), registerOffline()])
      .then(([result, offline]) => {
        if (signal.aborted) return;
        const cached = result.ready && result.persistent && offline.registered;
        if (cached) navigator.serviceWorker.controller?.postMessage({ readyCache: result.cacheName });
        setOfflineReady(cached);
        setReady(result.ready);
      })
      .catch(error => {
        if (signal.aborted) return;
        setProgress(previous => ({ ...previous, phase: 'error', current: String(error) }));
      });
    return () => controller.abort();
  }, [attempt, enabled]);

  return { ready, offlineReady, progress, retry: () => setAttempt(value => value + 1) };
}

export type ShowAssets = ReturnType<typeof useShowAssets>;
