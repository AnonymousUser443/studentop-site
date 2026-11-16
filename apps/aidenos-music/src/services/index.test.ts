import { describe, it, expect, vi } from "vitest";
import { createMusicService } from "./index";
import { MusicError } from "../domain";

const ok = (data: unknown) =>
  new Response(JSON.stringify({ ok: true, data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
const csrf = "c".repeat(64),
  playbackCsrf = "p".repeat(64).replace(/p/g, "a");
const source = {
  url: "https://m8.music.126.net/music.mp3",
  expiresAt: 100000,
  quality: "standard",
  availability: "full",
  preview: null,
};
const emptyHome = {
  featured: [],
  recommended: [],
  tracks: [],
  personalized: false,
};
const commentPage = (trackId = "1", offset = 0) => ({
  trackId, items: [], hot: [], total: 10000, offset, limit: 20,
  hasMore: true, nextBefore: 1700000000000 - offset,
});

describe("music service transport", () => {
  it("deduplicates reads, caches per generation, and invalidates after a library write", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) =>
      String(input) === "/__desktop/auth"
        ? new Response(JSON.stringify({ authenticated: true, csrfToken: csrf }))
        : ok(String(input).endsWith("/likes") ? null : emptyHome),
    );
    const service = createMusicService({ fetcher });
    const [a, b] = await Promise.all([service.home(), service.home()]);
    expect(a).toEqual(b);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await service.home();
    expect(fetcher).toHaveBeenCalledTimes(1);
    await service.setLike("10", true);
    await service.home();
    expect(fetcher).toHaveBeenCalledTimes(4);
    const apiCall = fetcher.mock.calls.find((call) =>
      String(call[0]).endsWith("/likes"),
    );
    expect(apiCall).toBeDefined();
  });

  it("cancels only the subscriber that left and stops transport once all consumers leave", async () => {
    let complete: (response: Response) => void = () => {};
    let transportSignal: AbortSignal | null = null;
    const fetcher = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((resolve, reject) => {
          complete = resolve;
          transportSignal = init?.signal as AbortSignal;
          transportSignal.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        }),
    );
    const service = createMusicService({ fetcher }),
      first = new AbortController(),
      second = new AbortController();
    const a = service.home(first.signal),
      b = service.home(second.signal),
      rejected = expect(a).rejects.toMatchObject({ name: "AbortError" });
    await Promise.resolve();
    first.abort();
    expect(transportSignal!.aborted).toBe(false);
    complete(ok(emptyHome));
    await rejected;
    expect(await b).toEqual(emptyHome);
    expect(fetcher).toHaveBeenCalledTimes(1);
    service.invalidate();
    const only = new AbortController(),
      last = service.home(only.signal),
      lastRejected = expect(last).rejects.toMatchObject({ name: "AbortError" });
    await Promise.resolve();
    only.abort();
    await lastRejected;
    expect(transportSignal!.aborted).toBe(true);
  });

  it("requests desktop CSRF for writes but uses only a cached playback capability when resolving locked", async () => {
    let time = 1000;
    const fetcher = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/__desktop/auth")
          return new Response(
            JSON.stringify({ authenticated: true, csrfToken: csrf }),
          );
        if (url.endsWith("/playback/lease"))
          return ok({ csrfToken: playbackCsrf, expiresAt: 50000 });
        if (url.endsWith("/playback/resolve")) {
          expect(new Headers(init?.headers).get("X-Desktop-CSRF")).toBe(null);
          expect(new Headers(init?.headers).get("X-Music-Playback-CSRF")).toBe(
            playbackCsrf,
          );
          return ok(source);
        }
        return ok(null);
      },
    );
    const service = createMusicService({ fetcher, now: () => time });
    await Promise.all([
      service.ensurePlaybackLease(),
      service.ensurePlaybackLease(),
    ]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    await service.resolve("1", "standard");
    await service.ensurePlaybackLease();
    await service.resolve("2", "standard");
    expect(fetcher).toHaveBeenCalledTimes(4);
    time = 50001;
    await expect(service.resolve("1", "standard")).rejects.toMatchObject({
      code: "lease_expired",
    });
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("refuses renewal while desktop is locked and never automatically retries a failed write", async () => {
    const locked = vi.fn(
      async () =>
        new Response(JSON.stringify({ authenticated: false, csrfToken: csrf })),
    );
    const service = createMusicService({ fetcher: locked });
    await expect(service.ensurePlaybackLease()).rejects.toMatchObject({
      code: "authentication_required",
    });
    expect(locked).toHaveBeenCalledTimes(1);
    const fetcher = vi.fn(async (input: RequestInfo | URL) =>
      String(input) === "/__desktop/auth"
        ? new Response(JSON.stringify({ authenticated: true, csrfToken: csrf }))
        : new Response(
            JSON.stringify({
              ok: false,
              error: {
                code: "forbidden",
                message: "无法编辑",
                retryable: false,
              },
            }),
            { status: 200 },
          ),
    );
    const writes = createMusicService({ fetcher });
    await expect(writes.createPlaylist("海", "private")).rejects.toMatchObject({
      code: "forbidden",
      message: "无法编辑",
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("login changes clear cached guest results and invalidate an earlier playback capability", async () => {
    let homeCalls = 0;
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/__desktop/auth")
        return new Response(
          JSON.stringify({ authenticated: true, csrfToken: csrf }),
        );
      if (url.endsWith("/playback/lease"))
        return ok({
          csrfToken: playbackCsrf,
          expiresAt: Date.now() + 12 * 3600000,
        });
      if (url.endsWith("/home")) {
        homeCalls += 1;
        return ok(emptyHome);
      }
      if (url.includes("/auth/qr/"))
        return ok({
          status: "authorized",
          session: {
            authenticated: true,
            user: { id: "99", name: "听者", avatarUrl: "" },
          },
        });
      return ok(null);
    });
    const service = createMusicService({ fetcher });
    await service.home();
    await service.ensurePlaybackLease();
    await service.checkQr("challenge");
    await service.home();
    expect(homeCalls).toBe(2);
    await expect(service.resolve("1", "standard")).rejects.toMatchObject({
      code: "lease_expired",
    });
  });

  it("keeps business failure codes, maps network failure, and rejects malformed envelopes", async () => {
    const expired = createMusicService({
      fetcher: async () =>
        new Response(
          JSON.stringify({
            ok: false,
            error: {
              code: "login_expired",
              message: "重新扫码",
              retryable: false,
            },
          }),
          { status: 401 },
        ),
    });
    await expect(expired.library()).rejects.toMatchObject({
      code: "login_expired",
    });
    const unavailable = createMusicService({
      fetcher: async () => {
        throw new TypeError("network");
      },
    });
    await expect(unavailable.home()).rejects.toBeInstanceOf(MusicError);
    await expect(unavailable.home()).rejects.toMatchObject({
      code: "network_error",
      retryable: true,
    });
    const malformed = createMusicService({
      fetcher: async () => new Response('{"ok":true}'),
    });
    await expect(malformed.home()).rejects.toMatchObject({
      code: "upstream_error",
    });
  });

  it("an already aborted signal does not issue a request", async () => {
    const fetcher = vi.fn(async () => ok(emptyHome)),
      service = createMusicService({ fetcher }),
      controller = new AbortController();
    controller.abort();
    await expect(
      service.search("海", "tracks", 0, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("deduplicates cloud, comment and heart-mode reads through the same-origin account adapter", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.credentials).toBe("same-origin");expect(init?.cache).toBe("no-store");
      expect(new Headers(init?.headers).get("Cookie")).toBe(null);
      const url = String(input);
      if (url.includes("/comments/")) return ok(commentPage());
      return ok(url.includes("/cloud?") ? { items: [], total: 0, offset: 50, limit: 50, hasMore: false } : []);
    });
    const service = createMusicService({ fetcher });
    await Promise.all([service.cloud(50), service.cloud(50), service.comments("1"), service.comments("1"), service.heartMode("1", "101"), service.heartMode("1", "101")]);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls.map((call) => String(call[0])).sort()).toEqual([
      "/__desktop/music/v1/cloud?offset=50", "/__desktop/music/v1/comments/1?offset=0", "/__desktop/music/v1/heart-mode?trackId=1&playlistId=101",
    ]);
  });

  it("stores deep comment time cursors only in account memory and clears them on invalidation", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "https://test.invalid");
      return ok(commentPage("1", Number(url.searchParams.get("offset"))));
    });
    const service = createMusicService({ fetcher });
    await service.comments("1", 4980);await service.comments("1", 5000);
    expect(String(fetcher.mock.calls[1][0])).toBe("/__desktop/music/v1/comments/1?offset=5000&before=1699999995020");
    await service.comments("1", 5000);expect(fetcher).toHaveBeenCalledTimes(2);
    service.invalidate();
    await expect(service.comments("1", 5000)).rejects.toMatchObject({ code: "invalid_request" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("late comment responses cannot seed another account's cursor or cache", async () => {
    let userId = "11", complete: (response: Response) => void = () => {};
    const fetcher = vi.fn((input: RequestInfo | URL) => {
      if (String(input).endsWith("/session")) return Promise.resolve(ok({ authenticated: true, user: { id: userId, name: "测试听者", avatarUrl: "" } }));
      return new Promise<Response>((resolve) => { complete = resolve; });
    });
    const service = createMusicService({ fetcher });await service.session();
    const pending = service.comments("1", 4980), rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await Promise.resolve();userId = "22";await service.session();complete(ok(commentPage("1", 4980)));await rejected;
    await expect(service.comments("1", 5000)).rejects.toMatchObject({ code: "invalid_request" });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("liking a deep-page comment refreshes cached state and preserves the next time cursor", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/__desktop/auth") return new Response(JSON.stringify({ authenticated: true, csrfToken: csrf }));
      if (init?.method === "POST") return ok(null);
      const url = new URL(String(input), "https://test.invalid");
      return ok(commentPage("1", Number(url.searchParams.get("offset"))));
    });
    const service = createMusicService({ fetcher });
    await service.comments("1", 4980);await service.comments("1", 5000);
    await service.setCommentLike("1", "701", true);
    await service.comments("1", 5020);
    expect(String(fetcher.mock.calls.at(-1)![0])).toBe("/__desktop/music/v1/comments/1?offset=5020&before=1699999995000");
    await service.comments("1", 5000);
    expect(fetcher).toHaveBeenCalledTimes(6);
    expect(String(fetcher.mock.calls.at(-1)![0])).toBe("/__desktop/music/v1/comments/1?offset=5000&before=1699999995020");
    await service.sendComment("1", "发送后回到第一页");
    await expect(service.comments("1", 5040)).rejects.toMatchObject({ code: "invalid_request" });
  });

  it("comment likes, sends and replies need fresh desktop CSRF and invalidate cached comment reads", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/__desktop/auth") return new Response(JSON.stringify({ authenticated: true, csrfToken: csrf }));
      if (init?.method === "GET") return ok(commentPage());
      expect(new Headers(init?.headers).get("X-Desktop-CSRF")).toBe(csrf);
      expect(new Headers(init?.headers).get("X-Music-Playback-CSRF")).toBe(null);
      return ok(null);
    });
    const service = createMusicService({ fetcher });
    await service.comments("1");await service.comments("1");expect(fetcher).toHaveBeenCalledTimes(1);
    await service.setCommentLike("1", "701", true);expect(fetcher).toHaveBeenCalledTimes(3);
    await service.comments("1");expect(fetcher).toHaveBeenCalledTimes(4);
    await service.sendComment("1", "  潮声\r\n还在  ");await service.sendComment("1", "回你一句", "701");
    const writes = fetcher.mock.calls.filter((call) => call[1]?.method === "POST");
    expect(writes.map((call) => [String(call[0]), JSON.parse(String(call[1]?.body))])).toEqual([
      ["/__desktop/music/v1/comments/1/like", { commentId: "701", liked: true }],
      ["/__desktop/music/v1/comments/1", { content: "潮声\n还在" }],
      ["/__desktop/music/v1/comments/1", { content: "回你一句", replyTo: "701" }],
    ]);
  });

  it("invalid community parameters never issue transport requests", async () => {
    const fetcher = vi.fn(async () => ok(null)), service = createMusicService({ fetcher });
    const operations: Array<() => Promise<unknown>> = [
      () => service.cloud(-1), () => service.cloud(0.5), () => service.comments("bad"),
      () => service.setCommentLike("1", "0", true), () => service.sendComment("1", " "),
      () => service.sendComment("1", "x".repeat(501)), () => service.sendComment("1", "x\0"),
      () => service.sendComment("1", "reply", "bad"), () => service.heartMode("1", "bad"),
    ];
    for (const operation of operations) await expect(Promise.resolve().then(operation)).rejects.toMatchObject({ code: "invalid_request" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("locked comments cannot write, and nested business failures never trigger an automatic resend", async () => {
    const locked = vi.fn(async () => new Response(JSON.stringify({ authenticated: false, csrfToken: csrf })));
    const service = createMusicService({ fetcher: locked });
    await expect(service.sendComment("1", "海")).rejects.toMatchObject({ code: "authentication_required" });
    expect(locked).toHaveBeenCalledTimes(1);
    const fetcher = vi.fn(async (input: RequestInfo | URL) => String(input) === "/__desktop/auth"
      ? new Response(JSON.stringify({ authenticated: true, csrfToken: csrf }))
      : new Response(JSON.stringify({ ok: false, error: { code: "forbidden", message: "无法发送", retryable: false } }), { status: 200 }));
    await expect(createMusicService({ fetcher }).sendComment("1", "一次提交")).rejects.toMatchObject({ code: "forbidden" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
