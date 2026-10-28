import { describe, it, expect, vi, afterEach } from 'vitest';
import { ApiError, fetchMe, fetchProgress, isAuthError, login, saveProgress, sanitizeCloudState } from './account';
import { LANDMARKS, START_UV } from './data';
import type { ExplorationState } from './types';
const PASSWORD = 'synthetic-passphrase-24';
const okJson = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
afterEach(() => vi.unstubAllGlobals());
const state: ExplorationState = { version: 2, discoveredIds: ['wencui'], unlockedRegionIds: ['wencui'], playerUV: { ...START_UV }, settings: { music: true, volume: 0.35, quality: 'high', reducedMotion: false, track: 0 } };

describe('账号客户端安全边界', () => {
  it('口令仅随一次同源POST，不落storage；禁缓存和重定向', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({ token: 'abc', user: { id: 'u1', nickname: 'fixture', studentId: 'demo-one', uid: 'LYABC' } }));
    const setItem = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('localStorage', { setItem });
    vi.stubGlobal('location', { protocol: 'https:', hostname: 'liyun.example.test' });
    const result = await login('fixture', 'demo-one', PASSWORD);
    expect(result.token).toBe('abc');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe('/api/auth/login'); expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ nickname: 'fixture', studentId: 'demo-one', password: PASSWORD });
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.redirect).toBe('error'); expect(init.cache).toBe('no-store');
    expect(init.credentials).toBe('same-origin'); expect(setItem).not.toHaveBeenCalled();
  });
  it('非法口令/公网HTTP不发请求，本机开发例外', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({ token: 'abc', user: {} }));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('location', { protocol: 'https:', hostname: 'liyun.example.test' });
    for (const password of ['short', 'x'.repeat(129)]) await expect(login('fixture', 'demo', password)).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
    vi.stubGlobal('location', { protocol: 'http:', hostname: 'liyun.example.test' });
    await expect(login('fixture', 'demo', PASSWORD)).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
    vi.stubGlobal('location', { protocol: 'http:', hostname: '127.0.0.1' });
    await login('fixture', 'demo', PASSWORD); expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('saveProgress只传白名单与公共固定UV，不传GPS/口令/未知嵌套字段', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({ updatedAt: '2026-01-01T00:00:00.000Z' }));
    vi.stubGlobal('fetch', fetchMock);
    const polluted = { ...state, rawGPS: 'private-gps-marker', password: 'private-password-marker', discoveredIds: ['wencui', 'wencui', 'private-id-marker'], unlockedRegionIds: ['private-region-marker'], playerUV: { u: 0.123456, v: 0.654321, rawGPS: 'private-uv-marker' }, settings: { ...state.settings, secret: 'private-setting-marker' } };
    await saveProgress('token-1', polluted);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe('/api/progress'); expect(init.method).toBe('PUT');
    expect(init.headers.Authorization).toBe('Bearer token-1');
    const saved = JSON.parse(init.body as string).state;
    expect((init.body as string).includes('private-')).toBe(false);
    expect(Object.keys(saved).sort()).toEqual(['discoveredIds', 'playerUV', 'settings', 'unlockedRegionIds', 'version']);
    expect(Object.keys(saved.settings).sort()).toEqual(['music', 'quality', 'reducedMotion', 'track', 'volume']);
    expect(saved.discoveredIds).toEqual(['wencui']); expect(saved.unlockedRegionIds).toEqual(['wencui']);
    expect(saved.playerUV).toEqual(START_UV);
    expect(polluted.playerUV.u).toBe(0.123456); // Don't mutate the app's in-memory state.
  });
  it('已发现地标固定UV可传，未发现地标UV与任意坐标都退回起点', () => {
    const tower = LANDMARKS.find(p => p.id === 'tower')!;
    expect(sanitizeCloudState({ ...state, discoveredIds: ['tower'], playerUV: tower.uv }).playerUV).toEqual(tower.uv);
    expect(sanitizeCloudState({ ...state, discoveredIds: [], playerUV: tower.uv }).playerUV).toEqual(START_UV);
    expect(sanitizeCloudState({ ...state, playerUV: { u: 0.5, v: 0.5 } }).playerUV).toEqual(START_UV);
  });
  it('v1仅迁移设置不升级演示打卡，云返回同样剔除未知敏感字段', async () => {
    const old = { ...state, version: 1, rawGPS: 'private-gps-marker', settings: { ...state.settings, music: false, secret: 'private-secret-marker' } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson({ state: old, checkins: [{ landmarkId: 'wencui', discoveredAt: '2026-01-01T00:00:00.000Z' }], updatedAt: '2026-01-01T00:00:00.000Z' })));
    const progress = await fetchProgress('token');
    expect(progress.state?.version).toBe(2); expect(progress.state?.discoveredIds).toEqual([]);
    expect(progress.checkins).toEqual([]); expect(progress.state?.settings.music).toBe(false);
    expect(progress.state?.playerUV).toEqual(START_UV); expect(JSON.stringify(progress).includes('private-')).toBe(false);
  });
  it('非2xx抛出ApiError，401可被isAuthError识别', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: '未登录或登录已过期' }), { status: 401 })));
    const err = await fetchMe('bad').catch(e => e) as ApiError;
    expect(err).toBeInstanceOf(ApiError); expect(err.status).toBe(401); expect(isAuthError(err)).toBe(true);
  });
  it('网络失败原样抛出供游客降级，不伪造成功', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const err = await fetchProgress('t').catch(e => e);
    expect(err).toBeInstanceOf(TypeError); expect(isAuthError(err)).toBe(false);
  });
});
