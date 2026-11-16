import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createMusicServer, PREFIX } from "./app.mjs";
import {
  MusicStore,
  LEASE_TTL,
  SESSION_COOKIE,
  PLAYBACK_COOKIE,
} from "./store.mjs";

const GATEWAY = "test-gateway-secret-".repeat(3),
  KEY = "b".repeat(64);
const image = "https://p1.music.126.net/test/album.jpg";
const rawSong = (id = 1) => ({
  id,
  name: "潮生 " + id,
  ar: [{ id: 2, name: "歌手" }],
  al: { id: 3, name: "专辑", picUrl: image },
  dt: 180000,
  upstreamSecret: "NEVER_FORWARD",
});
const rawPlaylist = (id = "101", owner = "11", extra = {}) => ({
  id,
  name: "夜航",
  coverImgUrl: image,
  creator: { userId: owner, nickname: "听者 " + owner },
  trackCount: 72,
  playCount: 1200,
  tags: ["夜"],
  description: "沿着潮水听下去",
  ...extra,
});
function fakeSdk() {
  const calls = [];
  let keys = 0;
  const result = (body, cookie = []) => ({
    status: 200,
    body: { code: 200, ...body },
    cookie,
  });
  const methods = {
    login_qr_key: () => result({ data: { unikey: "key-" + ++keys } }),
    login_qr_create: () =>
      result({ data: { qrimg: "data:image/png;base64,aGVsbG8=" } }),
    login_qr_check: (p) => ({
      status: 200,
      body: { code: 803, cookie: "UPSTREAM_COOKIE_MUST_STAY_PRIVATE" },
      cookie: [
        `MUSIC_U=VERY_PRIVATE_TOKEN_${p.key}; Path=/; HttpOnly`,
        `__csrf=upstream-private-csrf; Path=/`,
      ],
    }),
    user_account: (p) =>
      result({
        account: { id: p.cookie.MUSIC_U?.endsWith("key-2") ? 22 : 11 },
        profile: {
          userId: p.cookie.MUSIC_U?.endsWith("key-2") ? 22 : 11,
          nickname: "听潮用户",
          avatarUrl: image,
        },
      }),
    top_playlist: () => result({ playlists: [rawPlaylist()] }),
    personalized: () => result({ result: [rawPlaylist("202")] }),
    recommend_resource: () => result({ recommend: [rawPlaylist("303")] }),
    recommend_songs: () => result({ data: { dailySongs: [rawSong()] } }),
    personalized_newsong: () => result({ result: [{ song: rawSong() }] }),
    cloudsearch: (p) =>
      result({
        result:
          p.type === 1
            ? { songs: [rawSong()], songCount: 72 }
            : p.type === 1000
              ? { playlists: [rawPlaylist()], playlistCount: 1 }
              : p.type === 10
                ? { albums: [rawSong().al], albumCount: 1 }
                : {
                    artists: [{ id: 2, name: "歌手", picUrl: image }],
                    artistCount: 1,
                  },
      }),
    playlist_detail: (p) =>
      result({
        playlist: rawPlaylist(
          p.id,
          p.id === "202" ? "22" : "11",
          p.id === "105" ? { specialType: 5 } : {},
        ),
      }),
    playlist_track_all: () =>
      result({
        songs: [rawSong(1), rawSong(2)],
        privileges: [{ id: 2, st: -1 }],
      }),
    album: () =>
      result({
        album: { id: 3, name: "专辑", picUrl: image, description: "专辑介绍" },
        songs: [rawSong()],
      }),
    artists: () =>
      result({
        artist: { id: 2, name: "歌手", picUrl: image, briefDesc: "简介" },
        hotSongs: [rawSong()],
      }),
    user_playlist: () =>
      result({
        playlist: [
          rawPlaylist(),
          rawPlaylist("202", "22"),
          rawPlaylist("105", "11", { specialType: 5 }),
        ],
      }),
    likelist: () => result({ ids: [1, 2] }),
    like: () => result({}),
    playlist_create: (p) =>
      result({ playlist: { id: 999, name: p.name, privacy: p.privacy } }),
    playlist_tracks: () => result({}),
    lyric_new: () =>
      result({
        lrc: { lyric: "[00:01.00]潮声" },
        yrc: { lyric: "[1000,1000](1000,500,0)潮(1500,500,0)声" },
        tlyric: { lyric: "[00:01.00]The tide" },
        romalrc: { lyric: "" },
      }),
    lyric: () => result({ lrc: { lyric: "[00:01.00]潮声" } }),
    song_url_v1: () =>
      result({
        data: [
          {
            id: 1,
            url: "http://m8.music.126.net/test/audio.mp3",
            expi: 1200,
            level: "exhigh",
            freeTrialInfo: null,
          },
        ],
      }),
    song_url: () => result({ data: [{ id: 1, url: null }] }),
  };
  const sdk = {};
  for (const name of Object.keys(methods))
    sdk[name] = async (params) => {
      calls.push({ name, params });
      return methods[name](params);
    };
  return { sdk, methods, calls };
}
async function fixture(t, options = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "tingchao-api-"));
  let time = 1700000000000;
  const fake = fakeSdk(),
    app = createMusicServer({
      dataDir: directory,
      cookieKey: KEY,
      gatewayKey: GATEWAY,
      publicOrigin: "http://127.0.0.1:8899",
      secureCookies: false,
      now: () => time,
      sdk: fake.sdk,
      ...options,
    });
  await new Promise((resolve) =>
    app.server.listen({ host: "127.0.0.1", port: 0 }, resolve),
  );
  const base = "http://127.0.0.1:" + app.server.address().port;
  t.after(async () => {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  });
  function client() {
    const jar = new Map();
    return {
      jar,
      async request(
        route,
        { method = "GET", body, access = "desktop", headers = {} } = {},
      ) {
        const response = await fetch(base + PREFIX + route, {
          method,
          headers: {
            "X-Music-Gateway": GATEWAY,
            "X-Music-Access": access,
            ...(jar.size
              ? { Cookie: [...jar].map(([k, v]) => k + "=" + v).join("; ") }
              : {}),
            ...(body !== undefined
              ? { "Content-Type": "application/json" }
              : {}),
            ...headers,
          },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });
        const cookies = response.headers.getSetCookie();
        for (const cookie of cookies) {
          const pair = cookie.split(";")[0],
            index = pair.indexOf("="),
            name = pair.slice(0, index),
            value = pair.slice(index + 1);
          if (value) jar.set(name, value);
          else jar.delete(name);
        }
        return {
          status: response.status,
          body: await response.json(),
          cookies,
        };
      },
    };
  }
  async function login(client) {
    await client.request("session");
    const qr = await client.request("auth/qr", { method: "POST", body: {} });
    const done = await client.request("auth/qr/" + qr.body.data.id);
    assert.equal(done.body.data.status, "authorized");
    return done;
  }
  return {
    ...fake,
    app,
    base,
    directory,
    client,
    login,
    advance: (ms) => {
      time += ms;
    },
  };
}

test("only the keyed gateway can reach API; health is minimal and private fields never leak", async (t) => {
  const f = await fixture(t),
    health = await fetch(f.base + "/health");
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), {
    ok: true,
    app: "aidenos-music",
    version: 1,
  });
  const denied = await fetch(f.base + PREFIX + "session");
  assert.equal(denied.status, 403);
  assert.equal(JSON.stringify(await denied.json()).includes(GATEWAY), false);
  const a = f.client(),
    session = await a.request("session");
  assert.equal(session.body.data.authenticated, false);
  assert.match(session.cookies[0], /HttpOnly; SameSite=Strict/);
  assert.match(session.cookies[0], /Path=\/__desktop\/music\/v1\//);
  const result = await a.request(
    "search?q=" + encodeURIComponent("AC/DC 海") + "&type=tracks",
  );
  assert.equal(result.status, 200);
  assert.equal(result.body.data.tracks[0].title, "潮生 1");
  assert.equal(JSON.stringify(result.body).includes("NEVER_FORWARD"), false);
  assert.equal(
    (
      await a.request("home", {
        headers: { Origin: "https://foreign.example" },
      })
    ).status,
    403,
  );
  assert.equal((await a.request("unknown")).status, 404);
});

test("browser sessions and QR challenges are isolated; upstream cookie is encrypted at rest", async (t) => {
  const f = await fixture(t),
    a = f.client(),
    b = f.client();
  await a.request("session");
  await b.request("session");
  const qr = await a.request("auth/qr", { method: "POST", body: {} });
  assert.equal(
    (await b.request("auth/qr/" + qr.body.data.id)).body.data.status,
    "expired",
  );
  const logged = await a.request("auth/qr/" + qr.body.data.id);
  assert.equal(logged.body.data.session.user.id, "11");
  assert.equal(
    JSON.stringify(logged.body).includes("VERY_PRIVATE_TOKEN"),
    false,
  );
  assert.equal(
    logged.cookies.some((value) => value.startsWith("MUSIC_U=")),
    false,
  );
  assert.equal((await b.request("session")).body.data.authenticated, false);
  assert.equal((await a.request("session")).body.data.authenticated, true);
  const files = await Promise.all(
    ["music.sqlite", "music.sqlite-wal"].map((name) =>
      readFile(path.join(f.directory, name)).catch(() => Buffer.alloc(0)),
    ),
  );
  assert.equal(
    Buffer.concat(files).includes(Buffer.from("VERY_PRIVATE_TOKEN")),
    false,
  );
  const stored = f.app.store.getSession(a.jar.get(SESSION_COOKIE));
  assert.equal(stored.cookies.MUSIC_U, "VERY_PRIVATE_TOKEN_key-1");
  assert.equal(stored.cookies.Path, undefined);
  assert.equal(stored.cookies.HttpOnly, undefined);
});

test("12 hour playback lease survives desktop lock context and cannot read account or cross sessions", async (t) => {
  const f = await fixture(t),
    a = f.client(),
    b = f.client();
  await a.request("session");
  await b.request("session");
  const lease = await a.request("playback/lease", { method: "POST", body: {} }),
    csrf = lease.body.data.csrfToken;
  assert.equal(lease.body.data.expiresAt, 1700000000000 + LEASE_TTL);
  const request = {
    method: "POST",
    body: { id: "1", quality: "exhigh" },
    access: "playback",
    headers: { "X-Music-Playback-CSRF": csrf },
  };
  assert.equal((await a.request("playback/resolve", request)).status, 200);
  assert.equal(
    (await a.request("library", { access: "playback" })).status,
    403,
  );
  assert.equal(
    (
      await a.request("playback/lease", {
        method: "POST",
        body: {},
        access: "playback",
      })
    ).status,
    403,
  );
  assert.equal(
    (await a.request("playback/resolve", { ...request, headers: {} })).body
      .error.code,
    "lease_expired",
  );
  b.jar.set(PLAYBACK_COOKIE, a.jar.get(PLAYBACK_COOKIE));
  assert.equal(
    (await b.request("playback/resolve", request)).body.error.code,
    "lease_expired",
  );
  assert.equal(f.calls.at(-1).params.unblock, false);
  assert.equal(f.calls.at(-1).params.cookie.os, "pc");
  f.advance(LEASE_TTL + 1);
  assert.equal(
    (await a.request("playback/resolve", request)).body.error.code,
    "lease_expired",
  );
});

test("login and logout revoke earlier playback authority", async (t) => {
  const f = await fixture(t),
    a = f.client();
  await a.request("session");
  const lease = await a.request("playback/lease", { method: "POST", body: {} }),
    oldToken = a.jar.get(PLAYBACK_COOKIE);
  await f.login(a);
  a.jar.set(PLAYBACK_COOKIE, oldToken);
  assert.equal(
    (
      await a.request("playback/resolve", {
        method: "POST",
        access: "playback",
        headers: { "X-Music-Playback-CSRF": lease.body.data.csrfToken },
        body: { id: "1" },
      })
    ).body.error.code,
    "lease_expired",
  );
  const next = await a.request("playback/lease", { method: "POST", body: {} }),
    beforeLogout = new Map(a.jar);
  assert.equal(
    (await a.request("session", { method: "DELETE", body: {} })).status,
    200,
  );
  a.jar.clear();
  for (const [key, value] of beforeLogout) a.jar.set(key, value);
  assert.equal(
    (
      await a.request("playback/resolve", {
        method: "POST",
        access: "playback",
        headers: { "X-Music-Playback-CSRF": next.body.data.csrfToken },
        body: { id: "1" },
      })
    ).body.error.code,
    "lease_expired",
  );
});

test("song resolution labels previews, upgrades official HTTPS and rejects foreign or absent URLs", async (t) => {
  const f = await fixture(t),
    a = f.client(),
    lease = await a.request("playback/lease", { method: "POST", body: {} });
  const args = {
    method: "POST",
    access: "playback",
    headers: { "X-Music-Playback-CSRF": lease.body.data.csrfToken },
    body: { id: "1", quality: "lossless" },
  };
  f.methods.song_url_v1 = () => ({
    body: {
      code: 200,
      data: [
        {
          url: "http://m8.music.126.net/a.mp3",
          expi: 90,
          level: "exhigh",
          freeTrialInfo: { start: 10, end: 40 },
        },
      ],
    },
  });
  const preview = await a.request("playback/resolve", args);
  assert.equal(preview.body.data.url, "https://m8.music.126.net/a.mp3");
  assert.equal(preview.body.data.quality, "exhigh");
  assert.deepEqual(preview.body.data.preview, { startMs: 10000, endMs: 40000 });
  assert.equal(preview.body.data.availability, "preview");
  for (const url of [
    null,
    "http://127.0.0.1:22/",
    "https://pirate.example/audio.mp3",
    "javascript:alert(1)",
  ]) {
    f.methods.song_url_v1 = () => ({ body: { code: 200, data: [{ url }] } });
    assert.equal(
      (await a.request("playback/resolve", args)).body.error.code,
      "unavailable",
    );
  }
});

test("playlist writes require upstream login and verified ownership; nested HTTP-200 failures propagate", async (t) => {
  const f = await fixture(t),
    a = f.client();
  assert.equal(
    (
      await a.request("likes", {
        method: "POST",
        body: { trackId: "1", liked: true },
      })
    ).status,
    401,
  );
  await f.login(a);
  const created = await a.request("playlists", {
    method: "POST",
    body: { name: "深夜的潮声", privacy: "private" },
  });
  assert.equal(created.body.data.title, "深夜的潮声");
  assert.equal(created.body.data.editable, true);
  assert.equal(created.body.data.privacy, "private");
  assert.equal(
    (
      await a.request("playlists/202/tracks", {
        method: "POST",
        body: { op: "remove", trackIds: ["1"] },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await a.request("playlists/105/tracks", {
        method: "POST",
        body: { op: "add", trackIds: ["1"] },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await a.request("playlists/101/tracks", {
        method: "POST",
        body: { op: "add", trackIds: ["1", "1", "2"] },
      })
    ).status,
    200,
  );
  assert.equal(f.calls.at(-1).params.tracks, "1,2");
  assert.equal(f.calls.at(-1).params.op, "add");
  assert.equal(
    (
      await a.request("playlists/101/tracks", {
        method: "POST",
        body: { op: "remove", trackIds: ["1"] },
      })
    ).status,
    200,
  );
  assert.equal(f.calls.at(-1).params.op, "del");
  f.methods.playlist_tracks = () => ({
    status: 200,
    body: { status: 200, body: { code: 403, message: "DO_NOT_LEAK_UPSTREAM" } },
  });
  const failed = await a.request("playlists/101/tracks", {
    method: "POST",
    body: { op: "add", trackIds: ["1"] },
  });
  assert.equal(failed.status, 403);
  assert.equal(failed.body.ok, false);
  assert.equal(JSON.stringify(failed.body).includes("DO_NOT_LEAK"), false);
  f.methods.playlist_create = () => ({ status: 200, body: { code: 502 } });
  assert.equal(
    (
      await a.request("playlists", {
        method: "POST",
        body: { name: "海", privacy: "public" },
      })
    ).body.error.code,
    "upstream_error",
  );
  f.methods.playlist_create = () => ({
    status: 200,
    body: { playlist: { id: 999, name: "缺少业务成功码" } },
  });
  assert.equal(
    (
      await a.request("playlists", {
        method: "POST",
        body: { name: "海", privacy: "public" },
      })
    ).body.error.code,
    "upstream_error",
  );
});

test("xeapi setup failures fall back to the official legacy endpoint with actual bitrate quality", async (t) => {
  const f = await fixture(t),
    a = f.client(),
    lease = await a.request("playback/lease", { method: "POST", body: {} });
  f.methods.song_url_v1 = () => {
    throw new Error("public key unavailable");
  };
  f.methods.song_url = () => ({
    body: {
      code: 200,
      data: [
        {
          url: "http://m8.music.126.net/preview.mp3",
          expi: 1200,
          br: 128012,
          type: "mp3",
          freeTrialInfo: { start: 30, end: 60 },
        },
      ],
    },
  });
  const result = await a.request("playback/resolve", {
    method: "POST",
    access: "playback",
    headers: { "X-Music-Playback-CSRF": lease.body.data.csrfToken },
    body: { id: "1", quality: "lossless" },
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.data.quality, "standard");
  assert.equal(result.body.data.availability, "preview");
  assert.equal(f.calls.at(-1).name, "song_url");
  assert.equal(f.calls.at(-1).params.unblock, false);
  assert.equal(f.calls.at(-1).params.br, 999000);
});

test("normalized browsing covers home, each search type, playlist pagination, library, album, artist and lyrics", async (t) => {
  const f = await fixture(t),
    a = f.client();
  assert.equal((await a.request("home")).body.data.personalized, false);
  for (const type of ["tracks", "playlists", "albums", "artists"]) {
    const result = await a.request("search?q=海&type=" + type);
    assert.equal(result.status, 200);
    assert.equal(result.body.data[type].length, 1);
  }
  const list = await a.request("playlists/101?offset=50");
  assert.equal(list.body.data.tracks.offset, 50);
  assert.equal(list.body.data.tracks.hasMore, true);
  assert.equal(list.body.data.tracks.items[1].availability, "unavailable");
  assert.equal((await a.request("albums/3")).body.data.tracks[0].id, "1");
  assert.equal((await a.request("artists/2")).body.data.artist.name, "歌手");
  assert.equal(
    (await a.request("lyrics/1")).body.data.translation,
    "[00:01.00]The tide",
  );
  await f.login(a);
  assert.equal((await a.request("home")).body.data.personalized, true);
  const library = (await a.request("library")).body.data;
  assert.equal(library.created.length, 2);
  assert.equal(library.collected.length, 1);
  assert.equal(library.likedPlaylistId, "105");
  assert.deepEqual(library.likedIds, ["1", "2"]);
});

test("invalid parameters cannot reach SDK methods and upstream timeouts are bounded", async (t) => {
  const f = await fixture(t, { upstreamTimeoutMs: 30 }),
    a = f.client();
  await f.login(a);
  const before = f.calls.length;
  for (const route of [
    "search?q=&type=tracks",
    "search?q=x&type=invalid",
    "playlists/101?offset=-1",
    "playlists/%2e%2e",
  ])
    assert.equal((await a.request(route)).body.ok, false);
  assert.equal(
    (
      await a.request("likes", {
        method: "POST",
        body: { trackId: "-1", liked: true },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await a.request("playlists", {
        method: "POST",
        body: { name: "", privacy: "private" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await a.request("playlists/101/tracks", {
        method: "POST",
        body: { op: "add", trackIds: ["1", "bad"] },
      })
    ).status,
    400,
  );
  assert.equal(f.calls.length, before);
  f.methods.artists = () => new Promise(() => {});
  const timed = await a.request("artists/2");
  assert.equal(timed.status, 504);
  assert.equal(timed.body.error.retryable, true);
});

test("cookie key is mandatory and duplicate music cookies fail closed", async (t) => {
  assert.throws(
    () => new MusicStore({ file: ":memory:", cookieKey: "bad" }),
    /COOKIE_KEY/,
  );
  const f = await fixture(t),
    a = f.client();
  await a.request("session");
  const token = a.jar.get(SESSION_COOKIE);
  const duplicate = await a.request("session", {
    headers: {
      Cookie: `${SESSION_COOKIE}=${token}; ${SESSION_COOKIE}=${token}`,
    },
  });
  assert.equal(duplicate.status, 400);
});
