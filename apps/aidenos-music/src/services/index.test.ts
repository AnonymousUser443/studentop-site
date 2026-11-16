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
});
