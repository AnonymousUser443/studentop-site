import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, fetchMe, fetchProgress, isAuthError, login, logout, readToken, saveProgress, writeToken } from '../../account';
import type { AccountUser, ExplorationState } from '../../types';
import { createCloudWriter } from '../saveLifecycle';
import { useExploration } from '../stores/useExploration';

type Options = { isolated: boolean; suspended?: boolean; replace: (state: ExplorationState) => unknown; message: (text: string) => void };

export function useAccountSession({ isolated, suspended = false, replace, message }: Options) {
  const state = useExploration(store => store.state);
  const [account, setAccount] = useState<AccountUser | null>(null);
  const [syncedToken, setSyncedToken] = useState<string | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const token = useRef<string | null>(null);
  const lifecycle = useRef(0);
  const localIntent = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const writer = useRef(createCloudWriter(saveProgress, () => token.current));
  const clearPending = useCallback(() => { clearTimeout(pending.current); pending.current = undefined; }, []);
  const detach = useCallback(async () => {
    const previous = token.current;
    token.current = null;
    lifecycle.current += 1;
    clearPending();
    setAccount(null);
    setSyncedToken(null);
    setLoginBusy(false);
    setLoginError(null);
    if (!isolated) writeToken(null);
    if (previous && !isolated) await logout(previous).catch(() => undefined);
  }, [isolated, clearPending]);

  const syncRemote = useCallback(async (sessionToken: string, generation: number, intent: number, quiet = false) => {
    try {
      const progress = await fetchProgress(sessionToken);
      if (lifecycle.current !== generation || token.current !== sessionToken) return false;
      if (progress.state && localIntent.current === intent) replace(progress.state);
      else if (!progress.state) await writer.current(sessionToken, useExploration.getState().state);
      if (lifecycle.current !== generation || token.current !== sessionToken) return false;
      setSyncedToken(sessionToken);
      return true;
    } catch (error) {
      if (isAuthError(error)) throw error;
      if (!quiet && lifecycle.current === generation) message('已保留本机旅途，云端暂时无法读取；网络恢复后会继续同步');
      return false;
    }
  }, [replace, message]);

  useEffect(() => {
    if (isolated) return;
    const sessionToken = readToken();
    if (!sessionToken) return;
    token.current = sessionToken;
    const generation = ++lifecycle.current, intent = localIntent.current;
    void (async () => {
      try {
        const { user } = await fetchMe(sessionToken);
        if (lifecycle.current !== generation) return;
        await syncRemote(sessionToken, generation, intent);
        if (lifecycle.current === generation) setAccount(user);
      } catch (error) {
        if (lifecycle.current === generation && isAuthError(error)) void detach();
      }
    })();
    return () => { lifecycle.current += 1; clearPending(); };
  }, [isolated, syncRemote, detach, clearPending]);

  useEffect(() => {
    if (isolated || suspended || !account || !token.current || syncedToken !== token.current) return;
    const sessionToken = token.current;
    pending.current = setTimeout(() => {
      pending.current = undefined;
      void writer.current(sessionToken, useExploration.getState().state).catch(error => {
        if (isAuthError(error) && token.current === sessionToken) void detach();
      });
    }, 700);
    return clearPending;
  }, [state, account, syncedToken, isolated, suspended, clearPending, detach]);

  // A failed initial GET must never turn into a PUT of a stale local archive.
  // Authenticate the UI, but wait for a successful read (or explicit reset) before autosaving.
  useEffect(() => {
    const sessionToken = token.current;
    if (isolated || suspended || !account || !sessionToken || syncedToken === sessionToken) return;
    const generation = lifecycle.current;
    let disposed = false, reading = false;
    let timer: ReturnType<typeof setTimeout>;
    const retry = async () => {
      if (disposed || reading) return;
      clearTimeout(timer); reading = true;
      let ready = false;
      try { ready = await syncRemote(sessionToken, generation, localIntent.current, true); }
      catch (error) { if (isAuthError(error) && token.current === sessionToken) void detach(); }
      finally {
        reading = false;
        if (!disposed && !ready && lifecycle.current === generation && token.current === sessionToken) timer = setTimeout(() => { void retry(); }, 5000);
      }
    };
    const online = () => { void retry(); };
    timer = setTimeout(online, 5000);
    window.addEventListener('online', online);
    return () => { disposed = true; clearTimeout(timer); window.removeEventListener('online', online); };
  }, [account, syncedToken, isolated, suspended, syncRemote, detach]);

  const handleLogin = useCallback(async (nickname: string, studentId: string, password: string) => {
    if (loginBusy) return;
    if (isolated) { setLoginError('当前为独立演示 / 标定模式，不连接真实账号；请在普通页面登录'); return; }
    setLoginBusy(true); setLoginError(null);
    const generation = ++lifecycle.current, intent = localIntent.current;
    try {
      const result = await login(nickname, studentId, password);
      if (lifecycle.current !== generation) return;
      token.current = result.token; writeToken(result.token);
      await syncRemote(result.token, generation, intent);
      if (lifecycle.current === generation) setAccount(result.user);
    } catch (error) {
      if (lifecycle.current !== generation) return;
      if (isAuthError(error)) { token.current = null; writeToken(null); }
      setLoginError(error instanceof ApiError ? `登录失败：${error.message}` : '无法连接账号服务，请检查网络后重试，或先以游客身份进入');
    } finally { if (lifecycle.current === generation) setLoginBusy(false); }
  }, [isolated, loginBusy, syncRemote]);

  const persistNow = useCallback(async (snapshot: ExplorationState) => {
    localIntent.current += 1;
    clearPending();
    const sessionToken = token.current;
    if (isolated || !sessionToken) return;
    try {
      await writer.current(sessionToken, snapshot);
      if (token.current === sessionToken) setSyncedToken(sessionToken);
    }
    catch (error) { if (isAuthError(error) && token.current === sessionToken) void detach(); throw error; }
  }, [isolated, clearPending, detach]);

  return { account, loginBusy, loginError, login: handleLogin, detach, persistNow, clearError: () => setLoginError(null) };
}
