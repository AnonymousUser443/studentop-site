import { afterEach, describe, expect, it, vi } from "vitest";
import { MusicError } from "../domain";
import type { MusicService, PlaybackSource, RawLyrics, Track } from "../domain";
import { createMusicRuntime } from "./index";
import type {
  MusicRuntimeOptions,
  RuntimeMediaSession,
  RuntimeStorage,
} from "./index";
import { createMusicService } from "../services";

class FakeAudio extends EventTarget {
  src = "";
  get currentSrc() {
    return this.src;
  }
  currentTime = 0;
  duration = 120;
  paused = true;
  ended = false;
  volume = 1;
  muted = false;
  preload = "";
  playbackRate = 1;
  error: { code: number; message?: string } | null = null;
  playError: Error | null = null;
  playCount = 0;
  pauseCount = 0;
  loadCount = 0;
  async play() {
    this.playCount++;
    if (this.playError) throw this.playError;
    this.paused = false;
    this.ended = false;
    this.dispatchEvent(new Event("playing"));
  }
  pause() {
    this.pauseCount++;
    const changed = !this.paused;
    this.paused = true;
    if (changed) this.dispatchEvent(new Event("pause"));
  }
  load() {
    this.loadCount++;
  }
  removeAttribute(name: string) {
    if (name === "src") this.src = "";
  }
  tick(seconds: number) {
    this.currentTime = seconds;
    this.dispatchEvent(new Event("timeupdate"));
  }
  end() {
    this.paused = true;
    this.ended = true;
    this.dispatchEvent(new Event("ended"));
  }
}

class MemoryStorage implements RuntimeStorage {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

const track = (id: string): Track => ({
  id,
  title: "歌曲 " + id,
  artists: [{ id: "artist", name: "歌手" }],
  album: {
    id: "album",
    title: "专辑",
    coverUrl: "https://p1.music.126.net/cover.jpg",
  },
  durationMs: 120_000,
  coverUrl: "https://p1.music.126.net/cover.jpg",
  availability: "unknown",
});
const emptyLyrics: RawLyrics = {
  lrc: "",
  yrc: "",
  translation: "",
  romanization: "",
  instrumental: true,
};
const source = (
  id: string,
  patch: Partial<PlaybackSource> = {},
): PlaybackSource => ({
  url: "https://m1.music.126.net/" + id + ".mp3?signature=private-source",
  expiresAt: 1_000_000,
  quality: "exhigh",
  availability: "full",
  preview: null,
  ...patch,
});
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const flush = async () => {
  for (let index = 0; index < 12; index++) await Promise.resolve();
};

function setup(
  patch: Partial<MusicService> = {},
  options: MusicRuntimeOptions = {},
) {
  const audio = (options.audio as FakeAudio) ?? new FakeAudio();
  const service = {
    ensurePlaybackLease: vi.fn(async () => {}),
    resolve: vi.fn(async (id: string) => source(id)),
    lyrics: vi.fn(async () => emptyLyrics),
    invalidate: vi.fn(),
    ...patch,
  } as unknown as MusicService;
  const runtime = createMusicRuntime(service, {
    audio,
    storage: null,
    mediaSession: null,
    now: () => 10_000,
    ...options,
  });
  cleanups.push(() => runtime.dispose());
  return { runtime, audio, service };
}
const cleanups: Array<() => void> = [];
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
});

describe("MusicRuntime", () => {
  it("keeps exactly one audio object, rejects stale resolution and checks the service lease before each resolution", async () => {
    const first = deferred<PlaybackSource>(),
      second = deferred<PlaybackSource>();
    const signals: AbortSignal[] = [];
    const { runtime, audio, service } = setup({
      resolve: vi.fn((id, _quality, signal) => {
        signals.push(signal!);
        return id === "a" ? first.promise : second.promise;
      }),
    });
    const old = runtime.playTracks([track("a")]);
    await flush();
    const next = runtime.playTracks([track("b")]);
    await flush();
    expect(signals[0].aborted).toBe(true);
    second.resolve(source("b"));
    await next;
    first.resolve(source("a"));
    await old;
    expect(audio.src).toBe(source("b").url);
    expect(audio.playCount).toBe(1);
    expect(runtime.getSnapshot().currentTrack?.id).toBe("b");
    expect(service.ensurePlaybackLease).toHaveBeenCalledTimes(2);
  });

  it("supports duplicate queue items, enqueue-next, move and removing the current item without replacing the audio", async () => {
    const { runtime, audio } = setup();
    await runtime.playTracks([track("a"), track("a"), track("c")]);
    const before = runtime.getSnapshot();
    expect(new Set(before.queue.map((item) => item.queueId)).size).toBe(3);
    runtime.enqueue([track("b")], true);
    expect(runtime.getSnapshot().queue.map((item) => item.track.id)).toEqual([
      "a",
      "b",
      "a",
      "c",
    ]);
    runtime.move(runtime.getSnapshot().queue[0].queueId, 2);
    expect(runtime.getSnapshot().currentIndex).toBe(2);
    expect(before.queue.map((item) => item.track.id)).toEqual(["a", "a", "c"]);
    runtime.remove(runtime.getSnapshot().queue[2].queueId);
    await flush();
    expect(runtime.getSnapshot().currentTrack?.id).toBe("c");
    expect(audio.src).toBe(source("c").url);
  });

  it("pause while resolving stays paused; closing a subscriber does not pause the engine", async () => {
    const pending = deferred<PlaybackSource>();
    const { runtime, audio } = setup({ resolve: vi.fn(() => pending.promise) });
    const listener = vi.fn();
    const unsubscribe = runtime.subscribe(listener);
    const playing = runtime.playTracks([track("a")]);
    await flush();
    runtime.pause();
    pending.resolve(source("a"));
    await playing;
    expect(audio.playCount).toBe(0);
    expect(runtime.getSnapshot().status).toBe("paused");
    await runtime.resume();
    unsubscribe();
    const calls = listener.mock.calls.length;
    audio.tick(5);
    expect(audio.paused).toBe(false);
    expect(runtime.getSnapshot().positionMs).toBe(5000);
    expect(listener).toHaveBeenCalledTimes(calls);
  });

  it("maps preview audio onto the original lyric timeline, clamps seeks and advances when the clip ends", async () => {
    const { runtime, audio } = setup({
      resolve: vi.fn(async (id) =>
        source(
          id,
          id === "a"
            ? {
                availability: "preview",
                preview: { startMs: 30_000, endMs: 60_000 },
              }
            : {},
        ),
      ),
    });
    await runtime.playTracks([track("a"), track("b")]);
    expect(runtime.getSnapshot().positionMs).toBe(30_000);
    expect(audio.currentTime).toBe(0);
    runtime.seek(10_000);
    expect(runtime.getSnapshot().positionMs).toBe(30_000);
    runtime.seek(45_000);
    expect(audio.currentTime).toBe(15);
    audio.tick(30);
    await flush();
    expect(runtime.getSnapshot().currentTrack?.id).toBe("b");
  });

  it("sequence ends, repeat-one repeats and shuffle visits distinct queue identities before restarting", async () => {
    const { runtime, audio } = setup({}, { random: () => 0 });
    await runtime.playTracks([track("a")]);
    audio.end();
    expect(runtime.getSnapshot().status).toBe("paused");
    runtime.setMode("repeat-one");
    await runtime.resume();
    audio.end();
    await flush();
    expect(runtime.getSnapshot().status).toBe("playing");
    expect(runtime.getSnapshot().currentTrack?.id).toBe("a");
    expect(audio.playCount).toBe(3);
    await runtime.playTracks([track("a"), track("b"), track("c")]);
    runtime.setMode("shuffle");
    await runtime.next();
    expect(runtime.getSnapshot().currentTrack?.id).toBe("b");
    await runtime.next();
    expect(runtime.getSnapshot().currentTrack?.id).toBe("c");
    await runtime.previous();
    expect(runtime.getSnapshot().currentTrack?.id).toBe("b");
    await runtime.next();
    expect(runtime.getSnapshot().currentTrack?.id).toBe("c");
  });

  it("processes the second end after a completed source is replayed without resolving it again", async () => {
    const { runtime, audio, service } = setup();
    await runtime.playTracks([track("a")]);
    audio.end();
    expect(runtime.getSnapshot().status).toBe("paused");
    await runtime.resume();
    expect(audio.playCount).toBe(2);
    expect(service.resolve).toHaveBeenCalledTimes(1);
    audio.end();
    expect(runtime.getSnapshot().status).toBe("paused");
    expect(runtime.getSnapshot().positionMs).toBe(120_000);
  });

  it("persists public metadata and progress, restores paused and never stores source URLs or lease material", async () => {
    const storage = new MemoryStorage();
    const { runtime, audio } = setup({}, { storage });
    await runtime.playTracks([track("a")]);
    runtime.setVolume(0.35);
    runtime.setMode("repeat-one");
    audio.tick(22);
    runtime.pause();
    const serialized = storage.getItem("aiden.music.playback.v1")!;
    expect(serialized).not.toContain("private-source");
    expect(serialized).not.toContain("expiresAt");
    const restored = setup({}, { storage });
    expect(restored.runtime.getSnapshot()).toMatchObject({
      status: "paused",
      positionMs: 22_000,
      volume: 0.35,
      mode: "repeat-one",
      source: null,
    });
    expect(restored.audio.playCount).toBe(0);
    await restored.runtime.resume();
    expect(restored.audio.currentTime).toBe(22);
  });

  it("autoplay rejection stays paused with a useful error and can recover on explicit play", async () => {
    const audio = new FakeAudio();
    audio.playError = Object.assign(new Error("gesture required"), {
      name: "NotAllowedError",
    });
    const { runtime } = setup({}, { audio });
    await expect(runtime.playTracks([track("a")])).rejects.toMatchObject({
      code: "forbidden",
    });
    expect(runtime.getSnapshot()).toMatchObject({
      status: "paused",
      error: { code: "forbidden" },
    });
    audio.playError = null;
    await runtime.resume();
    expect(runtime.getSnapshot()).toMatchObject({
      status: "playing",
      error: null,
    });
  });

  it("refreshes an expired source at most once and surfaces lease rejection without a retry loop", async () => {
    let now = 10_000;
    const { runtime, audio, service } = setup(
      {
        resolve: vi.fn(async (id) => source(id, { expiresAt: now + 100 })),
      },
      { now: () => now },
    );
    await runtime.playTracks([track("a")]);
    now += 200;
    audio.error = { code: 2 };
    audio.dispatchEvent(new Event("error"));
    await flush();
    expect(service.resolve).toHaveBeenCalledTimes(2);
    now += 200;
    audio.dispatchEvent(new Event("error"));
    await flush();
    expect(service.resolve).toHaveBeenCalledTimes(2);
    expect(runtime.getSnapshot().status).toBe("error");

    const denied = setup({
      resolve: vi.fn(async (id) => {
        if (id === "b")
          throw new MusicError("lease_expired", "unlock required");
        return source(id);
      }),
    });
    await denied.runtime.playTracks([track("a"), track("b")]);
    denied.audio.end();
    await flush();
    expect(denied.runtime.getSnapshot().error?.code).toBe("lease_expired");
    expect(denied.service.ensurePlaybackLease).toHaveBeenCalledTimes(2);
  });

  it("guards system media actions and clears account-linked state, cookies cache and media metadata on reset", async () => {
    const actions = new Map<
      MediaSessionAction,
      MediaSessionActionHandler | null
    >();
    const media: RuntimeMediaSession = {
      metadata: null,
      playbackState: "none",
      setActionHandler: (action, handler) => {
        actions.set(action, handler);
      },
      setPositionState: vi.fn(),
    };
    const storage = new MemoryStorage();
    const { runtime, audio, service } = setup(
      {},
      {
        storage,
        mediaSession: media,
        createMetadata: (init) => init as MediaMetadata,
      },
    );
    await runtime.playTracks([track("a"), track("b")]);
    expect(media.metadata?.title).toBe("歌曲 a");
    actions.get("pause")?.({ action: "pause" });
    expect(runtime.getSnapshot().status).toBe("paused");
    actions.get("seekto")?.({ action: "seekto", seekTime: 8 });
    expect(audio.currentTime).toBe(8);
    actions.get("nexttrack")?.({ action: "nexttrack" });
    await flush();
    expect(media.metadata?.title).toBe("歌曲 b");
    runtime.resetAccount();
    expect(runtime.getSnapshot()).toMatchObject({
      status: "idle",
      queue: [],
      source: null,
      lyrics: null,
    });
    expect(storage.getItem("aiden.music.playback.v1")).toBeNull();
    expect(media.metadata).toBeNull();
    expect(media.playbackState).toBe("none");
    expect(service.invalidate).toHaveBeenCalledTimes(1);
    runtime.dispose();
    expect([...actions.values()].every((handler) => handler === null)).toBe(
      true,
    );
    expect(media.setPositionState).toHaveBeenLastCalledWith();
    expect(audio.src).toBe("");
    expect(audio.paused).toBe(true);
  });

  it("aborts final teardown requests and cannot resurrect audio or media state from delayed responses", async () => {
    const pendingSource = deferred<PlaybackSource>(),
      pendingLyrics = deferred<RawLyrics>();
    const signals: AbortSignal[] = [];
    const actions = new Map<
      MediaSessionAction,
      MediaSessionActionHandler | null
    >();
    const media: RuntimeMediaSession = {
      metadata: null,
      playbackState: "none",
      setActionHandler: (action, handler) => {
        actions.set(action, handler);
      },
      setPositionState: vi.fn(),
    };
    const { runtime, audio } = setup(
      {
        resolve: vi.fn((_id, _quality, signal) => {
          signals.push(signal!);
          return pendingSource.promise;
        }),
        lyrics: vi.fn((_id, signal) => {
          signals.push(signal!);
          return pendingLyrics.promise;
        }),
      },
      { mediaSession: media, createMetadata: (init) => init as MediaMetadata },
    );
    const loading = runtime.playTracks([track("a")]);
    await flush();
    const listener = vi.fn();
    runtime.subscribe(listener);
    runtime.dispose();
    expect(signals).toHaveLength(2);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    pendingSource.resolve(source("a"));
    pendingLyrics.resolve({
      ...emptyLyrics,
      instrumental: false,
      lrc: "[00:01.00]late",
    });
    await loading;
    await flush();
    expect(audio.playCount).toBe(0);
    expect(audio.src).toBe("");
    expect(listener).not.toHaveBeenCalled();
    expect(media.metadata).toBeNull();
    expect(media.playbackState).toBe("none");
    expect([...actions.values()].every((handler) => handler === null)).toBe(
      true,
    );
  });

  it("ignores stale lyric responses and tolerates denied storage", async () => {
    const first = deferred<RawLyrics>();
    const { runtime } = setup(
      {
        lyrics: vi.fn((id) =>
          id === "a"
            ? first.promise
            : Promise.resolve({
                ...emptyLyrics,
                instrumental: false,
                lrc: "[00:00.00]new lyric",
              }),
        ),
      },
      {
        storage: {
          getItem: () => {
            throw new Error("private");
          },
          setItem: () => {
            throw new Error("quota");
          },
          removeItem: () => {
            throw new Error("private");
          },
        },
      },
    );
    await runtime.playTracks([track("a"), track("b")]);
    await runtime.next();
    first.resolve({
      ...emptyLyrics,
      instrumental: false,
      lrc: "[00:00.00]old lyric",
    });
    await flush();
    expect(runtime.getSnapshot().lyrics?.lines[0].text).toBe("new lyric");
    runtime.resetAccount();
  });

  it("refreshes lyrics after an unlock without interrupting playback or labelling an error as instrumental", async () => {
    const fetch = vi
      .fn<MusicService["lyrics"]>()
      .mockRejectedValueOnce(
        new MusicError("authentication_required", "locked"),
      )
      .mockResolvedValueOnce({
        ...emptyLyrics,
        instrumental: false,
        lrc: "[00:01.00]after unlock",
      });
    const { runtime, audio } = setup({ lyrics: fetch });
    await runtime.playTracks([track("a")]);
    await flush();
    expect(runtime.getSnapshot().lyrics).toEqual({
      lines: [],
      instrumental: false,
      hasWordTiming: false,
    });
    const sourceUrl = audio.src;
    audio.tick(8);
    await runtime.refreshLyrics();
    expect(runtime.getSnapshot().lyrics?.lines[0].text).toBe("after unlock");
    expect(runtime.getSnapshot().positionMs).toBe(8000);
    expect(audio.src).toBe(sourceUrl);
    expect(audio.playCount).toBe(1);
  });

  it("keeps parsed lyrics and queue references stable across audio clock updates", async () => {
    const { runtime, audio, service } = setup({
      lyrics: vi.fn(async () => ({
        ...emptyLyrics,
        instrumental: false,
        yrc: "[1000,2000](1000,1000,0)潮(2000,1000,0)声",
      })),
    });
    await runtime.playTracks([track("a")]);
    await flush();
    const { lyrics, queue } = runtime.getSnapshot();
    expect(lyrics?.hasWordTiming).toBe(true);
    for (let seconds = 0; seconds < 10; seconds += 0.25) {
      audio.tick(seconds);
      expect(runtime.getSnapshot().lyrics).toBe(lyrics);
      expect(runtime.getSnapshot().queue).toBe(queue);
    }
    expect(service.lyrics).toHaveBeenCalledTimes(1);
  });

  it("unmutes when a positive volume is chosen and keeps snapshots stable between events", async () => {
    const { runtime, audio } = setup();
    await runtime.playTracks([track("a")]);
    const snapshot = runtime.getSnapshot();
    expect(runtime.getSnapshot()).toBe(snapshot);
    runtime.setMuted(true);
    runtime.setVolume(0.4);
    expect(runtime.getSnapshot()).toMatchObject({ muted: false, volume: 0.4 });
    expect(audio.muted).toBe(false);
    expect(snapshot.muted).toBe(false);
    expect(snapshot.volume).toBe(0.7);
  });

  it("ignores queued stale pause/end events after a new source starts, but accepts a genuine buffering pause", async () => {
    const { runtime, audio } = setup();
    await runtime.playTracks([track("a"), track("b")]);
    await runtime.next();
    audio.dispatchEvent(new Event("pause"));
    audio.dispatchEvent(new Event("ended"));
    expect(runtime.getSnapshot()).toMatchObject({
      status: "playing",
      currentIndex: 1,
    });
    audio.dispatchEvent(new Event("waiting"));
    expect(runtime.getSnapshot().status).toBe("loading");
    audio.pause();
    expect(runtime.getSnapshot().status).toBe("paused");
  });

  it("allocates distinct queue identities even after restoring storage or when an injected id source repeats", () => {
    const storage = new MemoryStorage();
    const first = setup({}, { storage, createQueueId: () => "same" });
    first.runtime.enqueue([track("a"), track("a")]);
    const second = setup({}, { storage, createQueueId: () => "same" });
    second.runtime.enqueue([track("a")]);
    const ids = second.runtime.getSnapshot().queue.map((item) => item.queueId);
    expect(new Set(ids).size).toBe(3);
  });

  it("repairs repeated persisted queue identities without losing duplicate songs or auto-starting", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "aiden.music.playback.v1",
      JSON.stringify({
        version: 1,
        queue: [
          { queueId: "same", track: track("a") },
          { queueId: "same", track: track("a") },
          { queueId: "same-1", track: track("b") },
        ],
        currentIndex: 2,
        positionMs: 8_000,
      }),
    );
    const { runtime, audio } = setup(
      {},
      { storage, createQueueId: () => "same" },
    );
    expect(runtime.getSnapshot().queue.map((item) => item.track.id)).toEqual([
      "a",
      "a",
      "b",
    ]);
    expect(
      new Set(runtime.getSnapshot().queue.map((item) => item.queueId)).size,
    ).toBe(3);
    expect(runtime.getSnapshot()).toMatchObject({
      currentIndex: 2,
      currentTrack: { id: "b" },
      positionMs: 8_000,
      status: "paused",
      source: null,
    });
    expect(audio.playCount).toBe(0);
  });
});

describe("MusicRuntime with the real service adapter", () => {
  const leaseDuration = 12 * 60 * 60 * 1_000;

  function integrated() {
    const control = { now: 10_000, locked: false };
    const calls = { auth: 0, lease: 0, resolve: 0 };
    const audio = new FakeAudio();
    const ok = (data: unknown) =>
      new Response(JSON.stringify({ ok: true, data }), { status: 200 });
    const denied = () =>
      new Response(
        JSON.stringify({
          ok: false,
          error: {
            code: "authentication_required",
            message: "unlock required",
          },
        }),
        { status: 401 },
      );
    let playbackCsrf = "",
      expiresAt = 0;
    const service = createMusicService({
      now: () => control.now,
      fetcher: async (input, init) => {
        const url = String(input);
        if (url === "/__desktop/auth") {
          calls.auth++;
          return new Response(
            JSON.stringify({
              authenticated: !control.locked,
              ...(!control.locked ? { csrfToken: "desktop-csrf" } : {}),
            }),
          );
        }
        if (url.endsWith("/playback/lease")) {
          calls.lease++;
          if (control.locked) return denied();
          expect(new Headers(init?.headers).get("X-Desktop-CSRF")).toBe(
            "desktop-csrf",
          );
          playbackCsrf = (calls.lease === 1 ? "a" : "b").repeat(64);
          expiresAt = control.now + leaseDuration;
          return ok({ csrfToken: playbackCsrf, expiresAt });
        }
        if (url.endsWith("/playback/resolve")) {
          calls.resolve++;
          const headers = new Headers(init?.headers);
          expect(headers.get("X-Desktop-CSRF")).toBeNull();
          expect(headers.get("X-Music-Playback-CSRF")).toBe(playbackCsrf);
          expect(expiresAt).toBeGreaterThan(control.now);
          const body = JSON.parse(String(init?.body)) as { id: string };
          return ok(source(body.id, { expiresAt: control.now + 60_000 }));
        }
        if (url.includes("/lyrics/"))
          return control.locked ? denied() : ok(emptyLyrics);
        throw new Error("Unexpected test transport route: " + url);
      },
    });
    const runtime = createMusicRuntime(service, {
      audio,
      storage: null,
      mediaSession: null,
      now: () => control.now,
    });
    cleanups.push(() => runtime.dispose());
    return { runtime, audio, control, calls };
  }

  it("renews an expired 12 hour lease on the first unlocked manual playback action", async () => {
    const { runtime, control, calls } = integrated();
    await runtime.playTracks([track("a"), track("b")]);
    expect(calls).toEqual({ auth: 1, lease: 1, resolve: 1 });
    control.now += leaseDuration + 1;
    await runtime.next();
    expect(runtime.getSnapshot()).toMatchObject({
      status: "playing",
      currentTrack: { id: "b" },
      error: null,
    });
    expect(calls).toEqual({ auth: 2, lease: 2, resolve: 2 });
  });

  it("uses a valid cached lease while locked, refuses expired automatic playback and resumes after unlock", async () => {
    const { runtime, audio, control, calls } = integrated();
    await runtime.playTracks([track("a"), track("b"), track("c")]);
    control.locked = true;
    audio.end();
    await vi.waitFor(() =>
      expect(runtime.getSnapshot()).toMatchObject({
        status: "playing",
        currentTrack: { id: "b" },
      }),
    );
    expect(calls).toEqual({ auth: 1, lease: 1, resolve: 2 });
    expect(audio.playCount).toBe(2);

    control.now += leaseDuration + 1;
    audio.end();
    await vi.waitFor(() =>
      expect(runtime.getSnapshot()).toMatchObject({
        status: "error",
        currentTrack: { id: "c" },
        error: { code: "authentication_required" },
      }),
    );
    expect(calls).toEqual({ auth: 2, lease: 1, resolve: 2 });
    expect(audio.playCount).toBe(2);

    control.locked = false;
    await runtime.resume();
    expect(runtime.getSnapshot()).toMatchObject({
      status: "playing",
      currentTrack: { id: "c" },
      error: null,
    });
    expect(calls).toEqual({ auth: 3, lease: 2, resolve: 3 });
  });

  it("cannot mint a first lease or start audio from a locked queue without prior authorization", async () => {
    const { runtime, audio, control, calls } = integrated();
    control.locked = true;
    runtime.enqueue([track("a")]);
    await expect(runtime.resume()).rejects.toMatchObject({
      code: "authentication_required",
    });
    expect(calls).toEqual({ auth: 1, lease: 0, resolve: 0 });
    expect(audio.playCount).toBe(0);
    expect(runtime.getSnapshot().source).toBeNull();
  });
});
