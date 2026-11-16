import { DatabaseSync } from "node:sqlite";
import {
  randomBytes,
  createHash,
  createCipheriv,
  createDecipheriv,
  timingSafeEqual,
} from "node:crypto";
import { mkdirSync, chmodSync } from "node:fs";
import path from "node:path";
import { MusicFailure } from "./errors.mjs";

export const SESSION_COOKIE = "AidenMusicSession";
export const PLAYBACK_COOKIE = "AidenMusicPlayback";
export const COOKIE_PATH = "/__desktop/music/v1/";
export const SESSION_TTL = 30 * 24 * 60 * 60 * 1000;
export const LEASE_TTL = 12 * 60 * 60 * 1000;
const hash = (value) => createHash("sha256").update(value).digest("hex");
const validToken = (value) =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
function equal(left, right) {
  const a = Buffer.from(String(left)),
    b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}
export function readCookie(header, name) {
  const matches = String(header || "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(name + "="));
  if (matches.length > 1)
    throw new MusicFailure(
      "invalid_request",
      "音乐会话信息重复，请重新打开播放器。",
      400,
    );
  const value = matches[0]?.slice(name.length + 1);
  return validToken(value) ? value : null;
}
export function cookieHeader(name, token, { secure = true, maxAge = 0 } = {}) {
  return `${name}=${token}; Path=${COOKIE_PATH}; Max-Age=${Math.floor(maxAge / 1000)}; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`;
}
export function clearCookies(secure) {
  return [
    cookieHeader(SESSION_COOKIE, "", { secure }),
    cookieHeader(PLAYBACK_COOKIE, "", { secure }),
  ];
}

export class MusicStore {
  constructor({ dataDir, file, cookieKey, now = Date.now } = {}) {
    if (!/^[a-f0-9]{64}$/i.test(cookieKey || ""))
      throw new Error("MUSIC_COOKIE_KEY must contain 32 bytes encoded as hex.");
    this.key = Buffer.from(cookieKey, "hex");
    this.now = now;
    if (file !== ":memory:") {
      if (!dataDir && !file) throw new Error("MUSIC_DATA_DIR is required.");
      const directory = dataDir || path.dirname(file);
      mkdirSync(directory, { recursive: true, mode: 0o700 });
      chmodSync(directory, 0o700);
      file ||= path.join(directory, "music.sqlite");
    }
    this.db = new DatabaseSync(file);
    this.db
      .exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;
      CREATE TABLE IF NOT EXISTS music_sessions (
        id TEXT PRIMARY KEY, encrypted_cookies TEXT NOT NULL, profile TEXT, expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS playback_leases (
        id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES music_sessions(id) ON DELETE CASCADE,
        csrf_hash TEXT NOT NULL, expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS playback_session ON playback_leases(session_id);`);
    if (file !== ":memory:") chmodSync(file, 0o600);
    this.sweep();
  }
  encrypt(cookies) {
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(cookies), "utf8"),
      cipher.final(),
    ]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
      "base64",
    );
  }
  decrypt(value) {
    try {
      const bytes = Buffer.from(value, "base64");
      const decipher = createDecipheriv(
        "aes-256-gcm",
        this.key,
        bytes.subarray(0, 12),
      );
      decipher.setAuthTag(bytes.subarray(12, 28));
      return JSON.parse(
        Buffer.concat([
          decipher.update(bytes.subarray(28)),
          decipher.final(),
        ]).toString("utf8"),
      );
    } catch {
      throw new MusicFailure(
        "upstream_error",
        "音乐会话暂不可用，请重新登录。",
        503,
      );
    }
  }
  sweep() {
    this.db
      .prepare("DELETE FROM playback_leases WHERE expires_at <= ?")
      .run(this.now());
    this.db
      .prepare("DELETE FROM music_sessions WHERE expires_at <= ?")
      .run(this.now());
  }
  createSession() {
    this.sweep();
    if (
      this.db.prepare("SELECT COUNT(*) AS count FROM music_sessions").get()
        .count >= 10000
    )
      throw new MusicFailure(
        "rate_limited",
        "音乐服务正在忙，请稍后重试。",
        503,
        true,
      );
    const token = randomBytes(32).toString("hex"),
      id = hash(token),
      expiresAt = this.now() + SESSION_TTL;
    this.db
      .prepare(
        "INSERT INTO music_sessions (id,encrypted_cookies,profile,expires_at) VALUES (?,?,NULL,?)",
      )
      .run(id, this.encrypt({}), expiresAt);
    return { token, id, cookies: {}, user: null, expiresAt };
  }
  getSession(token) {
    if (!validToken(token)) return null;
    const row = this.db
      .prepare("SELECT * FROM music_sessions WHERE id=? AND expires_at>?")
      .get(hash(token), this.now());
    if (!row) return null;
    return {
      token,
      id: row.id,
      cookies: this.decrypt(row.encrypted_cookies),
      user: row.profile ? JSON.parse(row.profile) : null,
      expiresAt: row.expires_at,
    };
  }
  saveSession(session) {
    this.db
      .prepare(
        "UPDATE music_sessions SET encrypted_cookies=?,profile=? WHERE id=? AND expires_at>?",
      )
      .run(
        this.encrypt(session.cookies),
        session.user ? JSON.stringify(session.user) : null,
        session.id,
        this.now(),
      );
  }
  clearAuthentication(session) {
    session.cookies = {};
    session.user = null;
    this.saveSession(session);
    this.db
      .prepare("DELETE FROM playback_leases WHERE session_id=?")
      .run(session.id);
  }
  deleteSession(session) {
    this.db.prepare("DELETE FROM music_sessions WHERE id=?").run(session.id);
  }
  revokeLeases(session) {
    this.db
      .prepare("DELETE FROM playback_leases WHERE session_id=?")
      .run(session.id);
  }
  createLease(session) {
    this.revokeLeases(session);
    const token = randomBytes(32).toString("hex"),
      csrfToken = randomBytes(32).toString("hex");
    const expiresAt = Math.min(this.now() + LEASE_TTL, session.expiresAt);
    this.db
      .prepare(
        "INSERT INTO playback_leases (id,session_id,csrf_hash,expires_at) VALUES (?,?,?,?)",
      )
      .run(hash(token), session.id, hash(csrfToken), expiresAt);
    return { token, csrfToken, expiresAt };
  }
  authorizeLease(session, token, csrfToken) {
    if (!validToken(token) || !validToken(csrfToken)) return false;
    const row = this.db
      .prepare(
        "SELECT session_id,csrf_hash FROM playback_leases WHERE id=? AND expires_at>?",
      )
      .get(hash(token), this.now());
    return (
      !!row &&
      row.session_id === session.id &&
      equal(row.csrf_hash, hash(csrfToken))
    );
  }
  close() {
    this.db.close();
    this.key.fill(0);
  }
}
