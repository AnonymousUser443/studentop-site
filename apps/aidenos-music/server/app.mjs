import http from "node:http";
import { createRequire } from "node:module";
import { randomBytes, timingSafeEqual } from "node:crypto";
import {
  MusicStore,
  SESSION_COOKIE,
  PLAYBACK_COOKIE,
  SESSION_TTL,
  LEASE_TTL,
  readCookie,
  cookieHeader,
  clearCookies,
} from "./store.mjs";
import {
  MusicFailure,
  unwrap,
  safeFailure,
  upstreamFailure,
} from "./errors.mjs";
import { withQuietSdk } from "./sdk-context.mjs";
import * as normalize from "./normalize.mjs";

export const PREFIX = "/__desktop/music/v1/";
export const PAGE_SIZE = 50;
export const COMMENTS_PAGE_SIZE = 20;
const LIBRARY_PAGE_SIZE = 100;
const MAX_LIBRARY_PAGES = 20;
const QR_TTL = 3 * 60 * 1000;
const NO_CACHE = {
  "Cache-Control": "no-store, private",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  Vary: "Cookie",
  "Cross-Origin-Resource-Policy": "same-origin",
};
const require = createRequire(import.meta.url);
const numericId = (value) =>
  typeof value === "string" && /^[1-9][0-9]{0,19}$/.test(value);
function identifier(value) {
  if (!numericId(value))
    throw new MusicFailure("invalid_request", "音乐内容标识不正确。", 400);
  return value;
}
function offsetParam(url) {
  const raw = url.searchParams.get("offset") ?? "0";
  if (!/^(0|[1-9][0-9]{0,6})$/.test(raw) || Number(raw) > 1000000)
    throw new MusicFailure("invalid_request", "分页位置不正确。", 400);
  return Number(raw);
}
function queryKeys(url, allowed) {
  for (const key of url.searchParams.keys())
    if (!allowed.includes(key) || url.searchParams.getAll(key).length !== 1)
      throw new MusicFailure("invalid_request", "请求参数不正确。", 400);
}
function bodyKeys(body, allowed) {
  if (Object.keys(body).some((key) => !allowed.includes(key)))
    throw new MusicFailure("invalid_request", "请求参数不正确。", 400);
}
function beforeParam(url, offset) {
  const raw = url.searchParams.get("before");
  if (raw === null && offset < 5000) return null;
  if (offset < 5000 || !/^[1-9][0-9]{0,15}$/.test(raw ?? "") || !Number.isSafeInteger(Number(raw)))
    throw new MusicFailure("invalid_request", "请从上一页继续查看更早的评论。", 400);
  return Number(raw);
}
function positiveCount(value, fallback = 0) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : fallback;
}
function sameSecret(left, right) {
  const a = Buffer.from(String(left ?? "")),
    b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
function safeCookies(result, previous = {}) {
  const next = { ...previous };
  // Read only Set-Cookie's first key/value pair. Expires, Domain and Path never become SDK cookies.
  const values = Array.isArray(result?.cookie) ? result.cookie : [];
  for (const raw of values) {
    if (typeof raw !== "string") continue;
    const pair = raw.split(";", 1)[0],
      split = pair.indexOf("=");
    if (split < 1) continue;
    const name = pair.slice(0, split).trim(),
      value = pair.slice(split + 1).trim();
    if (
      /^[a-zA-Z0-9_]{1,64}$/.test(name) &&
      value.length <= 8192 &&
      !/[\r\n]/.test(value)
    ) {
      if (value) next[name] = value;
      else delete next[name];
    }
  }
  return next;
}
function accountFrom(body) {
  const account = body?.account ?? body?.data?.account;
  const profile = body?.profile ?? body?.data?.profile;
  if (!account?.id && !profile?.userId) return null;
  return normalize.user(profile ?? account);
}
async function readBody(req) {
  if (
    !/^application\/json(?:\s*;\s*charset\s*=\s*utf-8)?$/i.test(
      String(req.headers["content-type"] || ""),
    )
  )
    throw new MusicFailure("invalid_request", "请求内容格式不正确。", 415);
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 16384)
      throw new MusicFailure("invalid_request", "一次提交的内容过多。", 413);
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw Error();
    return value;
  } catch {
    throw new MusicFailure("invalid_request", "请求内容格式不正确。", 400);
  }
}
function rawLyrics(body) {
  const text = (value) =>
    typeof value === "string" ? value.slice(0, 1024 * 1024) : "";
  const lrc = text(body.lrc?.lyric),
    yrc = text(body.yrc?.lyric);
  return {
    lrc,
    yrc,
    translation: text(body.tlyric?.lyric ?? body.ytlrc?.lyric),
    romanization: text(
      body.romalrc?.lyric ?? body.romalrc ?? body.yromalrc?.lyric,
    ),
    instrumental:
      !!body.nolyric || (!lrc && !yrc) || /纯音乐[，,]?请欣赏/.test(lrc),
  };
}
function validOrigin(value) {
  try {
    const url = new URL(value);
    return (
      url.origin === value &&
      ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

/** Loopback SDK service. Only the authenticated desktop gateway can supply an access context. */
export function createMusicServer(options = {}) {
  const gatewayKey = options.gatewayKey ?? process.env.MUSIC_GATEWAY_KEY;
  if (
    typeof gatewayKey !== "string" ||
    Buffer.byteLength(gatewayKey) < 32 ||
    Buffer.byteLength(gatewayKey) > 256
  )
    throw new Error(
      "MUSIC_GATEWAY_KEY must be a private secret of at least 32 bytes.",
    );
  const publicOrigin = options.publicOrigin ?? process.env.MUSIC_PUBLIC_ORIGIN;
  if (!validOrigin(publicOrigin))
    throw new Error("MUSIC_PUBLIC_ORIGIN must be an exact origin.");
  const now = options.now ?? Date.now;
  const secureCookies =
    options.secureCookies ??
    (process.env.MUSIC_SECURE_COOKIES === "false"
      ? false
      : publicOrigin.startsWith("https:"));
  const ownsStore = !options.store;
  const store =
    options.store ??
    new MusicStore({
      dataDir: options.dataDir ?? process.env.MUSIC_DATA_DIR,
      cookieKey: options.cookieKey ?? process.env.MUSIC_COOKIE_KEY,
      now,
    });
  let sdk = options.sdk;
  const challenges = new Map(),
    budgets = new Map(),
    jobs = new Set();
  let closing = false;
  function sdkInstance() {
    return (sdk ||= withQuietSdk(() =>
      require("@neteasecloudmusicapienhanced/api"),
    ));
  }
  async function call(name, params, session, allowedCodes) {
    const method = sdkInstance()[name];
    if (typeof method !== "function")
      throw new MusicFailure(
        "upstream_error",
        "音乐服务接口暂不可用。",
        503,
        true,
      );
    let timer;
    try {
      const result = await Promise.race([
        Promise.resolve().then(() =>
          withQuietSdk(() =>
            method({
              ...params,
              cookie: { ...session.cookies, os: "pc" },
              timestamp: now(),
              unblock: false,
              timeout: options.upstreamTimeoutMs ?? 18000,
            }),
          ),
        ),
        new Promise((_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new MusicFailure(
                  "upstream_error",
                  "音乐服务响应较慢，请稍后再试。",
                  504,
                  true,
                ),
              ),
            options.upstreamTimeoutMs ?? 18000,
          );
          timer.unref?.();
        }),
      ]);
      const body = unwrap(result, allowedCodes);
      return { result, body };
    } catch (error) {
      let failure;
      if (error instanceof MusicFailure) failure = error;
      else {
        try {
          unwrap(error, allowedCodes);
          failure = upstreamFailure();
        } catch (parsed) {
          failure = safeFailure(parsed);
        }
      }
      if (failure.code === "login_expired" && session.user)
        store.clearAuthentication(session);
      throw failure;
    } finally {
      clearTimeout(timer);
    }
  }
  function response(res, status, data, cookies = [], head = false) {
    if (res.destroyed) return;
    res.writeHead(status, {
      ...NO_CACHE,
      ...(cookies.length ? { "Set-Cookie": cookies } : {}),
    });
    res.end(head ? undefined : JSON.stringify(data));
  }
  function requireLogin(session) {
    if (!session.user || !session.cookies.MUSIC_U)
      throw new MusicFailure(
        "authentication_required",
        "扫码登录后即可使用个人音乐库。",
        401,
      );
  }
  function sessionFor(req, cookies, create = true) {
    const token = readCookie(req.headers.cookie, SESSION_COOKIE);
    let session = store.getSession(token);
    if (!session && create) {
      session = store.createSession();
      cookies.push(
        cookieHeader(SESSION_COOKIE, session.token, {
          secure: secureCookies,
          maxAge: SESSION_TTL,
        }),
      );
    }
    return session;
  }
  function rateLimit(session, write) {
    const key = session.id + (write ? ":write" : ":read"),
      minute = Math.floor(now() / 60000);
    const current = budgets.get(key);
    const bucket = current?.minute === minute ? current : { minute, count: 0 };
    bucket.count += 1;
    budgets.set(key, bucket);
    if (bucket.count > (write ? 45 : 240))
      throw new MusicFailure(
        "rate_limited",
        "请求有些频繁，稍等片刻再试。",
        429,
        true,
      );
    if (budgets.size > 20000)
      for (const [id, item] of budgets)
        if (item.minute < minute) budgets.delete(id);
    for (const [id, item] of challenges)
      if (item.expiresAt <= now()) challenges.delete(id);
  }
  async function profile(session) {
    if (!session.cookies.MUSIC_U) return null;
    const { body } = await call("user_account", {}, session);
    const user = accountFrom(body);
    if (!user) {
      store.clearAuthentication(session);
      return null;
    }
    session.user = user;
    store.saveSession(session);
    return user;
  }
  async function playlistRaw(id, session) {
    return (await call("playlist_detail", { id, s: 0 }, session)).body.playlist;
  }
  async function libraryPlaylists(name, session) {
    const output = [], seen = new Set();let offset = 0;
    for (let page = 0; page < MAX_LIBRARY_PAGES; page++) {
      const { body } = await call(name, { uid: session.user.id, limit: LIBRARY_PAGE_SIZE, offset }, session);
      const rows = [body.playlist, body.playlists, body.playList, body.data,
        body.data?.playlist, body.data?.playlists, body.data?.list].find(Array.isArray);
      if (!rows) throw upstreamFailure();
      let added = 0;
      for (const entry of rows) {
        const raw = entry?.playlist ?? entry;
        if (!raw || !numericId(String(raw.id)) || seen.has(String(raw.id))) continue;
        seen.add(String(raw.id));output.push(raw);added++;
      }
      const flag = body.more ?? body.hasMore ?? body.data?.hasMore;
      const total = positiveCount(body.count ?? body.total ?? body.data?.count ?? body.data?.total);
      const more = typeof flag === "boolean" ? flag : total ? offset + rows.length < total : rows.length === LIBRARY_PAGE_SIZE;
      if (!more) return output;
      if (!rows.length || !added) throw upstreamFailure();
      offset += rows.length;
    }
    throw new MusicFailure("upstream_error", "歌单较多，音乐库暂未能完整载入，请稍后再试。", 503, true);
  }
  async function route(req, res) {
    const cookies = [];
    try {
      if (closing)
        throw new MusicFailure(
          "upstream_error",
          "音乐服务正在重连，请稍后再试。",
          503,
          true,
        );
      if (req.url === "/health" && ["GET", "HEAD"].includes(req.method)) {
        response(
          res,
          200,
          { ok: true, app: "aidenos-music", version: 1 },
          [],
          req.method === "HEAD",
        );
        return;
      }
      if (!sameSecret(req.headers["x-music-gateway"], gatewayKey))
        throw new MusicFailure("forbidden", "请求来源不匹配。", 403);
      const access = req.headers["x-music-access"];
      if (!["desktop", "playback"].includes(access))
        throw new MusicFailure("forbidden", "请求来源不匹配。", 403);
      if (
        req.headers.origin !== undefined &&
        req.headers.origin !== publicOrigin
      )
        throw new MusicFailure("forbidden", "请求来源不匹配。", 403);
      const rawPath = typeof req.url === "string" ? req.url.split("?")[0] : "";
      if (
        typeof req.url !== "string" ||
        req.url.length > 4096 ||
        !req.url.startsWith(PREFIX) ||
        /[\\\x00-\x20\x7f]/.test(req.url) ||
        /%|\.\./i.test(rawPath)
      )
        throw new MusicFailure("invalid_request", "音乐接口不存在。", 404);
      const url = new URL(req.url, publicOrigin),
        route = url.pathname.slice(PREFIX.length);
      if (
        access === "playback" &&
        (route !== "playback/resolve" || req.method !== "POST")
      )
        throw new MusicFailure(
          "forbidden",
          "锁屏时仅可控制当前音乐播放。",
          403,
        );
      const session = sessionFor(req, cookies, access === "desktop");
      if (!session)
        throw new MusicFailure(
          "lease_expired",
          "播放会话已到期，请解锁桌面后继续。",
          401,
        );
      rateLimit(session, !["GET", "HEAD"].includes(req.method));
      let data;
      if (req.method === "GET" && route === "session") {
        // Profile comes from the authenticated upstream cookie; never trust a browser supplied uid.
        const user = await profile(session);
        data = { authenticated: !!user, user };
      } else if (req.method === "DELETE" && route === "session") {
        store.deleteSession(session);
        for (const [id, item] of challenges)
          if (item.sessionId === session.id) challenges.delete(id);
        cookies.push(...clearCookies(secureCookies));
        data = null;
      } else if (req.method === "POST" && route === "auth/qr") {
        await readBody(req);
        const keyBody = (await call("login_qr_key", {}, session)).body;
        const key = keyBody.data?.unikey;
        if (typeof key !== "string" || !key || key.length > 512)
          throw upstreamFailure();
        const imageBody = (
          await call("login_qr_create", { key, qrimg: true }, session)
        ).body;
        const imageUrl = imageBody.data?.qrimg;
        if (
          typeof imageUrl !== "string" ||
          !/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(
            imageUrl,
          ) ||
          imageUrl.length > 512000
        )
          throw upstreamFailure();
        const id = randomBytes(32).toString("hex"),
          expiresAt = now() + QR_TTL;
        for (const [old, item] of challenges)
          if (item.sessionId === session.id) challenges.delete(old);
        challenges.set(id, {
          key,
          sessionId: session.id,
          expiresAt,
          lastPoll: 0,
        });
        data = { id, imageUrl, expiresAt };
      } else if (
        req.method === "GET" &&
        /^auth\/qr\/[a-f0-9]{64}$/.test(route)
      ) {
        const id = route.slice("auth/qr/".length),
          challenge = challenges.get(id);
        if (
          !challenge ||
          challenge.sessionId !== session.id ||
          challenge.expiresAt <= now()
        ) {
          data = { status: "expired" };
        } else {
          if (challenge.lastPoll && now() - challenge.lastPoll < 1000)
            throw new MusicFailure(
              "rate_limited",
              "二维码正在确认中，请稍候。",
              429,
              true,
            );
          challenge.lastPoll = now();
          const { result, body } = await call(
            "login_qr_check",
            { key: challenge.key },
            session,
            [800, 801, 802, 803],
          );
          const statuses = {
            800: "expired",
            801: "waiting",
            802: "scanned",
            803: "authorized",
          };
          data = { status: statuses[body.code] };
          if (body.code === 800) challenges.delete(id);
          if (body.code === 803) {
            const next = safeCookies(result, session.cookies);
            if (!next.MUSIC_U) throw upstreamFailure();
            session.cookies = next;
            const user = await profile(session);
            if (!user)
              throw new MusicFailure(
                "login_expired",
                "扫码登录未能完成，请刷新二维码重试。",
                401,
              );
            // A previously issued guest playback lease cannot act as a newly logged-in account.
            store.revokeLeases(session);
            cookies.push(
              cookieHeader(PLAYBACK_COOKIE, "", { secure: secureCookies }),
            );
            challenges.delete(id);
            data.session = { authenticated: true, user };
          }
        }
      } else if (req.method === "GET" && route === "home") {
        const personal = !!session.user && !!session.cookies.MUSIC_U;
        const responses = await Promise.allSettled([
          call(
            "top_playlist",
            { limit: 8, order: "hot", cat: "全部" },
            session,
          ),
          call(
            personal ? "recommend_resource" : "personalized",
            { limit: 12 },
            session,
          ),
          personal
            ? call("recommend_songs", {}, session)
            : call("personalized_newsong", { limit: 12 }, session),
        ]);
        const failedAuth = responses.find(
          (item) =>
            item.status === "rejected" && item.reason?.code === "login_expired",
        );
        if (failedAuth) throw failedAuth.reason;
        if (responses.every((item) => item.status === "rejected"))
          throw responses[0].reason;
        const bodies = responses.map((item) =>
          item.status === "fulfilled" ? item.value.body : {},
        );
        const featured = (bodies[0].playlists ?? [])
          .slice(0, 8)
          .map((raw) => normalize.playlist(raw, session.user?.id));
        const recommended = (bodies[1].recommend ?? bodies[1].result ?? [])
          .slice(0, 12)
          .map((raw) => normalize.playlist(raw, session.user?.id));
        const tracks = (bodies[2].data?.dailySongs ?? bodies[2].result ?? [])
          .slice(0, 18)
          .map((raw) => normalize.track(raw.song ?? raw));
        data = { featured, recommended, tracks, personalized: personal };
      } else if (req.method === "GET" && route === "search") {
        const query = (url.searchParams.get("q") || "").trim(),
          type = url.searchParams.get("type") || "tracks",
          offset = offsetParam(url);
        const types = { tracks: 1, playlists: 1000, albums: 10, artists: 100 };
        if (
          !query ||
          query.length > 100 ||
          /[\x00-\x1f\x7f]/.test(query) ||
          !Object.hasOwn(types, type)
        )
          throw new MusicFailure(
            "invalid_request",
            "请输入有效的搜索内容。",
            400,
          );
        const { body } = await call(
          "cloudsearch",
          { keywords: query, type: types[type], limit: PAGE_SIZE, offset },
          session,
        );
        const result = body.result ?? {},
          total =
            Number(
              result[
                {
                  tracks: "songCount",
                  playlists: "playlistCount",
                  albums: "albumCount",
                  artists: "artistCount",
                }[type]
              ],
            ) || 0;
        data = {
          type,
          tracks: (result.songs ?? []).map((raw) => normalize.track(raw)),
          playlists: (result.playlists ?? []).map((raw) =>
            normalize.playlist(raw, session.user?.id),
          ),
          albums: (result.albums ?? []).map(normalize.album),
          artists: (result.artists ?? []).map(normalize.artist),
          total,
          offset,
          limit: PAGE_SIZE,
          hasMore: offset + PAGE_SIZE < total,
        };
      } else if (req.method === "GET" && /^playlists\/[0-9]+$/.test(route)) {
        const id = identifier(route.slice(10)),
          offset = offsetParam(url);
        const raw = await playlistRaw(id, session);
        if (!raw || !raw.id)
          throw new MusicFailure("unavailable", "这个歌单暂不可用。", 404);
        const metadata = normalize.playlist(raw, session.user?.id);
        const body = (
          await call(
            "playlist_track_all",
            { id, limit: PAGE_SIZE, offset },
            session,
          )
        ).body;
        const privileges = new Map(
          (body.privileges ?? []).map((item) => [String(item.id), item]),
        );
        const items = (body.songs ?? []).map((raw) =>
          normalize.track(raw, privileges.get(String(raw.id))),
        );
        data = {
          playlist: metadata,
          tracks: {
            items,
            total: metadata.trackCount,
            offset,
            limit: PAGE_SIZE,
            hasMore:
              offset + items.length < metadata.trackCount && items.length > 0,
          },
        };
      } else if (req.method === "GET" && /^albums\/[0-9]+$/.test(route)) {
        const id = identifier(route.slice(7)),
          { body } = await call("album", { id }, session);
        if (!body.album)
          throw new MusicFailure("unavailable", "这张专辑暂不可用。", 404);
        data = {
          album: normalize.album(body.album),
          tracks: (body.songs ?? []).map((raw) => normalize.track(raw)),
          description: String(body.album.description ?? "").slice(0, 6000),
        };
      } else if (req.method === "GET" && /^artists\/[0-9]+$/.test(route)) {
        const id = identifier(route.slice(8)),
          { body } = await call("artists", { id }, session);
        if (!body.artist)
          throw new MusicFailure(
            "unavailable",
            "这位歌手的信息暂不可用。",
            404,
          );
        data = {
          artist: normalize.artist(body.artist),
          tracks: (body.hotSongs ?? []).map((raw) => normalize.track(raw)),
          description: String(body.artist.briefDesc ?? "").slice(0, 6000),
        };
      } else if (req.method === "GET" && route === "library") {
        requireLogin(session);
        queryKeys(url, []);
        const [lists, created, likes] = await Promise.all([
          libraryPlaylists("user_playlist", session),
          libraryPlaylists("user_playlist_create", session),
          call("likelist", { uid: session.user.id }, session),
        ]);
        const ownCreated = created.map((raw) => ({ ...raw, creator: raw.creator ?? {
          userId: session.user.id, nickname: session.user.name, avatarUrl: session.user.avatarUrl,
        }})).filter((raw) => String(raw.creator?.userId ?? raw.creator?.id) === session.user.id);
        // The account's create-list includes private entries omitted by the public user-list.
        const raw = [...new Map([...lists, ...ownCreated].map((item) => [String(item.id), item])).values()],
          all = raw.map((item) => normalize.playlist(item, session.user.id));
        const liked = raw.find(
          (item) =>
            String(item.creator?.userId) === session.user.id &&
            Number(item.specialType) === 5,
        );
        data = {
          created: all.filter((item) => item.creator.id === session.user.id),
          collected: all.filter((item) => item.creator.id !== session.user.id),
          likedIds: (likes.body.ids ?? []).map(String).filter(numericId),
          likedPlaylistId: liked ? String(liked.id) : null,
        };
      } else if (req.method === "GET" && route === "cloud") {
        requireLogin(session);queryKeys(url, ["offset"]);
        const offset = offsetParam(url), { body } = await call("user_cloud", { limit: PAGE_SIZE, offset }, session);
        if (!Array.isArray(body.data)) throw upstreamFailure();
        const items = body.data.slice(0, PAGE_SIZE).filter((raw) => raw && typeof raw === "object")
          .map(normalize.cloudTrack).filter((track) => numericId(track.id));
        const total = positiveCount(body.count ?? body.total, offset + items.length);
        data = { items, total, offset, limit: PAGE_SIZE,
          hasMore: items.length > 0 && (typeof body.hasMore === "boolean" ? body.hasMore : offset + items.length < total) };
      } else if (req.method === "GET" && /^comments\/[0-9]+$/.test(route)) {
        queryKeys(url, ["offset", "before"]);
        const id = identifier(route.split("/")[1]), offset = offsetParam(url), before = beforeParam(url, offset);
        const { body } = await call("comment_music", { id, limit: COMMENTS_PAGE_SIZE, offset: before === null ? offset : 0,
          ...(before === null ? {} : { before }) }, session);
        if (!Array.isArray(body.comments)) throw upstreamFailure();
        const comments = (rows) => rows.filter((raw) => raw && typeof raw === "object").map(normalize.trackComment).filter((comment) => numericId(comment.id));
        const items = comments(body.comments.slice(0, COMMENTS_PAGE_SIZE)),
          total = positiveCount(body.total, offset + items.length),
          nextBefore = items.at(-1)?.createdAt || null;
        data = { trackId: id, items, hot: offset === 0 && Array.isArray(body.hotComments) ? comments(body.hotComments.slice(0, 20)) : [],
          total, offset, limit: COMMENTS_PAGE_SIZE, nextBefore,
          hasMore: items.length > 0 && (typeof body.more === "boolean" ? body.more : offset + items.length < total) &&
            (offset + COMMENTS_PAGE_SIZE < 5000 || nextBefore !== null) };
      } else if (req.method === "POST" && /^comments\/[0-9]+\/like$/.test(route)) {
        requireLogin(session);queryKeys(url, []);
        const id = identifier(route.split("/")[1]), body = await readBody(req);
        bodyKeys(body, ["commentId", "liked"]);
        const cid = identifier(body.commentId);
        if (typeof body.liked !== "boolean") throw new MusicFailure("invalid_request", "评论点赞状态不正确。", 400);
        await call("comment_like", { id, cid, type: 0, t: body.liked ? 1 : 0 }, session);data = null;
      } else if (req.method === "POST" && /^comments\/[0-9]+$/.test(route)) {
        requireLogin(session);queryKeys(url, []);
        const id = identifier(route.split("/")[1]), body = await readBody(req);
        bodyKeys(body, ["content", "replyTo"]);
        const content = typeof body.content === "string" ? body.content.replace(/\r\n?/g, "\n").trim() : "";
        if (!content || [...content].length > 500 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(content))
          throw new MusicFailure("invalid_request", "评论需为 1–500 字，请检查后再发送。", 400);
        const replyTo = body.replyTo === undefined ? null : identifier(body.replyTo);
        await call("comment", { id, content, type: 0, t: replyTo === null ? 1 : 2,
          ...(replyTo === null ? {} : { commentId: replyTo }) }, session);data = null;
      } else if (req.method === "GET" && route === "heart-mode") {
        requireLogin(session);queryKeys(url, ["trackId", "playlistId"]);
        const id = identifier(url.searchParams.get("trackId")), pid = identifier(url.searchParams.get("playlistId"));
        const { body } = await call("playmode_intelligence_list", { id, pid, sid: id, count: 30 }, session);
        if (!Array.isArray(body.data)) throw upstreamFailure();
        const tracks = body.data.slice(0, 30).map((row) => row?.songInfo ?? row?.song ?? row)
          .filter((raw) => raw && typeof raw === "object" && (raw.name || raw.title)).map((raw) => normalize.track(raw));
        data = [...new Map(tracks.filter((track) => numericId(track.id)).map((track) => [track.id, track])).values()];
      } else if (req.method === "POST" && route === "likes") {
        requireLogin(session);
        const body = await readBody(req),
          id = identifier(body.trackId);
        if (typeof body.liked !== "boolean")
          throw new MusicFailure("invalid_request", "喜欢状态不正确。", 400);
        await call("like", { id, like: body.liked }, session);
        data = null;
      } else if (req.method === "POST" && route === "playlists") {
        requireLogin(session);
        const body = await readBody(req),
          name = typeof body.name === "string" ? body.name.trim() : "";
        if (
          !name ||
          [...name].length > 40 ||
          /[\x00-\x1f\x7f]/.test(name) ||
          !["public", "private"].includes(body.privacy)
        )
          throw new MusicFailure(
            "invalid_request",
            "请填写 1–40 字的歌单名称并选择可见范围。",
            400,
          );
        const { body: created } = await call(
          "playlist_create",
          {
            name,
            privacy: body.privacy === "private" ? 10 : 0,
            type: "NORMAL",
          },
          session,
        );
        if (!created.playlist?.id) throw upstreamFailure();
        const raw = {
          ...created.playlist,
          creator: created.playlist.creator ?? {
            userId: session.user.id,
            nickname: session.user.name,
            avatarUrl: session.user.avatarUrl,
          },
          privacy: body.privacy === "private" ? 10 : 0,
        };
        data = normalize.playlist(raw, session.user.id);
      } else if (
        req.method === "POST" &&
        /^playlists\/[0-9]+\/tracks$/.test(route)
      ) {
        requireLogin(session);
        const id = identifier(route.split("/")[1]),
          body = await readBody(req);
        if (
          !["add", "remove"].includes(body.op) ||
          !Array.isArray(body.trackIds) ||
          body.trackIds.length < 1 ||
          body.trackIds.length > 100 ||
          body.trackIds.some((item) => !numericId(item))
        )
          throw new MusicFailure(
            "invalid_request",
            "请选择 1–100 首歌曲。",
            400,
          );
        const raw = await playlistRaw(id, session);
        if (!raw || !normalize.playlist(raw, session.user.id).editable)
          throw new MusicFailure(
            "forbidden",
            "只能编辑自己创建的普通歌单。",
            403,
          );
        await call(
          "playlist_tracks",
          {
            pid: id,
            op: body.op === "remove" ? "del" : "add",
            tracks: [...new Set(body.trackIds)].join(","),
          },
          session,
        );
        data = null;
      } else if (req.method === "GET" && /^lyrics\/[0-9]+$/.test(route)) {
        const id = identifier(route.slice(7));
        let body;
        try {
          body = (await call("lyric_new", { id }, session)).body;
        } catch (error) {
          if (error.code === "login_expired") throw error;
          body = (await call("lyric", { id }, session)).body;
        }
        data = rawLyrics(body);
      } else if (req.method === "POST" && route === "playback/lease") {
        await readBody(req);
        const lease = store.createLease(session);
        cookies.push(
          cookieHeader(PLAYBACK_COOKIE, lease.token, {
            secure: secureCookies,
            maxAge: Math.max(0, lease.expiresAt - now()),
          }),
        );
        data = { csrfToken: lease.csrfToken, expiresAt: lease.expiresAt };
      } else if (req.method === "POST" && route === "playback/resolve") {
        const token = readCookie(req.headers.cookie, PLAYBACK_COOKIE),
          csrf = req.headers["x-music-playback-csrf"];
        if (!store.authorizeLease(session, token, csrf))
          throw new MusicFailure(
            "lease_expired",
            "播放授权已到期，请解锁桌面后继续。",
            401,
          );
        const body = await readBody(req),
          id = identifier(body.id),
          quality = body.quality ?? "standard";
        if (!["standard", "higher", "exhigh", "lossless"].includes(quality))
          throw new MusicFailure("invalid_request", "音质选项不正确。", 400);
        try {
          const result = (
            await call("song_url_v1", { id, level: quality }, session)
          ).body;
          data = normalize.playback(result.data?.[0], quality, now());
        } catch (error) {
          if (["login_expired", "authentication_required"].includes(error.code))
            throw error;
          // Both paths are official, cookie-scoped endpoints. Some environments
          // cannot initialize the enhanced SDK's xeapi public key. The legacy
          // endpoint can still return an entitled full stream or a labelled preview.
          const br = {
            standard: 128000,
            higher: 192000,
            exhigh: 320000,
            lossless: 999000,
          }[quality];
          const result = (await call("song_url", { id, br }, session)).body;
          data = normalize.playback(result.data?.[0], quality, now());
        }
      } else {
        throw new MusicFailure(
          "invalid_request",
          "音乐接口不存在，或不支持此操作。",
          404,
        );
      }
      response(res, 200, { ok: true, data }, cookies);
    } catch (error) {
      const failure = safeFailure(error);
      if (failure.status === 429) res.setHeader("Retry-After", "3");
      response(
        res,
        failure.status,
        {
          ok: false,
          error: {
            code: failure.code,
            message: failure.message,
            retryable: failure.retryable,
          },
        },
        cookies,
      );
    }
  }
  const server = http.createServer((req, res) => {
    const job = route(req, res);
    jobs.add(job);
    job.finally(() => jobs.delete(job));
  });
  server.requestTimeout = 25000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  server.maxHeadersCount = 50;
  return {
    server,
    store,
    async close() {
      closing = true;
      if (server.listening) {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
      }
      await Promise.allSettled([...jobs]);
      challenges.clear();
      budgets.clear();
      if (ownsStore) store.close();
    },
  };
}
