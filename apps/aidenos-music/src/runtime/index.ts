import { MusicError } from "../domain";
import type {
  MusicRuntime,
  MusicService,
  PlaybackSource,
  PlaybackState,
  PlayMode,
  Quality,
  QueueItem,
  Track,
} from "../domain";
import { parseLyrics } from "../lyrics";

/** Small injectable boundary: the real runtime owns exactly one HTMLAudioElement. */
export interface RuntimeAudio {
  src: string;
  currentSrc?: string;
  currentTime: number;
  duration: number;
  paused: boolean;
  ended?: boolean;
  volume: number;
  muted: boolean;
  preload: string;
  playbackRate?: number;
  error?: { code: number; message?: string } | null;
  play(): Promise<void> | void;
  pause(): void;
  load?(): void;
  removeAttribute?(name: string): void;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
}

export interface RuntimeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface RuntimeMediaSession {
  metadata: MediaMetadata | null;
  playbackState: MediaSessionPlaybackState;
  setActionHandler(
    action: MediaSessionAction,
    handler: MediaSessionActionHandler | null,
  ): void;
  setPositionState?(state?: MediaPositionState): void;
}

export interface MusicRuntimeOptions {
  audio?: RuntimeAudio;
  createAudio?: () => RuntimeAudio;
  storage?: RuntimeStorage | null;
  storageKey?: string;
  mediaSession?: RuntimeMediaSession | null;
  createMetadata?: (metadata: MediaMetadataInit) => MediaMetadata;
  now?: () => number;
  random?: () => number;
  createQueueId?: () => string;
}

const STORAGE_KEY = "aiden.music.playback.v1";
const MAX_PERSISTED_QUEUE = 1_000;
const validModes: PlayMode[] = ["sequence", "shuffle", "repeat-one"];
const validQualities: Quality[] = ["standard", "higher", "exhigh", "lossless"];
const number = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, number(value)));
const abortError = (error: unknown) =>
  error instanceof Error && error.name === "AbortError";

function defaultStorage(): RuntimeStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function defaultMediaSession(): RuntimeMediaSession | null {
  try {
    return typeof navigator === "undefined"
      ? null
      : (navigator.mediaSession ?? null);
  } catch {
    return null;
  }
}

function defaultAudio(): RuntimeAudio {
  if (typeof Audio === "undefined")
    throw new Error("MusicRuntime requires an audio object outside a browser.");
  return new Audio();
}

function text(value: unknown, max = 256): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

/** Copy only public music metadata. Signed source URLs and account material cannot enter storage. */
function copyTrack(value: unknown): Track | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Partial<Track>;
  const id = text(input.id, 80),
    title = text(input.title);
  if (!id || !title || !Array.isArray(input.artists) || !input.album)
    return null;
  return {
    id,
    title,
    artists: input.artists
      .slice(0, 40)
      .map((artist) => ({
        id: text(artist.id, 80),
        name: text(artist.name),
        ...(artist.coverUrl ? { coverUrl: text(artist.coverUrl, 4096) } : {}),
      })),
    album: {
      id: text(input.album.id, 80),
      title: text(input.album.title),
      coverUrl: text(input.album.coverUrl, 4096),
    },
    durationMs: Math.max(0, number(input.durationMs)),
    coverUrl: text(input.coverUrl, 4096),
    availability: [
      "unknown",
      "full",
      "preview",
      "unavailable",
      "login_required",
    ].includes(input.availability ?? "")
      ? input.availability!
      : "unknown",
    ...(input.alias ? { alias: text(input.alias) } : {}),
  };
}

function readStored(
  storage: RuntimeStorage | null,
  key: string,
  queueId: () => string,
): Partial<PlaybackState> {
  try {
    const value = storage?.getItem(key);
    if (!value || value.length > 4_000_000) return {};
    const saved = JSON.parse(value);
    if (
      saved.version !== 1 ||
      !Array.isArray(saved.queue) ||
      saved.queue.length > MAX_PERSISTED_QUEUE
    )
      return {};
    const ids = new Set<string>();
    const queue: QueueItem[] = [];
    for (const item of saved.queue) {
      const track = copyTrack(item?.track);
      if (!track) continue;
      let id = text(item.queueId, 100) || queueId();
      while (ids.has(id)) id = queueId();
      ids.add(id);
      queue.push({ queueId: id, track });
    }
    const currentIndex = queue.length
      ? clamp(Math.trunc(number(saved.currentIndex)), 0, queue.length - 1)
      : -1;
    const currentTrack = queue[currentIndex]?.track ?? null;
    return {
      queue,
      currentIndex,
      currentTrack,
      status: currentTrack ? "paused" : "idle",
      positionMs: clamp(
        number(saved.positionMs),
        0,
        currentTrack?.durationMs || Number.MAX_SAFE_INTEGER,
      ),
      durationMs: currentTrack?.durationMs ?? 0,
      volume: clamp(number(saved.volume, 0.7), 0, 1),
      muted: saved.muted === true,
      mode: validModes.includes(saved.mode) ? saved.mode : "sequence",
      quality: validQualities.includes(saved.quality)
        ? saved.quality
        : "exhigh",
    };
  } catch {
    return {};
  }
}

function playbackError(error: unknown): MusicError {
  if (error instanceof MusicError) return error;
  if (error instanceof Error && error.name === "NotAllowedError") {
    return new MusicError(
      "forbidden",
      "浏览器暂未允许播放，请再点一次播放。",
      true,
    );
  }
  if (error instanceof Error && error.name === "NotSupportedError") {
    return new MusicError(
      "unavailable",
      "浏览器无法播放这个音频格式，请切换音质后重试。",
    );
  }
  return new MusicError(
    "network_error",
    "音乐暂时无法播放，请检查连接后重试。",
    true,
  );
}

interface StartOptions {
  positionMs?: number;
  play?: boolean;
  automatic?: boolean;
  retryCount?: number;
  qualityOverride?: Quality;
  remember?: boolean;
}

/**
 * Application views subscribe to this document-lifetime runtime; they never own its audio.
 * No visual animation loop is created here, so minimizing or hiding a view costs no RAF.
 */
export function createMusicRuntime(
  service: MusicService,
  options: MusicRuntimeOptions = {},
): MusicRuntime {
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  let idCounter = 0;
  const knownQueueIds = new Set<string>();
  const createId =
    options.createQueueId ??
    (() => {
      try {
        if (typeof crypto !== "undefined" && crypto.randomUUID)
          return crypto.randomUUID();
      } catch {
        /* local fallback */
      }
      return (
        "music-" +
        now().toString(36) +
        "-" +
        (++idCounter).toString(36) +
        "-" +
        Math.floor(random() * 0x1000000).toString(36)
      );
    });
  const queueId = () => {
    let id = createId();
    while (knownQueueIds.has(id)) id += "-" + (++idCounter).toString(36);
    knownQueueIds.add(id);
    return id;
  };
  const audio = options.audio ?? options.createAudio?.() ?? defaultAudio();
  const storage =
    options.storage === undefined ? defaultStorage() : options.storage;
  const storageKey = options.storageKey ?? STORAGE_KEY;
  const media =
    options.mediaSession === undefined
      ? defaultMediaSession()
      : options.mediaSession;
  const metadataFactory =
    options.createMetadata ??
    (typeof MediaMetadata !== "undefined"
      ? (value) => new MediaMetadata(value)
      : undefined);
  let state: PlaybackState = {
    queue: [],
    currentIndex: -1,
    currentTrack: null,
    status: "idle",
    positionMs: 0,
    durationMs: 0,
    volume: 0.7,
    muted: false,
    mode: "sequence",
    quality: "exhigh",
    source: null,
    lyrics: null,
    error: null,
    ...readStored(storage, storageKey, queueId),
  };
  for (const item of state.queue) knownQueueIds.add(item.queueId);
  let disposed = false;
  let generation = 0;
  let wantsPlaying = false;
  let sourceController: AbortController | null = null;
  let lyricsController: AbortController | null = null;
  let loadingTask: { generation: number; promise: Promise<void> } | null = null;
  let sourceRetries = 0;
  let requestedPosition = state.positionMs;
  let pendingSeek: number | null = null;
  let endedGeneration = -1;
  let lastPersistAt = -Infinity;
  let lastMediaPositionAt = -Infinity;
  let metadataKey = "";
  let shuffleHistory: string[] = [];
  let shuffleCursor = -1;
  let shuffleRemaining = new Set(state.queue.map((item) => item.queueId));
  const listeners = new Set<() => void>();
  const audioListeners: Array<[string, EventListener]> = [];
  const mediaActions: MediaSessionAction[] = [];

  audio.preload = "metadata";
  audio.volume = state.volume;
  audio.muted = state.muted;

  function persist(force = false) {
    if (!storage || (!force && now() - lastPersistAt < 2_000)) return;
    lastPersistAt = now();
    try {
      // Very large queues retain the current area rather than losing the active item.
      const start =
        state.queue.length > MAX_PERSISTED_QUEUE
          ? Math.max(0, state.currentIndex - 200)
          : 0;
      const queue = state.queue
        .slice(start, start + MAX_PERSISTED_QUEUE)
        .map((item) => ({
          queueId: item.queueId,
          track: copyTrack(item.track),
        }));
      storage.setItem(
        storageKey,
        JSON.stringify({
          version: 1,
          queue,
          currentIndex: Math.max(-1, state.currentIndex - start),
          positionMs: state.positionMs,
          volume: state.volume,
          muted: state.muted,
          mode: state.mode,
          quality: state.quality,
        }),
      );
    } catch {
      /* Playback keeps working in private browsing and when storage is full. */
    }
  }

  function syncMedia(forcePosition = false) {
    if (!media) return;
    const track = state.currentTrack;
    const key = track
      ? [
          track.id,
          track.title,
          track.coverUrl,
          track.album.title,
          ...track.artists.map((artist) => artist.name),
        ].join("\0")
      : "";
    try {
      if (metadataKey !== key) {
        metadataKey = key;
        media.metadata =
          track && metadataFactory
            ? metadataFactory({
                title: track.title,
                artist: track.artists.map((artist) => artist.name).join(" / "),
                album: track.album.title,
                artwork: track.coverUrl ? [{ src: track.coverUrl }] : [],
              })
            : null;
      }
      media.playbackState = !track
        ? "none"
        : state.status === "playing"
          ? "playing"
          : "paused";
      if (!track) {
        media.setPositionState?.();
      } else if (
        (forcePosition || now() - lastMediaPositionAt >= 1_000) &&
        state.durationMs > 0
      ) {
        lastMediaPositionAt = now();
        media.setPositionState?.({
          duration: state.durationMs / 1_000,
          position: clamp(state.positionMs, 0, state.durationMs) / 1_000,
          playbackRate: number(audio.playbackRate, 1) || 1,
        });
      }
    } catch {
      /* An unsupported or temporarily inactive system media surface is optional. */
    }
  }

  function update(
    patch: Partial<PlaybackState>,
    save: false | "force" | "throttle" = false,
    forceMedia = false,
  ) {
    if (disposed) return;
    state = { ...state, ...patch };
    if (save) persist(save === "force");
    syncMedia(forceMedia);
    for (const listener of [...listeners]) listener();
  }

  function currentSource(): boolean {
    if (disposed || !state.currentTrack || !state.source) return false;
    // A late media event from the prior resource must not affect the new selection.
    return (
      !audio.currentSrc ||
      audio.currentSrc === state.source.url ||
      (audio.src === state.source.url && audio.currentSrc === audio.src)
    );
  }

  function cancelRequests() {
    generation++;
    sourceController?.abort();
    lyricsController?.abort();
    sourceController = null;
    lyricsController = null;
    loadingTask = null;
    pendingSeek = null;
  }

  function clearAudio() {
    audio.pause();
    try {
      if (audio.removeAttribute) audio.removeAttribute("src");
      else audio.src = "";
      audio.load?.();
    } catch {
      /* Detached audio implementations may already have released their resource. */
    }
  }

  function bounds(source = state.source): [number, number] {
    if (source?.preview) return [source.preview.startMs, source.preview.endMs];
    return [
      0,
      state.durationMs > 0 ? state.durationMs : Number.MAX_SAFE_INTEGER,
    ];
  }

  function clampPosition(position: number, source = state.source): number {
    const [start, end] = bounds(source);
    return clamp(position, start, Math.max(start, end));
  }

  function mediaPosition(): number {
    return clampPosition(
      Math.max(0, number(audio.currentTime)) * 1_000 +
        (state.source?.preview?.startMs ?? 0),
    );
  }

  function applySeek(positionMs: number) {
    const position = clampPosition(positionMs);
    requestedPosition = position;
    pendingSeek = position;
    if (state.source) {
      try {
        audio.currentTime =
          Math.max(0, position - (state.source.preview?.startMs ?? 0)) / 1_000;
        pendingSeek = null;
      } catch {
        /* A not-yet-seekable source will retry on loadedmetadata. */
      }
    }
    update({ positionMs: position }, "force", true);
  }

  function rememberSelection(id: string) {
    if (shuffleHistory[shuffleCursor] !== id) {
      shuffleHistory = shuffleHistory.slice(0, shuffleCursor + 1);
      shuffleHistory.push(id);
      shuffleCursor = shuffleHistory.length - 1;
    }
    shuffleRemaining.delete(id);
  }

  function reconcileShuffle() {
    const valid = new Set(state.queue.map((item) => item.queueId));
    shuffleRemaining = new Set(
      [...shuffleRemaining].filter((id) => valid.has(id)),
    );
    shuffleHistory = shuffleHistory.filter((id) => valid.has(id));
    const currentId = state.queue[state.currentIndex]?.queueId;
    shuffleCursor = currentId ? shuffleHistory.lastIndexOf(currentId) : -1;
  }

  async function attemptPlay(myGeneration: number): Promise<void> {
    if (disposed || generation !== myGeneration || !wantsPlaying) return;
    // A completed resource can be replayed without another resolution/generation.
    endedGeneration = -1;
    try {
      await audio.play();
      if (disposed || generation !== myGeneration) return;
      if (!wantsPlaying) {
        audio.pause();
        update({ status: "paused" });
        return;
      }
      update({ status: "playing", error: null });
    } catch (error) {
      if (disposed || generation !== myGeneration) return;
      if (abortError(error) && !wantsPlaying) {
        update({ status: "paused" });
        return;
      }
      const failure = playbackError(error);
      wantsPlaying = false;
      update({
        status: failure.code === "forbidden" ? "paused" : "error",
        error: failure,
      });
      throw failure;
    }
  }

  function fetchLyrics(track: Track, myGeneration: number): Promise<void> {
    lyricsController?.abort();
    const controller = new AbortController();
    lyricsController = controller;
    return service
      .lyrics(track.id, controller.signal)
      .then((raw) => {
        if (
          !disposed &&
          generation === myGeneration &&
          !controller.signal.aborted
        ) {
          update({ lyrics: parseLyrics(raw, state.durationMs) });
        }
      })
      .catch((error) => {
        if (
          !disposed &&
          generation === myGeneration &&
          !controller.signal.aborted &&
          !abortError(error)
        ) {
          update({
            lyrics: { lines: [], instrumental: false, hasWordTiming: false },
          });
        }
      });
  }

  async function startIndex(
    index: number,
    startOptions: StartOptions = {},
  ): Promise<void> {
    if (disposed || !state.queue.length) return;
    const item =
      state.queue[clamp(Math.trunc(index), 0, state.queue.length - 1)];
    if (!item) return;
    cancelRequests();
    const myGeneration = generation;
    const controller = new AbortController();
    sourceController = controller;
    wantsPlaying = startOptions.play ?? true;
    sourceRetries = startOptions.retryCount ?? 0;
    endedGeneration = -1;
    requestedPosition = Math.max(0, number(startOptions.positionMs));
    update(
      {
        currentIndex: state.queue.findIndex(
          (queued) => queued.queueId === item.queueId,
        ),
        currentTrack: item.track,
        positionMs: requestedPosition,
        durationMs: item.track.durationMs,
        source: null,
        lyrics: null,
        error: null,
        status: wantsPlaying ? "loading" : "paused",
      },
      "force",
      true,
    );
    audio.pause();
    if (startOptions.remember !== false) rememberSelection(item.queueId);
    void fetchLyrics(item.track, myGeneration);

    const operation = (async () => {
      try {
        // The adapter owns expiry and account changes. Valid leases return from its
        // cache; renewal still requires an unlocked desktop and its CSRF token.
        await service.ensurePlaybackLease();
        if (
          disposed ||
          generation !== myGeneration ||
          controller.signal.aborted
        )
          return;
        const source = await service.resolve(
          item.track.id,
          startOptions.qualityOverride ?? state.quality,
          controller.signal,
        );
        if (
          disposed ||
          generation !== myGeneration ||
          controller.signal.aborted
        )
          return;
        if (!source.url || source.availability === "unavailable")
          throw new MusicError("unavailable", "这首歌曲暂时无法播放。");
        if (source.availability === "login_required")
          throw new MusicError(
            "authentication_required",
            "请先登录网易云音乐后播放这首歌曲。",
          );
        const durationMs = Math.max(
          item.track.durationMs,
          source.preview?.endMs ?? 0,
        );
        update({ source, durationMs, error: null });
        audio.src = source.url;
        audio.load?.();
        applySeek(requestedPosition);
        if (wantsPlaying) await attemptPlay(myGeneration);
        else update({ status: "paused" });
      } catch (error) {
        if (
          disposed ||
          generation !== myGeneration ||
          controller.signal.aborted ||
          abortError(error)
        )
          return;
        const failure = playbackError(error);
        wantsPlaying = false;
        update({
          status: failure.code === "forbidden" ? "paused" : "error",
          error: failure,
        });
        throw failure;
      }
    })();
    loadingTask = { generation: myGeneration, promise: operation };
    try {
      await operation;
    } finally {
      if (loadingTask?.generation === myGeneration) loadingTask = null;
    }
  }

  function nextIndex(automatic: boolean): number {
    const length = state.queue.length;
    if (!length) return -1;
    if (automatic && state.mode === "repeat-one") return state.currentIndex;
    if (state.mode === "shuffle") {
      const future = shuffleHistory[shuffleCursor + 1];
      if (future) {
        shuffleCursor++;
        return state.queue.findIndex((item) => item.queueId === future);
      }
      let candidates = state.queue.filter(
        (item) =>
          shuffleRemaining.has(item.queueId) &&
          item.queueId !== state.queue[state.currentIndex]?.queueId,
      );
      if (!candidates.length) {
        candidates = state.queue.filter(
          (_, index) => index !== state.currentIndex,
        );
        shuffleRemaining = new Set(candidates.map((item) => item.queueId));
      }
      if (!candidates.length) return state.currentIndex;
      const candidate =
        candidates[
          Math.floor(clamp(random(), 0, 0.999999999) * candidates.length)
        ];
      return state.queue.findIndex(
        (item) => item.queueId === candidate.queueId,
      );
    }
    if (state.currentIndex + 1 < length) return state.currentIndex + 1;
    return automatic ? -1 : 0;
  }

  function onEnded(fromPreview = false) {
    if (
      !currentSource() ||
      endedGeneration === generation ||
      (!fromPreview && audio.ended === false)
    )
      return;
    endedGeneration = generation;
    const index = nextIndex(true);
    if (index < 0) {
      wantsPlaying = false;
      audio.pause();
      update({ status: "paused", positionMs: bounds()[1] }, "force", true);
      return;
    }
    void startIndex(index, { automatic: true }).catch(() => {});
  }

  function onTimeUpdate() {
    if (!currentSource()) return;
    const positionMs = mediaPosition();
    requestedPosition = positionMs;
    update({ positionMs }, "throttle");
    const preview = state.source?.preview;
    if (preview && positionMs >= preview.endMs - 10 && wantsPlaying)
      onEnded(true);
  }

  function onMetadata() {
    if (!currentSource()) return;
    const actual = number(audio.duration) * 1_000;
    if (actual > 0) {
      const durationMs = state.source?.preview
        ? Math.max(
            state.currentTrack?.durationMs ?? 0,
            state.source.preview.endMs,
          )
        : actual;
      update({ durationMs }, false, true);
    }
    if (pendingSeek !== null) applySeek(pendingSeek);
  }

  function onAudioError() {
    if (!currentSource()) return;
    const retryExpired = state.source!.expiresAt <= now() + 1_000;
    const retryFormat =
      audio.error?.code === 4 && state.source?.quality === "lossless";
    if (sourceRetries < 1 && (retryExpired || retryFormat)) {
      void startIndex(state.currentIndex, {
        positionMs: state.positionMs,
        play: wantsPlaying,
        automatic: true,
        retryCount: 1,
        qualityOverride: retryFormat ? "standard" : undefined,
        remember: false,
      }).catch(() => {});
      return;
    }
    wantsPlaying = false;
    const failure =
      audio.error?.code === 4
        ? new MusicError(
            "unavailable",
            "浏览器无法播放这个音频格式，请切换音质。",
          )
        : new MusicError("network_error", "音频连接中断，请重试播放。", true);
    update({ status: "error", error: failure });
  }

  function bind(type: string, action: () => void) {
    const listener: EventListener = action;
    audio.addEventListener(type, listener);
    audioListeners.push([type, listener]);
  }

  bind("timeupdate", onTimeUpdate);
  bind("loadedmetadata", onMetadata);
  bind("durationchange", onMetadata);
  bind("ended", () => onEnded());
  bind("error", onAudioError);
  bind("playing", () => {
    if (currentSource() && wantsPlaying)
      update({ status: "playing", error: null });
  });
  bind("pause", () => {
    if (currentSource() && audio.paused && state.status !== "error") {
      wantsPlaying = false;
      update({ status: "paused" }, "force", true);
    }
  });
  bind("waiting", () => {
    if (currentSource() && wantsPlaying) update({ status: "loading" });
  });

  const api: MusicRuntime = {
    getSnapshot: () => state,
    subscribe(listener) {
      if (disposed) return () => {};
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async playTracks(tracks, index = 0) {
      if (disposed) return;
      const queue = tracks
        .map((track) => copyTrack(track))
        .filter((track): track is Track => !!track)
        .map((track) => ({ queueId: queueId(), track }));
      if (!queue.length) {
        api.clear();
        return;
      }
      shuffleHistory = [];
      shuffleCursor = -1;
      shuffleRemaining = new Set(queue.map((item) => item.queueId));
      update({ queue });
      await startIndex(clamp(Math.trunc(index), 0, queue.length - 1));
    },
    async togglePlay() {
      if (
        state.status === "playing" ||
        (state.status === "loading" && wantsPlaying)
      )
        api.pause();
      else await api.resume();
    },
    async resume() {
      if (disposed || !state.currentTrack) return;
      wantsPlaying = true;
      if (loadingTask?.generation === generation) {
        update({ status: "loading", error: null });
        await loadingTask.promise;
        return;
      }
      if (
        !state.source ||
        state.source.expiresAt <= now() ||
        state.status === "error"
      ) {
        await startIndex(state.currentIndex, { positionMs: state.positionMs });
      } else {
        const [start, end] = bounds();
        if (state.positionMs >= end - 10) applySeek(start);
        update({ status: "loading", error: null });
        await attemptPlay(generation);
      }
    },
    pause() {
      if (disposed) return;
      wantsPlaying = false;
      audio.pause();
      if (state.currentTrack) update({ status: "paused" }, "force", true);
    },
    seek(positionMs) {
      if (!disposed && state.currentTrack) applySeek(positionMs);
    },
    async next() {
      if (!disposed && state.queue.length) await startIndex(nextIndex(false));
    },
    async previous() {
      if (disposed || !state.queue.length) return;
      const [start] = bounds();
      if (state.positionMs - start > 3_000) {
        api.seek(start);
        return;
      }
      if (state.mode === "shuffle" && shuffleCursor > 0) {
        shuffleCursor--;
        const previousId = shuffleHistory[shuffleCursor];
        const index = state.queue.findIndex(
          (item) => item.queueId === previousId,
        );
        if (index >= 0) {
          await startIndex(index, { remember: false });
          return;
        }
      }
      await startIndex(
        (state.currentIndex - 1 + state.queue.length) % state.queue.length,
      );
    },
    enqueue(tracks, next = false) {
      if (disposed) return;
      const incoming = tracks
        .map((track) => copyTrack(track))
        .filter((track): track is Track => !!track)
        .map((track) => ({ queueId: queueId(), track }));
      if (!incoming.length) return;
      const queue = state.queue.slice();
      const index =
        next && state.currentIndex >= 0 ? state.currentIndex + 1 : queue.length;
      queue.splice(index, 0, ...incoming);
      for (const item of incoming) shuffleRemaining.add(item.queueId);
      if (!state.currentTrack) {
        update(
          {
            queue,
            currentIndex: 0,
            currentTrack: queue[0].track,
            durationMs: queue[0].track.durationMs,
            positionMs: 0,
            status: "paused",
            error: null,
          },
          "force",
          true,
        );
      } else update({ queue }, "force");
    },
    remove(id) {
      if (disposed) return;
      const index = state.queue.findIndex((item) => item.queueId === id);
      if (index < 0) return;
      const activeId = state.queue[state.currentIndex]?.queueId;
      const queue = state.queue.filter((item) => item.queueId !== id);
      if (!queue.length) {
        api.clear();
        return;
      }
      if (id !== activeId) {
        update(
          {
            queue,
            currentIndex: queue.findIndex((item) => item.queueId === activeId),
          },
          "force",
        );
        reconcileShuffle();
        return;
      }
      const wasPlaying = wantsPlaying;
      cancelRequests();
      const next = Math.min(index, queue.length - 1);
      update(
        {
          queue,
          currentIndex: next,
          currentTrack: queue[next].track,
          positionMs: 0,
          durationMs: queue[next].track.durationMs,
          source: null,
          lyrics: null,
          error: null,
          status: "paused",
        },
        "force",
        true,
      );
      wantsPlaying = false;
      clearAudio();
      reconcileShuffle();
      if (wasPlaying)
        void startIndex(next, { automatic: true }).catch(() => {});
    },
    move(id, delta) {
      if (disposed || !Number.isFinite(delta)) return;
      const index = state.queue.findIndex((item) => item.queueId === id);
      if (index < 0) return;
      const target = clamp(
        index + Math.trunc(delta),
        0,
        state.queue.length - 1,
      );
      if (index === target) return;
      const activeId = state.queue[state.currentIndex]?.queueId;
      const queue = state.queue.slice();
      const [item] = queue.splice(index, 1);
      queue.splice(target, 0, item);
      update(
        {
          queue,
          currentIndex: queue.findIndex(
            (queued) => queued.queueId === activeId,
          ),
        },
        "force",
      );
      reconcileShuffle();
    },
    clear() {
      if (disposed) return;
      cancelRequests();
      wantsPlaying = false;
      shuffleHistory = [];
      shuffleCursor = -1;
      shuffleRemaining.clear();
      update(
        {
          queue: [],
          currentIndex: -1,
          currentTrack: null,
          source: null,
          lyrics: null,
          positionMs: 0,
          durationMs: 0,
          status: "idle",
          error: null,
        },
        "force",
        true,
      );
      clearAudio();
    },
    setVolume(value) {
      if (disposed || !Number.isFinite(value)) return;
      const volume = clamp(value, 0, 1);
      audio.volume = volume;
      if (volume > 0) audio.muted = false;
      update({ volume, muted: volume > 0 ? false : state.muted }, "force");
    },
    setMuted(muted) {
      if (!disposed) {
        audio.muted = muted;
        update({ muted }, "force");
      }
    },
    setMode(mode) {
      if (disposed || !validModes.includes(mode)) return;
      shuffleHistory = [];
      shuffleCursor = -1;
      shuffleRemaining = new Set(state.queue.map((item) => item.queueId));
      const currentId = state.queue[state.currentIndex]?.queueId;
      if (currentId) rememberSelection(currentId);
      update({ mode }, "force");
    },
    setQuality(quality) {
      if (
        disposed ||
        !validQualities.includes(quality) ||
        state.quality === quality
      )
        return;
      const play = wantsPlaying;
      update({ quality }, "force");
      if (state.source && state.currentTrack)
        void startIndex(state.currentIndex, {
          positionMs: state.positionMs,
          play,
          remember: false,
        }).catch(() => {});
    },
    async refreshLyrics() {
      if (!disposed && state.currentTrack)
        await fetchLyrics(state.currentTrack, generation);
    },
    resetAccount() {
      if (disposed) return;
      api.clear();
      service.invalidate();
      try {
        storage?.removeItem(storageKey);
      } catch {
        /* private mode */
      }
    },
    dispose() {
      if (disposed) return;
      persist(true);
      cancelRequests();
      disposed = true;
      wantsPlaying = false;
      for (const [type, listener] of audioListeners)
        audio.removeEventListener(type, listener);
      clearAudio();
      listeners.clear();
      if (media) {
        for (const action of mediaActions) {
          try {
            media.setActionHandler(action, null);
          } catch {
            /* optional action */
          }
        }
        try {
          media.metadata = null;
          media.playbackState = "none";
          media.setPositionState?.();
        } catch {
          /* optional API */
        }
      }
    },
  };

  if (media) {
    const handlers: Partial<
      Record<MediaSessionAction, MediaSessionActionHandler>
    > = {
      play: () => {
        void api.resume().catch(() => {});
      },
      pause: () => api.pause(),
      stop: () => {
        api.pause();
        api.seek(bounds()[0]);
      },
      previoustrack: () => {
        void api.previous().catch(() => {});
      },
      nexttrack: () => {
        void api.next().catch(() => {});
      },
      seekto: (details) => {
        if (typeof details.seekTime === "number")
          api.seek(details.seekTime * 1_000);
      },
      seekbackward: (details) =>
        api.seek(state.positionMs - (details.seekOffset ?? 10) * 1_000),
      seekforward: (details) =>
        api.seek(state.positionMs + (details.seekOffset ?? 10) * 1_000),
    };
    for (const [action, handler] of Object.entries(handlers)) {
      try {
        media.setActionHandler(action as MediaSessionAction, handler!);
        mediaActions.push(action as MediaSessionAction);
      } catch {
        /* Unsupported browser actions are skipped individually. */
      }
    }
  }
  syncMedia(true);
  return api;
}
