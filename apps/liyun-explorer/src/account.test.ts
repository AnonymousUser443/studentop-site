import { describe, it, expect, vi, afterEach } from 'vitest';
import { ApiError, fetchMe, fetchProgress, isAuthError, login, saveProgress } from './account';
import type { ExplorationState } from './types';

const okJson = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

const state: ExplorationState = { version: 1, discoveredIds: ['wencui'], unlockedRegionIds: ['wencui'], playerUV: { u: 0.5, v: 0.5 }, settings: { music: true, volume: 0.35, quality: 'high', reducedMotion: false, track: 0 } };

describe('账号客户端', () => {
  it('login 发送昵称与学号并返回 token 与 user', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({ token: 'abc', user: { id: 'u1', nickname: '小理', studentId: '20240001', uid: 'LYABC' } }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await login('小理', '20240001');
    expect(result.token).toBe('abc');
    expect(result.user.nickname).toBe('小理');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe('/api/auth/login');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ nickname: '小理', studentId: '20240001' });
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('saveProgress 携带 Bearer 令牌并 PUT 完整 state', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({ updatedAt: '2026-01-01T00:00:00.000Z' }));
    vi.stubGlobal('fetch', fetchMock);
    await saveProgress('token-1', state);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe('/api/progress');
    expect(init.method).toBe('PUT');
    expect(init.headers.Authorization).toBe('Bearer token-1');
    expect(JSON.parse(init.body as string).state).toEqual(state);
  });

  it('非 2xx 抛出 ApiError，401 可被 isAuthError 识别', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: '未登录或登录已过期' }), { status: 401 })));
    const err = await fetchMe('bad').catch(e => e) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
    expect(isAuthError(err)).toBe(true);
    expect(err.message).toBe('未登录或登录已过期');
  });

  it('网络失败时原样抛出（非 ApiError），便于上层降级为游客', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const err = await fetchProgress('t').catch(e => e);
    expect(err).toBeInstanceOf(TypeError);
    expect(isAuthError(err)).toBe(false);
  });
});
