import { appBase, appUrl } from './url.ts';

export interface AssetEntry {
  path?: string;
  url?: string;
  bytes?: number;
  variant?: string;
  sha256?: string;
  shell?: boolean;
  usable?: boolean;
  [key: string]: unknown;
}
export interface PreloadProgress {
  phase: 'manifest' | 'assets' | 'complete' | 'error';
  total: number;
  loaded: number;
  failed: string[];
  bytesLoaded: number;
  totalBytes: number;
  percent: number;
  current: string;
  persistent: boolean;
}
export interface PreloadResult extends PreloadProgress { ready: boolean; cacheName: string }
export interface PreloadOptions {
  signal?: AbortSignal;
  manifestUrl?: string;
  includeVideo?: boolean;
  filter?: (asset: AssetEntry) => boolean;
  concurrency?: number;
}
const cachePrefix = 'light-chaser-v3:' + appBase + ':';
function abort(signal?: AbortSignal) { if (signal?.aborted) throw new DOMException('资源准备已取消', 'AbortError'); }
function manifestHash(text: string) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(16);
}

/** Downloads real manifest resources. Failed resources never count as loaded. */
export async function preloadAssets(onProgress: (progress: PreloadProgress) => void, options: PreloadOptions = {}): Promise<PreloadResult> {
  const progress: PreloadProgress = { phase: 'manifest', total: 0, loaded: 0, failed: [], bytesLoaded: 0, totalBytes: 0, percent: 0, current: '读取素材清单', persistent: false };
  const notify = () => onProgress({ ...progress, failed: [...progress.failed] });
  notify(); abort(options.signal);
  let entries: AssetEntry[];
  let manifestResponse: Response | undefined;
  const manifestUrl = options.manifestUrl || appUrl('/assets/manifest.json');
  let cacheName = `${cachePrefix}v1`;
  try {
    try {
      const response = await fetch(manifestUrl, { signal: options.signal, cache: 'reload' });
      if (!response.ok) throw new Error(`素材清单 HTTP ${response.status}`);
      manifestResponse = response;
    } catch (networkError) {
      abort(options.signal);
      if ('caches' in window) {
        // The assets cache is written even before the first Service Worker owns
        // this page. Prefer its latest manifest over an older shell response.
        const names = (await caches.keys()).filter((name) => name.startsWith(cachePrefix)).reverse();
        for (const name of names) {
          manifestResponse = await (await caches.open(name)).match(manifestUrl);
          if (manifestResponse) break;
        }
      }
      if (!manifestResponse?.ok) throw networkError;
    }
    const raw = await manifestResponse.clone().text();
    const manifest = JSON.parse(raw);
    entries = Array.isArray(manifest) ? manifest : manifest.assets;
    if (!Array.isArray(entries)) throw new Error('素材清单格式不正确');
    cacheName = `${cachePrefix}${manifestHash(raw)}`;
  } catch (error) {
    abort(options.signal);
    progress.phase = 'error'; progress.current = error instanceof Error ? error.message : '素材清单无法读取'; progress.failed = [manifestUrl]; notify();
    return { ...progress, ready: false, cacheName };
  }
  entries = entries.filter((asset) => {
    const url = asset.url || asset.path;
    if (!url || asset.usable === false || asset.variant === 'original-resolution') return false;
    if (options.includeVideo === false && /\.(mp4|webm|mov)(\?|$)/i.test(url)) return false;
    if (!url.startsWith('/assets/') && !(asset.shell && ['/index.html', '/favicon.svg'].includes(url))) return false;
    return options.filter ? options.filter(asset) : true;
  });
  entries = [...new Map(entries.map((asset) => [asset.url || asset.path, asset])).values()];
  progress.phase = 'assets'; progress.total = entries.length;
  progress.totalBytes = entries.reduce((sum, asset) => sum + (asset.bytes || 0), 0);
  let cache: Cache | undefined;
  let previousCaches: Cache[] = [];
  try {
    if ('caches' in window) {
      cache = await caches.open(cacheName);
      const names = (await caches.keys()).filter(name => name.startsWith(cachePrefix) && name !== cacheName).reverse();
      previousCaches = await Promise.all(names.map(name => caches.open(name)));
      progress.persistent = true;
    }
  } catch { /* HTTP LAN and storage-denied clients can still download assets. */ }
  let cursor = 0;
  async function worker() {
    while (cursor < entries.length) {
      abort(options.signal);
      const asset = entries[cursor++];
      const url = appUrl((asset.url || asset.path)!);
      progress.current = url; notify();
      try {

        const valid = (response?: Response) => response?.status === 200
          && (asset.shell || !response.headers.get('content-type')?.includes('text/html'))
          && (!asset.sha256 || response.headers.get('x-zhuiguang-sha256') === asset.sha256)
          && (!asset.bytes || !response.headers.has('content-length') || Number(response.headers.get('content-length')) === asset.bytes);
        let response = cache ? await cache.match(url) : undefined;
        if (!valid(response)) {
          response = undefined;
          if (asset.sha256) for (const previous of previousCaches) {
            const hit = await previous.match(url);
            if (!valid(hit)) continue;
            response = hit;
            try { await cache?.put(url, hit!.clone()); } catch { progress.persistent = false; }
            break;
          }
        }
        if (!response) {
          response = await fetch(url, { signal: options.signal, cache: 'reload' });
          if (response.status !== 200) throw new Error(`未收到完整资源 HTTP ${response.status}`);
          if (!asset.shell && response.headers.get('content-type')?.includes('text/html')) throw new Error('资源地址返回了网页');
          const body = await response.arrayBuffer();
          if (asset.bytes && body.byteLength !== asset.bytes) throw new Error('资源大小与清单不符');
          if (asset.sha256 && crypto.subtle) {
            const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', body));
            if (Array.from(hash, value => value.toString(16).padStart(2, '0')).join('') !== asset.sha256) throw new Error('资源指纹与清单不符');
          }
          abort(options.signal);
          if (cache) {
            try {
              const headers = new Headers(response.headers);
              headers.delete('content-encoding');
              headers.set('content-length', String(body.byteLength));
              if (asset.sha256) headers.set('x-zhuiguang-sha256', asset.sha256);
              await cache.put(url, new Response(body, { headers }));
            }
            catch { progress.persistent = false; }
          }
          progress.bytesLoaded += body.byteLength;
        } else progress.bytesLoaded += asset.bytes || Number(response.headers.get('content-length')) || (await response.clone().arrayBuffer()).byteLength;
        progress.loaded += 1;
      } catch {
        abort(options.signal); progress.failed.push(url);
      }
      progress.percent = progress.total ? Math.round(progress.loaded / progress.total * 100) : 100;
      notify();
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(options.concurrency || 3, 1), 6) }, worker));
  abort(options.signal);
  progress.phase = progress.failed.length ? 'error' : 'complete';
  progress.percent = progress.total ? Math.round(progress.loaded / progress.total * 100) : 100;
  progress.current = progress.failed.length ? `${progress.failed.length} 个素材未完成，可重试` : '舞台资源已准备';
  if (!progress.failed.length && cache && progress.persistent && manifestResponse && !options.filter && options.includeVideo !== false) {
    try {
      await cache.put(manifestUrl, manifestResponse.clone());
      const names = await caches.keys();
      // Keep one known-good release during a rollout or interrupted update.
      const previous = [];
      for (const name of names.reverse()) {
        if (name.startsWith(cachePrefix) && name !== cacheName && await (await caches.open(name)).match(manifestUrl)) previous.push(name);
      }
      await Promise.all(previous.slice(1).map(name => caches.delete(name)));
    } catch { progress.persistent = false; }
  }
  notify();
  return { ...progress, failed: [...progress.failed], ready: progress.failed.length === 0, cacheName };
}

export async function registerOffline(): Promise<{ registered: boolean; reason?: string }> {
  if (!('serviceWorker' in navigator)) return { registered: false, reason: '当前浏览器不支持离线应用缓存。' };
  if (!window.isSecureContext) return { registered: false, reason: '持久离线缓存需要 HTTPS 或 localhost。' };
  if (import.meta.env.DEV) return { registered: false, reason: '开发模式跳过 Service Worker；生产构建启用。' };
  try {
    await navigator.serviceWorker.register(appUrl('/sw.js'), { scope: appBase, updateViaCache: 'none' });
    let timeout: ReturnType<typeof setTimeout> | undefined;

try {
      await Promise.race([
        (async () => {
          await navigator.serviceWorker.ready;
          if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => {
            navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
          });
        })(),
        new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('离线应用缓存尚未就绪，可联网继续并稍后重试。')), 15000); }),
      ]);
    } finally { if (timeout) clearTimeout(timeout); }
    return { registered: true };
  }
  catch (error) { return { registered: false, reason: error instanceof Error ? error.message : '离线缓存注册失败。' }; }
}
