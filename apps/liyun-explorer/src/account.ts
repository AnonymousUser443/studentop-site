import type { AccountUser, ExplorationState } from './types';
import { LANDMARKS, START_UV } from './data';

// 账号与进度同步客户端。所有请求走同源 /api/*（开发经 Vite 反代，生产经 nginx 反代）。
// 任何网络失败都向上抛出，由调用方决定是降级为「游客/本机存档」还是给出提示。

export type CheckinRecord = { landmarkId: string; discoveredAt: string };
export type ServerProgress = { state: ExplorationState | null; checkins: CheckinRecord[]; updatedAt: string | null };
export type LoginResult = { token: string; user: AccountUser };

export const SESSION_KEY = 'liyun.session.v1';

const API_BASE = '/api';

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = 'ApiError'; }
}

export const isAuthError = (error: unknown) => error instanceof ApiError && error.status === 401;

export function readToken(): string | null {
  try { return localStorage.getItem(SESSION_KEY); }
  catch { return null; }
}

export function writeToken(token: string | null): void {
  try { token ? localStorage.setItem(SESSION_KEY, token) : localStorage.removeItem(SESSION_KEY); }
  catch { /* 隐私模式下会话仅存活于内存 */ }
}

type ApiOptions = { method?: string; token?: string | null; body?: unknown };

async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', token, body } = options;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(API_BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, credentials: 'same-origin', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer' });
  }
  catch (error) {
    // 后端不可达（未部署 / 网络断开 / 静态托管无接口）时原样抛出，便于上层降级。
    throw error;
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; }
  catch { data = null; }
  if (!res.ok) {
    const message = data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string'
      ? (data as { error: string }).error
      : `请求失败（${res.status}）`;
    throw new ApiError(res.status, message);
  }
  return data as T;
}

export function login(nickname: string, studentId: string, password: string): Promise<LoginResult> {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128 || /[\u0000-\u001f\u007f]/.test(password)) return Promise.reject(new ApiError(400, '访问口令须为 8–128 个字符，且不能含控制字符'));
  if (typeof location !== 'undefined' && location.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) return Promise.reject(new ApiError(400, '账号登录仅支持 HTTPS（本机开发除外）'));
  return api<LoginResult>('/auth/login', { method: 'POST', body: { nickname, studentId, password } });
}

export function logout(token: string): Promise<{ ok: boolean }> {
  return api('/auth/logout', { method: 'POST', token });
}

export function fetchMe(token: string): Promise<{ user: AccountUser }> {
  return api('/auth/me', { token });
}

export async function fetchProgress(token: string): Promise<ServerProgress> {
  const data = await api<ServerProgress>('/progress', { token });
  const state = data.state ? sanitizeCloudState(data.state) : null;
  const ids = new Set(state?.discoveredIds ?? []);
  return {
    state,
    checkins: Array.isArray(data.checkins) ? data.checkins.filter(c => c && ids.has(c.landmarkId) && typeof c.discoveredAt === 'string' && Number.isFinite(Date.parse(c.discoveredAt))).map(c => ({ landmarkId: c.landmarkId, discoveredAt: new Date(c.discoveredAt).toISOString() })) : [],
    updatedAt: typeof data.updatedAt === 'string' && Number.isFinite(Date.parse(data.updatedAt)) ? new Date(data.updatedAt).toISOString() : null,
  };
}

const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

// Send only public anchors, never an arbitrary/live-GPS-derived UV or unknown nested fields.
export function sanitizeCloudState(value: unknown): ExplorationState {
  const raw = record(value);
  const known = new Set(LANDMARKS.map(p => p.id));
  const discoveredIds = raw.version === 2 && Array.isArray(raw.discoveredIds)
    ? [...new Set(raw.discoveredIds.filter((id: unknown): id is string => typeof id === 'string' && known.has(id)))] : [];
  const places = LANDMARKS.filter(p => discoveredIds.includes(p.id));
  const point = record(raw.playerUV);
  const anchor = raw.version === 2 ? [START_UV, ...places.map(p => p.uv)].find(p => p.u === point.u && p.v === point.v) : undefined;
  const s = record(raw.settings);
  return {
    version: 2, discoveredIds, unlockedRegionIds: [...new Set(places.map(p => p.regionId))],
    playerUV: { ...(anchor ?? START_UV) },
    settings: {
      music: typeof s.music === 'boolean' ? s.music : true,
      volume: typeof s.volume === 'number' && Number.isFinite(s.volume) ? Math.max(0, Math.min(1, s.volume)) : 0.35,
      quality: s.quality === 'low' ? 'low' : 'high',
      reducedMotion: typeof s.reducedMotion === 'boolean' ? s.reducedMotion : false,
      track: typeof s.track === 'number' && Number.isInteger(s.track) && s.track >= 0 && s.track <= 2 ? s.track : 0,
    },
  };
}

export function saveProgress(token: string, state: ExplorationState): Promise<{ updatedAt: string }> {
  return api('/progress', { method: 'PUT', token, body: { state: sanitizeCloudState(state) } });
}
