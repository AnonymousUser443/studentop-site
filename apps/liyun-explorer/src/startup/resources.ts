import { photoURL } from '../../shared/published.mjs';

export type Asset = { url: string; bytes: number; sha256: string };
export type Manifest = { format: 1; version: string; assets: Asset[] };
const RELEASES = '/assets/releases/';
const SHELL = 'liyun-shell-v1';
const MEDIA = 'liyun-public-media-v1';
const MANIFESTS = 'liyun-manifests-v1';
const VERSION = /^[a-f0-9]{24}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const REUSABLE = /\.(?:webp|png|jpg|jpeg|svg|avif|woff2?|ttf|otf|mp3|opus|ogg|wav)$/;
const PRECACHE = { 'X-Liyun-Precache': '1' };

export function validateManifest(value: unknown, version: string): value is Manifest {
  const m = value as Manifest;
  const prefix = RELEASES + version + '/';
  return !!m && VERSION.test(version) && m.format === 1 && m.version === version &&
    Array.isArray(m.assets) && m.assets.length < 1000 &&
    m.assets.every(a => a && typeof a.url === 'string' && a.url.startsWith(prefix) &&
      /^[\w./-]+$/.test(a.url.slice(prefix.length)) && !a.url.includes('..') &&
      Number.isSafeInteger(a.bytes) && a.bytes >= 0 && DIGEST.test(a.sha256)) &&
    new Set(m.assets.map(a => a.url)).size === m.assets.length;
}

async function each<T>(items: readonly T[], concurrency: number, task: (item: T) => Promise<void>) {
  let next = 0, stopped = false;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (!stopped && next < items.length) {
      try { await task(items[next++]); }
      catch (error) { stopped = true; throw error; }
    }
  }));
}

function prepareWorker(): Promise<boolean> {
  const worker = navigator.serviceWorker;
  if (!worker) return Promise.resolve(false);
  if (worker.controller && navigator.onLine === false) return Promise.resolve(true);
  const registration = worker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => null);
  if (worker.controller) return Promise.resolve(true);
  // The initial claim can happen while the pack downloads; do not block those downloads
  // on registration. Before rendering, allow at most the remainder of this same budget.
  return new Promise(resolve => {
    const finish = (controlled: boolean) => {
      clearTimeout(timeout);
      worker.removeEventListener('controllerchange', onControl);
      resolve(controlled);
    };
    const onControl = () => { if (worker.controller) finish(true); };
    const timeout = setTimeout(() => finish(false), 3000);
    worker.addEventListener('controllerchange', onControl);
    void registration.then(result => result ? onControl() : finish(false));
  });
}

const request = (url: string, cache: RequestCache, milliseconds: number) =>
  fetch(url, { cache, headers: PRECACHE, credentials: 'omit', signal: AbortSignal.timeout(milliseconds) });

async function sha256(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n =>
    n.toString(16).padStart(2, '0')).join('');
}

async function verified(response: Response | undefined, hash?: string, size?: number) {
  if (!response || response.status !== 200) return;
  let bytes: ArrayBuffer;
  try { bytes = await response.arrayBuffer(); } catch { return; }
  if (size !== undefined ? bytes.byteLength !== size : !bytes.byteLength) return;
  if (hash && await sha256(bytes) !== hash) return;
  return bytes;
}

function cacheBody(response: Response, bytes: ArrayBuffer) {
  const headers = new Headers(response.headers);
  headers.delete('Content-Encoding');
  headers.set('Content-Length', String(bytes.byteLength));
  return new Response(bytes, { status: 200, headers });
}

function isPublicPhoto(response: Response | undefined, immutable: boolean) {
  if (!response || response.status !== 200 || !/^image\/webp(?:;|$)/i.test(response.headers.get('Content-Type') ?? '')) return false;
  const control = response.headers.get('Cache-Control') ?? '';
  if (/\b(?:private|no-store)\b/i.test(control)) return false;
  return !immutable || (/\bpublic\b/i.test(control) && /\bimmutable\b/i.test(control));
}

function versionOfManifest(url: string) {
  return /^\/assets\/releases\/([a-f0-9]{24})\/precache\.json$/.exec(new URL(url).pathname)?.[1];
}

export async function prepareResources(
  progress: (fraction: number, label: string) => void,
  publicationReady: Promise<void> = Promise.resolve(),
) {
  const version = document.querySelector<HTMLMetaElement>('meta[name=liyun-release]')?.content;
  if (!version) { await publicationReady; progress(1, '校园地图已就绪'); return { warm: false }; }
  if (!VERSION.test(version)) throw Error('资源版本不一致，请重新载入');

  const controller = prepareWorker();
  const storage = globalThis.caches;
  let persistent = Boolean(storage), fetchedAssets = 0;
  const safeStorage = async <T,>(op: () => Promise<T>) => {
    try { return await op(); } catch { persistent = false; return undefined; }
  };
  const opening = new Map<string, Promise<Cache | undefined>>();
  const open = (name: string) => {
    if (!storage) return Promise.resolve(undefined);
    if (!opening.has(name)) opening.set(name, safeStorage(() => storage.open(name)));
    return opening.get(name)!;
  };
  const match = (cache: Cache | undefined, url: RequestInfo) => safeStorage(async () => cache?.match(url));
  const write = (cache: Cache | undefined, url: string, response: Response) =>
    safeStorage(async () => cache?.put(url, response));

  const manifestURL = RELEASES + version + '/precache.json';
  const [cache, meta] = await Promise.all([open('liyun-assets-' + version), open(MANIFESTS)]);
  const cachedManifest = await (await match(meta, manifestURL))?.json().catch(() => null);
  const manifestHit = validateManifest(cachedManifest, version);
  const readManifest = async (mode: RequestCache) => {
    const response = await request(manifestURL, mode, 15000);
    if (!response.ok) throw Error('资源清单暂不可用');
    return response.json().catch(() => null) as Promise<unknown>;
  };
  // HTML selects a content-addressed version. A complete manifest with that exact
  // version is immutable; fetching it again would make warm entry depend on the network.
  let manifest: unknown = manifestHit ? cachedManifest : await readManifest('no-cache');
  // During the one-time worker upgrade, an older controller may still intercept a
  // normal request. Reload forces it to leave a corrupt candidate unread.
  if (!validateManifest(manifest, version)) manifest = await readManifest('reload');
  if (!validateManifest(manifest, version)) throw Error('资源版本不一致，请重新载入');

  let reuseIndex: Promise<Map<string, { url: string; version: string }>> | undefined;
  const reusable = () => reuseIndex ??= (async () => {
    const index = new Map<string, { url: string; version: string }>();
    const keys = await safeStorage(async () => meta?.keys());
    for (const key of keys ?? []) {
      const previous = versionOfManifest(key.url);
      if (!previous || previous === version) continue;
      const old = await (await match(meta, key))?.json().catch(() => null);
      if (!validateManifest(old, previous)) continue;
      for (const asset of old.assets) if (REUSABLE.test(asset.url)) index.set(asset.sha256, { url: asset.url, version: previous });
    }
    return index;
  })();
  const total = Math.max(1, manifest.assets.reduce((sum, asset) => sum + asset.bytes, 0));
  let completed = 0, lastReported = -1;
  const loadAsset = async (asset: Asset) => {
    let source = await match(cache, asset.url);
    let alreadyStored = Boolean(source);
    const prior = !source ? (await reusable()).get(asset.sha256) : undefined;
    if (prior) source = await match(await open('liyun-assets-' + prior.version), prior.url);
    if (!source) { fetchedAssets++; source = await request(asset.url, 'force-cache', 60000); }
    let bytes = await verified(source, asset.sha256, asset.bytes);
    if (!bytes) {
      // An HTTP cache hit can also be damaged. The reload bypasses both stores.
      if (alreadyStored && cache) await safeStorage(() => cache.delete(asset.url));
      fetchedAssets++;
      source = await request(asset.url, 'reload', 60000);
      bytes = await verified(source, asset.sha256, asset.bytes);
      if (!bytes) {
        // An older controlling worker may have written its network response first.
        if (cache) await safeStorage(() => cache.delete(asset.url));
        // If the manifest itself was corrupted, let a retry recover it from the origin.
        if (manifestHit && meta) await safeStorage(() => meta.delete(manifestURL));
        throw Error('资源校验失败，请重试');
      }
      alreadyStored = false;
    }
    // Persist only new or repaired entries. Rewriting freshly verified warm hits
    // was serializing the entire pack to disk on every load.
    if (cache && !alreadyStored) await write(cache, asset.url, cacheBody(source, bytes));
    completed += asset.bytes;
    const fraction = completed / total;
    const percent = Math.floor(fraction * 96);
    if (percent !== lastReported) {
      lastReported = percent;
      progress(.96 * fraction, fetchedAssets ? '正在收集校园的色彩与声音' : '正在展开已珍藏的山水');
    }
  };

  const preparePhotos = async () => {
    await publicationReady;
    const publication = window.__LIYUN_CONTENT__;
    // Authenticated draft images must never enter a public or offline cache.
    if (!publication || new URLSearchParams(location.search).has('contentPreview')) return;
    const urls = [...new Set(publication.document.sites.flatMap(site => site.photos.map(p => photoURL(p.id))))];
    if (!urls.length) return;
    const media = await open(MEDIA);
    await each(urls, 3, async url => {
      const hash = /\/media\/([a-f0-9]{64})\.webp$/.exec(url)?.[1];
      let saved = await match(media, url);
      if (hash) {
        if (isPublicPhoto(saved, true) && await verified(saved, hash)) return;
        if (media && saved) await safeStorage(() => media.delete(url));
        let response = await request(url, 'force-cache', 30000);
        let bytes = isPublicPhoto(response, true) ? await verified(response, hash) : undefined;
        if (!bytes) {
          response = await request(url, 'reload', 30000);
          bytes = isPublicPhoto(response, true) ? await verified(response, hash) : undefined;
        }
        if (!bytes) {
          if (media) await safeStorage(() => media.delete(url));
          throw Error('地标照片校验失败，请重试');
        }
        if (media) await write(media, url, cacheBody(response, bytes));
        return;
      }
      // Seed art has stable URLs but can change on the server. Check online first,
      // retain a verified body for offline refresh, and avoid writing unchanged art.
      if (navigator.onLine === false && isPublicPhoto(saved, false)) {
        if (await verified(saved, saved?.headers.get('X-Liyun-SHA256') ?? undefined)) return;
        saved = undefined;
      }
      let response: Response;
      try {
        response = await request(url, 'no-cache', 8000);
        if (response.status >= 500) throw Error('地标照片暂不可用');
      } catch (error) {
        if (isPublicPhoto(saved, false) && await verified(saved, saved?.headers.get('X-Liyun-SHA256') ?? undefined)) return;
        throw error;
      }
      const bytes = isPublicPhoto(response, false) ? await verified(response) : undefined;
      if (!bytes) throw Error('地标照片加载失败，请重试');
      if (media) {
        const digest = await sha256(bytes);
        if (isPublicPhoto(saved, false) && await verified(saved, digest, bytes.byteLength)) return;
        const stored = cacheBody(response, bytes);
        stored.headers.set('X-Liyun-SHA256', digest);
        await write(media, url, stored);
      }
    });
  };

  // Start large immutable files early to reduce the last-download tail.
  await Promise.all([
    each([...manifest.assets].sort((a, b) => b.bytes - a.bytes), 4, loadAsset),
    preparePhotos(),
  ]);
  progress(.98, '正在整理山水手札');

  const commitManifest = async (shellReady: boolean) => {
    if (!meta || !persistent || manifestHit) return;
    await write(meta, manifestURL, new Response(JSON.stringify(manifest), { headers: { 'Content-Type': 'application/json' } }));
    if (!persistent || !shellReady) return;
    // Keep the current entry plus two others (including when rolling back).
    const keys = (await safeStorage(() => meta.keys()))?.filter(key => !!versionOfManifest(key.url)) ?? [];
    const current = new URL(manifestURL, location.origin).href;
    const others = keys.filter(key => key.url !== current);
    for (const key of others.slice(0, Math.max(0, others.length - 2))) {
      await safeStorage(() => storage.delete('liyun-assets-' + versionOfManifest(key.url)));
      await safeStorage(() => meta.delete(key));
    }
  };
  const commitShell = async () => {
    // Never replace the last offline shell until the corresponding asset pack is
    // valid. On a warm visit skip the duplicate HTML request entirely.
    if (!storage || !persistent) return false;
    const shell = await open(SHELL);
    if (!shell) return false;
    const marker = '<meta name="liyun-release" content="' + version + '">';
    const saved = await match(shell, '/');
    if (saved && (await saved.text().catch(() => '')).includes(marker)) return true;
    try {
      const response = await fetch('/', { cache: 'no-cache', signal: AbortSignal.timeout(10000) });
      const bytes = await verified(response);
      if (persistent && bytes && new TextDecoder().decode(bytes).includes(marker)) {
        await write(shell, '/', cacheBody(response, bytes));
        return persistent;
      }
    } catch { /* The current online run still works. */ }
    return false;
  };

  const [shellReady, controlled] = await Promise.all([commitShell(), controller, document.fonts.ready]);
  await commitManifest(shellReady);
  const offlineReady = (controlled || !!navigator.serviceWorker?.controller) && shellReady && persistent;
  progress(1, offlineReady ? '山水已备齐，下次从本机展开' : '山水已备齐，本次使用浏览器缓存');
  return { warm: fetchedAssets === 0 };
}
