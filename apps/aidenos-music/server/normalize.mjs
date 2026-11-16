import { MusicFailure } from "./errors.mjs";

const text = (value, max = 500) =>
  typeof value === "string"
    ? value.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "").slice(0, max)
    : "";
const integer = (value, fallback = 0) =>
  Number.isFinite(Number(value))
    ? Math.max(0, Math.floor(Number(value)))
    : fallback;
const id = (value) =>
  value === undefined || value === null ? "0" : String(value);
export function mediaURL(value, image = false) {
  if (typeof value !== "string" || value.length > 8192) return "";
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443" && url.port !== "80")
    )
      return "";
    if (
      !(
        url.hostname === "music.126.net" ||
        url.hostname.endsWith(".music.126.net") ||
        url.hostname === "music.163.com" ||
        url.hostname.endsWith(".music.163.com")
      )
    )
      return "";
    url.protocol = "https:";
    url.port = "";
    if (image && !url.searchParams.has("param"))
      url.searchParams.set("param", "480y480");
    return url.href;
  } catch {
    return "";
  }
}
export function artist(raw = {}) {
  return {
    id: id(raw.id ?? raw.userId),
    name: text(raw.name ?? raw.nickname, 120),
    coverUrl: mediaURL(raw.picUrl ?? raw.img1v1Url ?? raw.avatarUrl, true),
  };
}
export function album(raw = {}) {
  return {
    id: id(raw.id),
    title: text(raw.name ?? raw.title, 200),
    coverUrl: mediaURL(raw.picUrl ?? raw.blurPicUrl, true),
    artists: (raw.artists || (raw.artist ? [raw.artist] : [])).map(artist),
    publishTime: integer(raw.publishTime),
  };
}
export function user(raw = {}) {
  return {
    id: id(raw.userId ?? raw.id),
    name: text(raw.nickname ?? raw.name, 120) || "网易云用户",
    avatarUrl: mediaURL(raw.avatarUrl, true),
  };
}
export function track(raw = {}, privilege) {
  const record = album(raw.al ?? raw.album ?? {}),
    artists = raw.ar ?? raw.artists ?? [];
  return {
    id: id(raw.id),
    title: text(raw.name ?? raw.title, 200),
    artists: artists.map(artist),
    album: record,
    durationMs: integer(raw.dt ?? raw.duration),
    coverUrl: record.coverUrl,
    availability:
      Number(privilege?.st ?? raw.privilege?.st ?? raw.st) < 0
        ? "unavailable"
        : "unknown",
    alias: text((raw.alia ?? raw.alias ?? []).join?.(" / "), 200),
  };
}
/** Cloud rows wrap normal tracks in simpleSong and also include uploaded metadata for unmatched files. */
export function cloudTrack(raw = {}) {
  const song = raw.simpleSong && typeof raw.simpleSong === "object" ? raw.simpleSong : {};
  const artists = song.ar ?? song.artists;
  const record = song.al ?? song.album;
  return track({
    ...song,
    id: Number(song.id) > 0 ? song.id : raw.songId,
    name: song.name || raw.songName || String(raw.fileName ?? "").split(/[\\/]/).at(-1),
    ar: Array.isArray(artists) && artists.length ? artists : (typeof raw.artist === "string" && raw.artist ? [{ name: raw.artist }] : []),
    al: record && typeof record === "object" ? record : {
      name: typeof raw.album === "string" ? raw.album : "云盘音乐",
      picUrl: raw.coverUrl,
    },
    dt: song.dt ?? song.duration ?? raw.duration,
  });
}
export function trackComment(raw = {}) {
  return {
    id: id(raw.commentId ?? raw.id),
    user: user(raw.user ?? {}),
    content: text(raw.content, 4000),
    createdAt: integer(raw.time),
    liked: raw.liked === true,
    likeCount: integer(raw.likedCount),
    replies: (Array.isArray(raw.beReplied) ? raw.beReplied : []).filter((reply) => reply && typeof reply === "object").slice(0, 8).map((reply) => {
      const commentId = id(reply.beRepliedCommentId ?? reply.commentId);
      return {
        id: /^[1-9][0-9]{0,19}$/.test(commentId) ? commentId : null,
        user: user(reply.user ?? {}),
        content: text(reply.content, 4000),
      };
    }),
  };
}
export function playlist(raw = {}, ownerId = null) {
  const creator = user(raw.creator ?? raw.user ?? {});
  return {
    id: id(raw.id),
    title: text(raw.name ?? raw.title, 200),
    coverUrl: mediaURL(raw.coverImgUrl ?? raw.picUrl, true),
    description: text(raw.description ?? raw.copywriter, 6000),
    creator,
    trackCount: integer(raw.trackCount ?? raw.trackIds?.length),
    playCount: integer(raw.playCount ?? raw.playcount),
    tags: Array.isArray(raw.tags)
      ? raw.tags.slice(0, 20).map((tag) => text(tag, 50))
      : [],
    editable:
      !!ownerId && creator.id === ownerId && Number(raw.specialType) !== 5,
    subscribed: !!raw.subscribed,
    privacy: Number(raw.privacy) === 10 ? "private" : "public",
  };
}
export function playback(raw, requestedQuality, now) {
  if (!raw || typeof raw !== "object")
    throw new MusicFailure("unavailable", "这首歌暂时无法播放。", 404);
  const url = mediaURL(raw.url);
  if (!url)
    throw new MusicFailure(
      "unavailable",
      "这首歌暂时无法播放，可能需要登录、会员或所在地区的播放权限。",
      404,
    );
  const trial = raw.freeTrialInfo;
  const preview =
    trial &&
    Number.isFinite(Number(trial.start)) &&
    Number.isFinite(Number(trial.end)) &&
    Number(trial.end) > Number(trial.start)
      ? {
          startMs: Math.max(0, Number(trial.start) * 1000),
          endMs: Number(trial.end) * 1000,
        }
      : null;
  const br = integer(raw.br);
  const inferredQuality = /^(?:flac|wav|alac)$/i.test(raw.type ?? "")
    ? "lossless"
    : br >= 300000
      ? "exhigh"
      : br >= 180000
        ? "higher"
        : br > 0
          ? "standard"
          : requestedQuality;
  const actualQuality = ["standard", "higher", "exhigh", "lossless"].includes(
    raw.level,
  )
    ? raw.level
    : inferredQuality;
  return {
    url,
    expiresAt:
      now + Math.min(24 * 60 * 60, Math.max(1, integer(raw.expi, 1200))) * 1000,
    quality: actualQuality,
    availability: preview ? "preview" : "full",
    preview,
  };
}
