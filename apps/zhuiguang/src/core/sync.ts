import { appUrl, roomApiPath, showId } from './url';
import { authorizeHost, getShow, showRequest, ShowApiError, type ShowSession } from './show-api';
import { useEffect } from 'react';
import { create } from 'zustand';
import { io, type Socket } from 'socket.io-client';
import deckData from '../content/deck.json';

export type Role = 'display' | 'presenter' | 'audience';
export interface RaffleView { count: number; startedAt: number | null; winners: string[] }
export interface SyncState {
  show?: ShowSession;
  pageId: string;
  revision: number;
  startedAt: number | null;
  paused: boolean;
  pausedAt: number | null;
  blackout: boolean;
  interaction: { id: string; open: boolean; deadline: number } | null;
  online: { display: number; presenter: number; audience: number };
  privateCount: number;
  raffle?: RaffleView | null;
  media?: { pageId: string; playing: boolean; position: number; sampledAt: number } | null;
}
export interface LiveMessage {
  id: string;
  interactionId: string;
  text: string;
  emoji?: string;
  createdAt: number;
  selected: boolean;
  hidden: boolean;
}
export type PollResults = Record<string, { total: number; counts: number[] }>;
export interface Submission { requestId?: string; interactionId: string; text?: string; emoji?: string; choice?: number; anonymous?: boolean }
export interface SubmitResult { ok: boolean; error?: string; id?: string; code?: string; applied?: boolean; persisted?: boolean; revision?: number }
type Snapshot = { state: SyncState; authorized: boolean; publicMessages: LiveMessage[]; privateMessages: LiveMessage[]; results: PollResults; raffleTicket?: string | null };
type Control = { action: string; pageId?: string; value?: boolean; id?: string; blackout?: boolean; expectedRevision?: number; position?: number; playing?: boolean };
interface SyncStore {
  state: SyncState;
  connected: boolean;
  authorized: boolean;
  admitted: boolean | null;
  error: string | null;
  joinError: string | null;
  publicMessages: LiveMessage[];
  privateMessages: LiveMessage[];
  raffleTicket: string | null;
  results: PollResults;
}

const pageIds = deckData.map((page) => page.id);
const params = new URLSearchParams(window.location.search);
const rehearsal = params.get('rehearsal') === '1';
const initial: SyncState = { pageId: 'P0-02', revision: 0, startedAt: null, paused: false, pausedAt: null, blackout: false, interaction: null, online: { display: 0, presenter: 0, audience: 0 }, privateCount: 0 };
const storageScope = 'light-chaser:' + (rehearsal ? 'rehearsal' : showId || 'entry');
function stored(key: string, session = false) {
  try { return (session ? sessionStorage : localStorage).getItem(storageScope + ':' + key); }
  catch { return null; }
}
function save(key: string, value: string, session = false) {
  try { (session ? sessionStorage : localStorage).setItem(storageScope + ':' + key, value); }
  catch { /* Storage denial does not prevent presenting. */ }
}
function cachedState(): SyncState {
  try {
    const saved = JSON.parse(stored('light-chaser-state') || 'null');
    if (saved && pageIds.includes(saved.pageId)) return { ...initial, ...saved, online: initial.online, interaction: null, media: null, raffle: null };
  } catch { /* Ignore corrupt public caches. */ }
  return initial;
}
const useStore = create<SyncStore>(() => ({ state: cachedState(), connected: false, authorized: false, admitted: null, error: null, joinError: null, publicMessages: [], privateMessages: [], raffleTicket: null, results: {} }));
let socket: Socket | undefined;
let activeRole: Role = 'audience';
let visitorId = stored('light-chaser-visitor');
if (!visitorId) { visitorId = globalThis.crypto?.randomUUID?.() || `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`; save('light-chaser-visitor', visitorId); }
let controlToken: string | null = null;
let serverRevision = Number(stored('server-revision')) || 0;
let pendingOffline: { baseline: number; pageId?: string; blackout?: boolean } | null = null;
let channel: BroadcastChannel | undefined;

function rememberRevision(revision: number) {
  serverRevision = revision;
  save('server-revision', String(revision));
}
function updateState(state: SyncState) {
  useStore.setState({ state });
  save('light-chaser-state', JSON.stringify(state));
}
function connect(role: Role) {
  activeRole = role;
  if (rehearsal) {
    useStore.setState({ authorized: role !== 'audience' });
    if (!channel && 'BroadcastChannel' in window) {
      channel = new BroadcastChannel('light-chaser-rehearsal');
      channel.onmessage = (event: MessageEvent<SyncState>) => {
        if (event.data && pageIds.includes(event.data.pageId)) updateState({ ...initial, ...event.data });
      };
    }
    return;
  }
  const room = showId;
  if (socket || !room) return;
  controlToken = stored('control:' + role, true);
  if (role !== 'audience' && controlToken) useStore.setState({ authorized: true });
  socket = io('/show-' + room, { path: appUrl('/socket.io'), autoConnect: false, reconnection: true, reconnectionDelay: 800, reconnectionDelayMax: 4000, timeout: 5000 });
  socket.on('connect', () => {
    useStore.setState({ connected: false, joinError: null });
    socket?.timeout(6000).emit('join', { role: activeRole, visitorId, controlToken }, (error: Error | null, reply: SubmitResult & { admitted?: boolean }) => {
      if (error || !reply?.ok) {
        if (reply?.code === 'SHOW_ENDED') {
          useStore.setState({ connected: false, joinError: '本场演讲已经结束。' });
        } else {
          useStore.setState({ connected: false, joinError: reply?.error || '场次连接超时，请重试。' });
        }
        return;
      }
      useStore.setState({
        connected: true, joinError: null,
        ...(activeRole === 'audience' ? { admitted: Boolean(reply.admitted) } : {}),
      });
    });
  });
  socket.on('snapshot', (snapshot: Snapshot) => {
    rememberRevision(snapshot.state.revision);
    useStore.setState({ authorized: snapshot.authorized, publicMessages: snapshot.publicMessages, privateMessages: activeRole === 'presenter' && snapshot.authorized ? snapshot.privateMessages : [], results: snapshot.results, raffleTicket: activeRole === 'audience' ? snapshot.raffleTicket ?? null : null });
    updateState(snapshot.state);
    if (snapshot.state.show?.endedAt != null) { pendingOffline = null; return; }
    if (pendingOffline && snapshot.authorized) {
      if (snapshot.state.revision === pendingOffline.baseline) {
        if (pendingOffline.pageId || typeof pendingOffline.blackout === 'boolean') sendControl({ action: 'resume', expectedRevision: pendingOffline.baseline, pageId: pendingOffline.pageId, blackout: pendingOffline.blackout });
      } else useStore.setState({ error: '重连后已跟随舞台最新进度；离线操作未覆盖另一端的控制。' });
      pendingOffline = null;
    } else if (pendingOffline) { pendingOffline = null; useStore.setState({ error: '离线控制未重放，请先重新授权并核对舞台进度。' }); }
  });
  socket.on('state', (state: SyncState) => { rememberRevision(state.revision); updateState(state); });
  socket.on('public:messages', (publicMessages: LiveMessage[]) => useStore.setState({ publicMessages }));
  socket.on('public:message', (message: LiveMessage) => useStore.setState((previous) => ({ publicMessages: [...previous.publicMessages, message].slice(-3000) })));
  socket.on('private:messages', (privateMessages: LiveMessage[]) => { if (activeRole === 'presenter' && useStore.getState().authorized) useStore.setState({ privateMessages }); });
  socket.on('raffle:ticket', (raffleTicket: string | null) => { if (activeRole === 'audience') useStore.setState({ raffleTicket }); });
  socket.on('results', (results: PollResults) => useStore.setState({ results }));
  socket.on('authorization', (authorization: { authorized: boolean; reason?: string }) => {
    if (!authorization.authorized) useStore.setState({ authorized: false, privateMessages: [], error: authorization.reason || '请重新输入演讲口令。' });
  });
  socket.on('disconnect', () => useStore.setState({ connected: false }));
  socket.on('connect_error', (error: Error & { data?: { code?: string } }) => {
    const missing = error.data?.code === 'SHOW_NOT_FOUND' || error.message === 'Invalid namespace';
    useStore.setState({ connected: false, joinError: missing ? '找不到这个场次，请核对六位场次号。' : '暂时连不上场次服务，正在重试。' });
    if (missing) {
      void getShow(room).then(({ show }) => {
        if (show.endedAt != null) useStore.setState({ joinError: '本场演讲已经结束。' });
        else useStore.setState({ joinError: '场次连接暂不可用，请重试。' });
      }).catch(apiError => {
        if (apiError instanceof ShowApiError && apiError.status === 404) return;
        useStore.setState({ joinError: '场次连接暂不可用，请重试。' });
      });
    }
  });
  window.addEventListener('offline', () => socket?.io.engine?.close());
  window.addEventListener('online', () => socket?.connect());
  socket.connect();
}
function sendControl(payload: Control) {
  socket?.timeout(5000).emit('control', payload, (error: Error | null, reply: SubmitResult) => {
    if (error) useStore.setState({ error: '控制未送达，请检查连接后重试。' });
    else if (!reply?.ok) useStore.setState({ error: reply?.error || '控制未送达。' });
  });
}
function localControl(payload: Control) {
  const state = { ...useStore.getState().state };
  const previousPage = state.pageId;
  switch (payload.action) {
    case 'go': if (payload.pageId && pageIds.includes(payload.pageId)) state.pageId = payload.pageId; break;
    case 'next': state.pageId = pageIds[Math.min(pageIds.length - 1, pageIds.indexOf(state.pageId) + 1)]; break;
    case 'prev': state.pageId = pageIds[Math.max(1, pageIds.indexOf(state.pageId) - 1)]; break;
    case 'blackout': state.blackout = Boolean(payload.value); break;
    case 'start': state.startedAt = Date.now(); state.paused = false; state.pausedAt = null; break;
    case 'reset-timer': state.startedAt = null; state.paused = false; state.pausedAt = null; break;
    case 'pause':
      if (payload.value && !state.paused) { state.pausedAt = Date.now(); state.paused = true; }
      else if (!payload.value && state.paused) { if (state.startedAt && state.pausedAt) state.startedAt += Date.now() - state.pausedAt; state.pausedAt = null; state.paused = false; }
      break;
    case 'interaction:open': {
      const interaction = deckData.find((page) => page.interaction?.id === payload.id)?.interaction;
      if (interaction) state.interaction = { id: interaction.id, open: true, deadline: Date.now() + interaction.seconds * 1000 };
      break;
    }
    case 'interaction:close': if (state.interaction) state.interaction = { ...state.interaction, open: false }; break;
  }
  if (['go', 'next', 'prev'].includes(payload.action) && state.interaction && deckData.find((page) => page.id === state.pageId)?.interaction?.id !== state.interaction.id) state.interaction = null;
  if (previousPage !== state.pageId && rehearsal) {
    const interaction = deckData.find(page => page.id === state.pageId)?.interaction;
    if (interaction && ['P0-08', 'P1-03', 'P8-20'].includes(state.pageId)) state.interaction = { id: interaction.id, open: true, deadline: Date.now() + interaction.seconds * 1000 };
  }
  state.revision += 1; updateState(state);
  if (rehearsal) channel?.postMessage(state);
  else {
    pendingOffline ||= { baseline: serverRevision };
    if (['go', 'next', 'prev'].includes(payload.action)) pendingOffline.pageId = state.pageId;
    if (payload.action === 'blackout') pendingOffline.blackout = state.blackout;
  }
}
function control(payload: Control) {
  const store = useStore.getState();
  if (store.state.show?.endedAt != null) return;
  if (activeRole === 'audience' || !store.authorized) { useStore.setState({ error: '请先输入终端显示的演讲口令。' }); return; }
  const offline = !store.connected || !navigator.onLine;
  if (!rehearsal && offline && payload.action.startsWith('interaction:')) { useStore.setState({ error: '观众互动需要网络连接。' }); return; }
  if (rehearsal || offline) localControl(payload);
  else sendControl(payload);
}
async function connectControl(pin: string): Promise<boolean> {
  if (rehearsal && activeRole !== 'audience') return true;
  if (!socket?.connected || !useStore.getState().connected) {
    useStore.setState({ error: useStore.getState().joinError || '正在连接场次，请稍候再授权。' });
    return false;
  }
  if (activeRole === 'presenter') {
    try { await authorizeHost(pin); }
    catch (error) {
      useStore.setState({ error: error instanceof ShowApiError ? error.message : '暂时无法完成演讲者授权，请重试。' });
      return false;
    }
  }
  return new Promise((resolve) => {
    socket?.timeout(5000).emit('authenticate', { pin }, (error: Error | null, reply: SubmitResult & { controlToken?: string }) => {
      if (error || !reply?.ok) { useStore.setState({ error: reply?.error || '连接超时，请重试。' }); resolve(false); return; }
      controlToken = reply.controlToken || null;
      if (controlToken) save('control:' + activeRole, controlToken, true);
      useStore.setState({ authorized: true, error: null }); resolve(true);
    });
  });
}
async function admit(): Promise<SubmitResult> {
  if (activeRole !== 'audience' || !showId || !socket) return { ok: false, error: '观众连接尚未准备好。' };
  try {
    let guest = stored('light-chaser-guest:' + showId);
    if (!guest) {
      guest = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
      save('light-chaser-guest:' + showId, guest);
    }
    const reply = await showRequest<SubmitResult>(roomApiPath(showId, '/entry'), { guest });
    socket.disconnect().connect();
    return reply;
  } catch (error) {
    return { ok: false, error: error instanceof ShowApiError ? error.message : '暂时连不上入场服务，请稍后重试。' };
  }
}
function measureLatency(): Promise<number | null> {
  if (!socket?.connected || !useStore.getState().admitted) return Promise.resolve(null);
  const started = performance.now();
  return new Promise(resolve => {
    socket?.timeout(3000).emit('latency', (error: Error | null) => resolve(error ? null : Math.round(performance.now() - started)));
  });
}
function submit(payload: Submission): Promise<SubmitResult> {
  if (!payload || typeof payload.interactionId !== 'string') return Promise.resolve({ ok: false, code: 'INVALID_PAYLOAD', error: '请保留原表单的互动编号后再投递。' });
  if (useStore.getState().state.show?.endedAt != null) return Promise.resolve({ ok: false, error: '本场演讲已经结束。' });
  if (!socket?.connected || !useStore.getState().connected || rehearsal) return Promise.resolve({ ok: false, error: rehearsal ? '彩排模式不发送观众投递。' : '连接中断，请在恢复后投递。' });
  return new Promise((resolve) => {
    socket?.timeout(6000).emit('submit', payload, (error: Error | null, reply: SubmitResult) => resolve(error ? { ok: false, error: '投递未确认，请恢复连接后检查。' } : reply));
  });
}
function moderate(id: string, action: 'select' | 'hide' | 'restore') {
  if (activeRole !== 'presenter' || !useStore.getState().authorized || !socket?.connected || useStore.getState().state.show?.endedAt != null) return;
  socket.timeout(5000).emit('moderate', { id, action }, (error: Error | null, reply: SubmitResult) => { if (error || !reply?.ok) useStore.setState({ error: reply?.error || '这条投递暂时无法管理。' }); });
}
const actions = {
  connectControl,
  retryConnection: () => {
    if (!socket) return;
    useStore.setState({ connected: false, joinError: null, error: null });
    socket.disconnect().connect();
  },
  acceptEndedShow: (show: ShowSession) => {
    if (show.id !== showId || show.endedAt == null) return;
    pendingOffline = null;
    updateState({ ...useStore.getState().state, show, interaction: null, media: null, raffle: null });
  },
  admit,
  measureLatency,
  setMedia: (pageId: string, playing: boolean, position: number) => {
    if (!rehearsal && socket?.connected && useStore.getState().authorized && useStore.getState().state.show?.endedAt == null && pageId === useStore.getState().state.pageId) {
      socket.emit('control', { action: 'media:set', pageId, playing, position });
    }
  },
  go: (pageId: string) => control({ action: 'go', pageId }),
  next: () => control({ action: 'next' }),
  prev: () => control({ action: 'prev' }),
  setBlackout: (value: boolean) => control({ action: 'blackout', value }),
  start: () => control({ action: 'start' }),
  resetTimer: () => control({ action: 'reset-timer' }),
  setPaused: (value: boolean) => control({ action: 'pause', value }),
  openInteraction: (id: string) => control({ action: 'interaction:open', id }),
  closeInteraction: () => control({ action: 'interaction:close' }),
  raffle: (action: 'open' | 'draw' | 'close') => {
    if (rehearsal || !useStore.getState().connected) { useStore.setState({ error: '抽奖需要连接现场服务。' }); return; }
    control({ action: 'raffle:' + action });
  },
  submit,
  moderate,
  clearError: () => useStore.setState({ error: null }),
};
export function useSync(role: Role, enabled = true) {
  const store = useStore();
  useEffect(() => { if (enabled) connect(role); }, [enabled, role]);
  return { ...store, ...actions, state: enabled ? store.state : initial, rehearsal };
}
