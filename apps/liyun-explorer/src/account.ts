import type { AccountUser, ExplorationState } from './types';

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
    res = await fetch(API_BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
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

export function login(nickname: string, studentId: string): Promise<LoginResult> {
  return api<LoginResult>('/auth/login', { method: 'POST', body: { nickname, studentId } });
}

export function logout(token: string): Promise<{ ok: boolean }> {
  return api('/auth/logout', { method: 'POST', token });
}

export function fetchMe(token: string): Promise<{ user: AccountUser }> {
  return api('/auth/me', { token });
}

export function fetchProgress(token: string): Promise<ServerProgress> {
  return api('/progress', { token });
}

export function saveProgress(token: string, state: ExplorationState): Promise<{ updatedAt: string }> {
  return api('/progress', { method: 'PUT', token, body: { state } });
}
