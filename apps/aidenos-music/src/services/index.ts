import { MusicError } from "../domain";
import type {
  MusicService,
  MusicSession,
  QrChallenge,
  QrStatus,
  HomeData,
  SearchResult,
  SearchType,
  PlaylistDetail,
  AlbumDetail,
  ArtistDetail,
  LibraryData,
  Playlist,
  RawLyrics,
  Quality,
  PlaybackSource,
  MusicErrorCode,
} from "../domain";

interface ServiceOptions {
  baseUrl?: string;
  fetcher?: typeof fetch;
  now?: () => number;
}
interface Lease {
  csrfToken: string;
  expiresAt: number;
}
interface Subscriber {
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  signal?: AbortSignal;
  onAbort?: () => void;
}
interface Pending {
  controller: AbortController;
  subscribers: Set<Subscriber>;
  generation: number;
}
const codes = new Set<MusicErrorCode>([
  "authentication_required",
  "login_expired",
  "unavailable",
  "rate_limited",
  "upstream_error",
  "network_error",
  "invalid_request",
  "forbidden",
  "lease_expired",
]);
const aborted = () =>
  new DOMException("The operation was aborted.", "AbortError");
const isAbort = (error: unknown) =>
  error instanceof Error && error.name === "AbortError";

/** The only browser-facing music transport. UI and player code never know upstream endpoints/cookies. */
export function createMusicService(options: ServiceOptions = {}): MusicService {
  const base = (options.baseUrl ?? "/__desktop/music/v1").replace(/\/$/, "");
  const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis),
    now = options.now ?? Date.now;
  const cache = new Map<string, { value: unknown; expiresAt: number }>(),
    pending = new Map<string, Pending>();
  let generation = 0,
    accountId: string | null = null,
    lease: Lease | null = null,
    leasePending: Promise<void> | null = null;
  const rejectInvalid = (): never => {
    throw new MusicError(
      "upstream_error",
      "音乐服务返回了无法识别的内容，请稍后重试。",
      true,
    );
  };
  const changeAccount = (id: string | null) => {
    if (id === accountId) return;
    invalidate();
    lease = null;
    accountId = id;
  };
  function invalidate() {
    generation += 1;
    cache.clear();
    for (const item of pending.values()) item.controller.abort();
    pending.clear();
  }
  async function response<T>(path: string, init: RequestInit): Promise<T> {
    let result: Response;
    try {
      result = await fetcher(base + "/" + path, {
        ...init,
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json", ...init.headers },
      });
    } catch (error) {
      if (isAbort(error)) throw error;
      throw new MusicError(
        "network_error",
        "连接不到音乐服务，请检查网络后重试。",
        true,
      );
    }
    let envelope: unknown;
    try {
      envelope = await result.json();
    } catch {
      throw new MusicError(
        "upstream_error",
        "音乐服务暂时没有返回有效内容。",
        true,
      );
    }
    if (!envelope || typeof envelope !== "object") return rejectInvalid();
    const value = envelope as {
      ok?: unknown;
      data?: T;
      error?: { code?: unknown; message?: unknown; retryable?: unknown };
    };
    if (value.ok !== true || !result.ok) {
      const code =
        typeof value.error?.code === "string" &&
        codes.has(value.error.code as MusicErrorCode)
          ? (value.error.code as MusicErrorCode)
          : result.status === 401
            ? "authentication_required"
            : result.status === 403
              ? "forbidden"
              : result.status === 429
                ? "rate_limited"
                : "upstream_error";
      if (code === "lease_expired") lease = null;
      if (code === "login_expired") {
        accountId = null;
        lease = null;
        generation += 1;
        cache.clear();
      }
      const fallback =
        code === "authentication_required"
          ? "请先解锁桌面或扫码登录。"
          : code === "lease_expired"
            ? "播放授权已到期，请解锁桌面后继续。"
            : "音乐服务暂不可用，请稍后重试。";
      throw new MusicError(
        code,
        typeof value.error?.message === "string"
          ? value.error.message.slice(0, 500)
          : fallback,
        value.error?.retryable === true,
      );
    }
    if (!Object.hasOwn(value, "data")) return rejectInvalid();
    return value.data as T;
  }
  /** Each consumer can cancel independently; the shared fetch stops once no consumer needs it. */
  function read<T>(path: string, signal?: AbortSignal, ttl = 0): Promise<T> {
    if (signal?.aborted) return Promise.reject(aborted());
    const key = generation + ":" + path,
      cached = cache.get(key);
    if (cached && cached.expiresAt > now())
      return Promise.resolve(cached.value as T);
    if (cached) cache.delete(key);
    let request = pending.get(key);
    if (!request) {
      request = {
        controller: new AbortController(),
        subscribers: new Set(),
        generation,
      };
      pending.set(key, request);
      const owned = request;
      // Defer until the first subscriber has joined, including already-resolved test transports.
      void Promise.resolve()
        .then(() =>
          response<T>(path, { method: "GET", signal: owned.controller.signal }),
        )
        .then(
          (value) => {
            if (owned.generation === generation && ttl > 0) {
              for (const [storedKey, entry] of cache)
                if (entry.expiresAt <= now()) cache.delete(storedKey);
              cache.set(key, { value, expiresAt: now() + ttl });
              while (cache.size > 96) cache.delete(cache.keys().next().value!);
            }
            for (const subscriber of owned.subscribers) {
              subscriber.signal?.removeEventListener(
                "abort",
                subscriber.onAbort!,
              );
              subscriber.resolve(value);
            }
          },
          (error) => {
            for (const subscriber of owned.subscribers) {
              subscriber.signal?.removeEventListener(
                "abort",
                subscriber.onAbort!,
              );
              subscriber.reject(error);
            }
          },
        )
        .finally(() => {
          owned.subscribers.clear();
          if (pending.get(key) === owned) pending.delete(key);
        });
    }
    const owned = request;
    return new Promise<T>((resolve, reject) => {
      const subscriber: Subscriber = {
        resolve: resolve as (value: unknown) => void,
        reject,
        signal,
      };
      subscriber.onAbort = () => {
        owned.subscribers.delete(subscriber);
        reject(aborted());
        if (owned.subscribers.size === 0) {
          owned.controller.abort();
          if (pending.get(key) === owned) pending.delete(key);
        }
      };
      owned.subscribers.add(subscriber);
      signal?.addEventListener("abort", subscriber.onAbort, { once: true });
      if (signal?.aborted) subscriber.onAbort();
    });
  }
  async function desktopCsrf(signal?: AbortSignal) {
    let result: Response;
    try {
      result = await fetcher("/__desktop/auth", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        signal,
        headers: { Accept: "application/json" },
      });
    } catch (error) {
      if (isAbort(error)) throw error;
      throw new MusicError("network_error", "连接不到桌面登录服务。", true);
    }
    let body: { authenticated?: boolean; csrfToken?: string };
    try {
      body = await result.json();
    } catch {
      throw new MusicError("authentication_required", "请解锁桌面后继续。");
    }
    if (
      !result.ok ||
      body.authenticated !== true ||
      typeof body.csrfToken !== "string" ||
      !body.csrfToken
    )
      throw new MusicError("authentication_required", "请解锁桌面后继续。");
    return body.csrfToken;
  }
  async function write<T>(
    path: string,
    body: unknown = {},
    method = "POST",
    signal?: AbortSignal,
    changesData = true,
  ): Promise<T> {
    const csrf = await desktopCsrf(signal);
    const data = await response<T>(path, {
      method,
      signal,
      headers: { "Content-Type": "application/json", "X-Desktop-CSRF": csrf },
      body: JSON.stringify(body),
    });
    if (changesData) invalidate();
    return data;
  }
  function validSession(value: MusicSession): MusicSession {
    if (
      !value ||
      typeof value.authenticated !== "boolean" ||
      (value.authenticated &&
        (!value.user || typeof value.user.id !== "string"))
    )
      return rejectInvalid();
    changeAccount(value.authenticated ? value.user!.id : null);
    return value;
  }
  return {
    async session(signal) {
      return validSession(await read<MusicSession>("session", signal));
    },
    async logout() {
      await write<void>("session", {}, "DELETE");
      changeAccount(null);
      lease = null;
    },
    createQr(signal) {
      return write<QrChallenge>("auth/qr", {}, "POST", signal, false);
    },
    async checkQr(id, signal) {
      const value = await read<QrStatus>(
        "auth/qr/" + encodeURIComponent(id),
        signal,
      );
      if (
        !value ||
        !["waiting", "scanned", "authorized", "expired"].includes(value.status)
      )
        return rejectInvalid();
      if (value.status === "authorized") {
        if (!value.session) return rejectInvalid();
        validSession(value.session);
        lease = null;
      }
      return value;
    },
    home(signal) {
      return read<HomeData>("home", signal, 45000);
    },
    search(query, type: SearchType, offset = 0, signal) {
      return read<SearchResult>(
        "search?" +
          new URLSearchParams({ q: query, type, offset: String(offset) }),
        signal,
        45000,
      );
    },
    playlist(id, offset = 0, signal) {
      return read<PlaylistDetail>(
        "playlists/" + encodeURIComponent(id) + "?offset=" + offset,
        signal,
        30000,
      );
    },
    album(id, signal) {
      return read<AlbumDetail>(
        "albums/" + encodeURIComponent(id),
        signal,
        300000,
      );
    },
    artist(id, signal) {
      return read<ArtistDetail>(
        "artists/" + encodeURIComponent(id),
        signal,
        300000,
      );
    },
    library(signal) {
      return read<LibraryData>("library", signal, 15000);
    },
    async setLike(trackId, liked) {
      await write("likes", { trackId, liked });
    },
    createPlaylist(name, privacy) {
      return write<Playlist>("playlists", { name, privacy });
    },
    async editPlaylistTracks(id, op, trackIds) {
      await write("playlists/" + encodeURIComponent(id) + "/tracks", {
        op,
        trackIds,
      });
    },
    lyrics(id, signal) {
      return read<RawLyrics>(
        "lyrics/" + encodeURIComponent(id),
        signal,
        30 * 60000,
      );
    },
    ensurePlaybackLease() {
      if (lease && lease.expiresAt > now() + 5000) return Promise.resolve();
      if (leasePending) return leasePending;
      leasePending = write<Lease>(
        "playback/lease",
        {},
        "POST",
        undefined,
        false,
      )
        .then((value) => {
          if (
            !value ||
            typeof value.csrfToken !== "string" ||
            !/^[a-f0-9]{64}$/.test(value.csrfToken) ||
            !Number.isFinite(value.expiresAt) ||
            value.expiresAt <= now()
          )
            return rejectInvalid();
          lease = value;
        })
        .finally(() => {
          leasePending = null;
        });
      return leasePending;
    },
    async resolve(id, quality: Quality, signal) {
      if (!lease || lease.expiresAt <= now())
        throw new MusicError(
          "lease_expired",
          "播放授权已到期，请解锁桌面后继续。",
        );
      const value = await response<PlaybackSource>("playback/resolve", {
        method: "POST",
        signal,
        headers: {
          "Content-Type": "application/json",
          "X-Music-Playback-CSRF": lease.csrfToken,
        },
        body: JSON.stringify({ id, quality }),
      });
      if (
        !value ||
        typeof value.url !== "string" ||
        !value.url.startsWith("https://") ||
        !Number.isFinite(value.expiresAt)
      )
        return rejectInvalid();
      return value;
    },
    invalidate,
  };
}
