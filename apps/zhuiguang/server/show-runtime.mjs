import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { createRaffle } from './raffle.mjs';
import { openShowDatabase } from './show-database.mjs';
import { audienceAdmissions } from './audience-admissions.mjs';

const automaticInteractions = new Set(['P0-08', 'P1-03', 'P8-20']);
const filmPages = new Set(['P1-07', 'P2-13', 'P5-16']);
export const endedReply = { ok: false, code: 'SHOW_ENDED', error: '本场已结束。' };

export async function createShowRuntime({ show, dataDir, deck, pin, publicOrigin, controlTtlMs, io, hostAuth, hostRate }) {
  const pageIds = deck.map(page => page.id);
  const pages = new Map(deck.map(page => [page.id, page]));
  const interactions = new Map(deck.filter(page => page.interaction && page.interaction.mode !== 'hands').map(page => [page.interaction.id, page.interaction]));
  const stateFile = path.join(dataDir, 'state.json');
  const admissions = audienceAdmissions(dataDir, show.id);
  let media = null;
  const roles = ['display', 'presenter', 'audience'];
  const controllers = new Map();
  const online = { display: 0, presenter: 0, audience: 0 };
  let database;
  let databaseError = null;
  try { database = await openShowDatabase(dataDir); }
  catch (error) { databaseError = error.message; console.error("[database] Unable to open:", error.code ?? error.name); }
  const messages = database?.messages() || [];
  const votes = new Map();
  const privateCounts = new Map();
  for (const message of messages) if (message.private) privateCounts.set(message.interactionId, (privateCounts.get(message.interactionId) || 0) + 1);
  for (const vote of database?.votes() || []) {
    if (interactions.get(vote.interactionId)?.mode !== 'poll') continue;
    if (!votes.has(vote.interactionId)) votes.set(vote.interactionId, new Map());
    votes.get(vote.interactionId).set(vote.visitorId, vote.choice);
  }
  const rateBuckets = new Map();
  const blockedWords = (process.env.PRESENTATION_BLOCKED_WORDS || '傻逼,操你,妈的,去死').split(',').filter(Boolean);
  let state = { pageId: 'P0-02', revision: 0, startedAt: null, paused: false, pausedAt: null, blackout: false, interaction: null };
  try {
    const previous = JSON.parse(await readFile(stateFile, 'utf8'));
    if (pageIds.includes(previous.pageId)) state = {
      ...state,
      pageId: previous.pageId,
      revision: Number.isSafeInteger(previous.revision) && previous.revision >= 0 ? previous.revision : 0,
      startedAt: Number.isFinite(previous.startedAt) ? previous.startedAt : null,
      paused: previous.paused === true,
      pausedAt: Number.isFinite(previous.pausedAt) ? previous.pausedAt : null,
      blackout: previous.blackout === true,
      interaction: !show.endedAt && previous.interaction?.open === true && previous.interaction.deadline > Date.now() && interactions.has(previous.interaction.id) ? previous.interaction : null,
    };
  } catch { /* A first run starts with a clean stage. */ }

  // Page timing remains compatible with previous installations. Submissions and moderation are committed in SQLite.
  let persistChain = Promise.resolve(true);
  let persistenceError = null;
  function persist() {
    const data = JSON.stringify(state, null, 2);
    persistChain = persistChain.then(async () => {
      await mkdir(dataDir, { recursive: true });
      await writeFile(`${stateFile}.tmp`, data, { encoding: 'utf8', flush: true });
      await rename(`${stateFile}.tmp`, stateFile);
      persistenceError = null;
      return true;
    }).catch((error) => {
      persistenceError = '舞台状态未能保存到磁盘';
      console.error('[state] Persistence failed:', error.message);
      return false;
    });
    return persistChain;
  }
  if (show.endedAt && state.startedAt && !state.paused) { state.paused = true; state.pausedAt = show.endedAt; }
  const raffle = createRaffle(database);
  let raffleTimers = [];
  function scheduleReveals() {
    for (const timer of raffleTimers) clearTimeout(timer);
    raffleTimers = raffle.revealTimes().filter(time => time > Date.now()).map(time => setTimeout(() => {
      broadcast(); sendRaffleTickets();
    }, Math.max(0, time - Date.now()) + 15));
  }
  function sendRaffleTickets() {
    for (const client of io.sockets.values()) {
      if (client.data.role === 'audience') client.emit('raffle:ticket', raffle.ticket(client.data.visitorId));
    }
  }
  function publicState() {
    return { ...state, show, media, raffle: state.pageId === 'P8-20' ? raffle.view() : null, online: { ...online }, privateCount: state.interaction ? (privateCounts.get(state.interaction.id) || 0) : 0 };
  }
  function durable(operation, ack) {
    try {
      if (!database) throw new Error('Database unavailable');
      const result = operation(database);
      databaseError = null;
      return { result };
    } catch (error) {
      databaseError = error.code || error.name;
      console.error('[database] Write failed:', databaseError);
      ackReply(ack, { ok: false, code: 'STORAGE_UNAVAILABLE', error: '数据暂时无法保存，请稍后重试。' });
      return null;
    }
  }
  function publicMessages() { return messages.filter((message) => !message.private && !message.hidden); }
  function results() {
    return Object.fromEntries([...votes.entries()].map(([id, choices]) => {
      const counts = Array(interactions.get(id)?.options?.length || 0).fill(0);
      for (const choice of choices.values()) counts[choice] += 1;
      return [id, { total: choices.size, counts }];
    }));
  }
  function snapshot(socket) {
    refreshAuthorization(socket);
    socket.emit('snapshot', { state: publicState(), publicMessages: publicMessages(), results: results(), authorized: Boolean(socket.data.authorized), raffleTicket: socket.data.role === 'audience' ? raffle.ticket(socket.data.visitorId) : null, privateMessages: socket.data.role === 'presenter' && socket.data.authorized ? messages.filter((message) => message.private && !message.hidden) : [] });
  }
  function broadcast() { io.to('show').emit('state', publicState()); }
  let resultsTimer;
  function scheduleResults() {
    if (resultsTimer) return;
    // Batch the fan-out while committing and acknowledging each vote separately.
    resultsTimer = setTimeout(() => {
      resultsTimer = undefined;
      io.to('show').emit('results', results());
    }, 80).unref();
  }
  function bump() { state.revision += 1; const saved = persist(); broadcast(); return saved; }
  function ackReply(ack, payload) { if (typeof ack === 'function') ack(payload); }
  function record(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value)); }
  function invalid(ack, error = '请求格式不正确。') { return ackReply(ack, { ok: false, code: 'INVALID_PAYLOAD', error }); }
  function safeText(value, max = 60, multiline = false) {
    if (typeof value !== 'string') return '';
    return Array.from((multiline ? value : value.normalize('NFKC')).replace(/\r\n?/g, '\n').replace(multiline ? /[\u0000-\u0009\u000b-\u001f\u007f]/g : /[\u0000-\u001f\u007f<>]/g, '').trim()).slice(0, max).join('');
  }
  function controlAllowed(socket, ack) {
    refreshAuthorization(socket);
    if (!socket.data.authorized || !['display', 'presenter'].includes(socket.data.role)) {
      ackReply(ack, { ok: false, error: '请先输入演讲口令。' });
      return false;
    }
    return true;
  }
  function sameSecret(a, b) {
    const av = Buffer.from(a); const bv = Buffer.from(b);
    return av.length === bv.length && timingSafeEqual(av, bv);
  }
  function refreshAuthorization(socket) {
    if (socket.data.authorized && !(socket.data.authorizedUntil > Date.now())) {
      socket.data.authorized = false;
      socket.leave('presenters');
      socket.emit('authorization', { authorized: false, reason: '演讲授权已过期，请重新输入口令。' });
    }
  }
  function expireControllers() {
    const now = Date.now();
    for (const [token, controller] of controllers) if (controller.expiresAt <= now) controllers.delete(token);
    for (const socket of io.sockets.values()) refreshAuthorization(socket);
  }
  function closeExpired() {
    if (show.endedAt) return;
    if (state.interaction?.open && state.interaction.deadline <= Date.now()) {
      state.interaction.open = false;
      bump();
    }
  }
  function allowRate(key, max, interval) {
    const now = Date.now();
    const times = (rateBuckets.get(key) || []).filter((at) => at > now - interval);
    if (times.length >= max) return false;
    times.push(now); rateBuckets.set(key, times); return true;
  }

  function attach(socket) {
    socket.on('join', async (payload, ack) => {
      if (!record(payload) || !roles.includes(payload.role)) return invalid(ack);
      if (socket.data.joined) { snapshot(socket); return ackReply(ack, { ok: true, admitted: true, authorized: Boolean(socket.data.authorized) }); }
      const role = payload.role;
      if (role === 'audience' && show.endedAt) return ackReply(ack, endedReply);
      const audienceId = role === 'audience' ? await admissions.restore(socket.request.headers.cookie) : null;
      if (!socket.connected) return;
      if (role === 'audience' && show.endedAt) return ackReply(ack, endedReply);
      if (socket.data.joined) return ackReply(ack, { ok: true, admitted: true });
      if (role === 'audience' && !audienceId) return ackReply(ack, { ok: true, admitted: false });
      const visitorId = audienceId || ( typeof payload.visitorId === 'string' && /^[a-zA-Z0-9_-]{12,100}$/.test(payload.visitorId) ? payload.visitorId : randomBytes(12).toString('hex'));
      socket.data = { role, visitorId, joined: true, authorized: false };
      const existingController = typeof payload.controlToken === 'string' ? controllers.get(payload.controlToken) : null;
      if (role !== 'audience' && existingController?.role === role && existingController.expiresAt > Date.now()) {
        socket.data.authorized = true;
        socket.data.authorizedUntil = existingController.expiresAt;
        if (role === 'presenter') socket.join('presenters');
      }
      const host = role === 'presenter' ? hostAuth(socket.request.headers.cookie) : null;
      if (host) {
        socket.data.authorized = true;
        socket.data.authorizedUntil = host.expiresAt;
        socket.join('presenters');
      }
      socket.join('show'); online[role] += 1;
      closeExpired(); snapshot(socket); broadcast();
      ackReply(ack, { ok: true, admitted: true, authorized: Boolean(socket.data.authorized) });
    });
    socket.on('latency', (ack) => ackReply(ack, { ok: true }));
    socket.on('authenticate', (payload, ack) => {
      if (!record(payload) || typeof payload.pin !== 'string' || payload.pin.length < 1 || payload.pin.length > 128) return invalid(ack);
      if (!socket.data.joined || socket.data.role === 'audience') return ackReply(ack, { ok: false, error: '观众端没有控制权限。' });
      const identity = publicOrigin && ['127.0.0.1', '::ffff:127.0.0.1', '::1'].includes(socket.handshake.address)
        ? socket.handshake.headers['x-forwarded-for'] || socket.handshake.address : socket.handshake.address || socket.id;
      if (!hostRate(`auth:${identity}`, 10, 60000)) return ackReply(ack, { ok: false, error: '尝试过于频繁，请稍后再试。' });
      if (!sameSecret(payload.pin, pin)) return ackReply(ack, { ok: false, error: '演讲口令不正确。' });
      const token = randomBytes(24).toString('hex');
      const expiresAt = Date.now() + controlTtlMs;
      controllers.set(token, { role: socket.data.role, expiresAt }); socket.data.authorized = true; socket.data.authorizedUntil = expiresAt;
      if (socket.data.role === 'presenter') socket.join('presenters');
      ackReply(ack, { ok: true, controlToken: token, expiresAt }); snapshot(socket);
    });
    socket.on('control', (payload, ack) => {
      if (!record(payload) || typeof payload.action !== 'string') return invalid(ack);
      if (!controlAllowed(socket, ack)) return;
      if (show.endedAt) return ackReply(ack, endedReply);
      if (payload.expectedRevision !== undefined && (!Number.isSafeInteger(payload.expectedRevision) || payload.expectedRevision < 0)) return invalid(ack);
      if (payload.expectedRevision !== undefined && payload.expectedRevision !== state.revision) return ackReply(ack, { ok: false, code: 'REVISION_CONFLICT', error: '舞台已被另一控制端推进，请跟随最新状态。', revision: state.revision });
      const previousPage = state.pageId;

      if (['raffle:open', 'raffle:close', 'raffle:draw'].includes(payload.action)) {
        if (socket.data.role !== 'presenter' || state.pageId !== 'P8-20') return ackReply(ack, { ok: false, error: '请在谢幕后使用已授权的提词器。' });
        if (payload.action === 'raffle:open') raffle.open();
        if (payload.action === 'raffle:close') raffle.close();
        if (payload.action === 'raffle:draw') {
          const attempt = durable(() => raffle.draw(), ack);
          if (!attempt) return;
          if (!attempt.result.ok) return ackReply(ack, attempt.result);
          scheduleReveals();
        }
        broadcast();
        return ackReply(ack, { ok: true });
      }
      switch (payload.action) {
        case 'media:set': {
          if (socket.data.role !== 'display' || payload.pageId !== state.pageId || !filmPages.has(state.pageId) || typeof payload.playing !== 'boolean' || !Number.isFinite(payload.position) || payload.position < 0 || payload.position > 3600) return invalid(ack);
          media = { pageId: state.pageId, playing: payload.playing, position: payload.position, sampledAt: Date.now() };
          broadcast();
          return ackReply(ack, { ok: true });
        }
        case 'go': {
          if (!pageIds.includes(payload.pageId)) return ackReply(ack, { ok: false, error: '页面不存在。' });
          state.pageId = payload.pageId;
          break;
        }
        case 'next': state.pageId = pageIds[Math.min(pageIds.length - 1, pageIds.indexOf(state.pageId) + 1)]; break;
        case 'prev': state.pageId = pageIds[Math.max(1, pageIds.indexOf(state.pageId) - 1)]; break;
        case 'blackout': if (typeof payload.value !== 'boolean') return invalid(ack); state.blackout = payload.value; break;
        case 'start': state.startedAt = Date.now(); state.paused = false; state.pausedAt = null; break;
        case 'reset-timer': state.startedAt = null; state.paused = false; state.pausedAt = null; break;
        case 'pause': {
          if (typeof payload.value !== 'boolean') return invalid(ack);
          if (payload.value === state.paused) break;
          if (payload.value) { state.pausedAt = Date.now(); state.paused = true; }
          else { if (state.startedAt && state.pausedAt) state.startedAt += Date.now() - state.pausedAt; state.pausedAt = null; state.paused = false; }
          break;
        }
        case 'resume': {
          if (payload.expectedRevision === undefined || (payload.pageId === undefined && payload.blackout === undefined)) return invalid(ack);
          if (payload.pageId !== undefined && !pageIds.includes(payload.pageId)) return invalid(ack, '页面不存在。');
          if (payload.blackout !== undefined && typeof payload.blackout !== 'boolean') return invalid(ack);
          if (payload.pageId !== undefined) state.pageId = payload.pageId;
          if (payload.blackout !== undefined) state.blackout = payload.blackout;
          break;
        }
        case 'interaction:open': {
          const interaction = interactions.get(payload.id);
          if (!interaction) return ackReply(ack, { ok: false, error: '互动不存在。' });
          state.interaction = { id: payload.id, open: true, deadline: Date.now() + (interaction.seconds || 60) * 1000 };
          break;
        }
        case 'interaction:close': if (state.interaction) state.interaction.open = false; break;
        default: return ackReply(ack, { ok: false, error: '不支持的控制命令。' });
      }
      if (previousPage !== state.pageId) {
        if (previousPage === 'P8-20') raffle.close();
        media = null;
        const currentInteraction = pages.get(state.pageId)?.interaction;
        if (state.interaction && currentInteraction?.id !== state.interaction.id) state.interaction = null;
        if (automaticInteractions.has(state.pageId) && currentInteraction && !state.interaction) {
          state.interaction = { id: currentInteraction.id, open: true, deadline: Date.now() + currentInteraction.seconds * 1000 };
        }
      }
      const revision = state.revision + 1;
      void bump().then((persisted) => ackReply(ack, { ok: persisted, applied: true, persisted, revision, ...(persisted ? {} : { code: 'PERSISTENCE_FAILED', error: '控制已在本场生效，但磁盘保存失败。请检查服务端存储后重试保存。' }) }));
    });
    socket.on('submit', (payload, ack) => {
      if (!record(payload) || typeof payload.interactionId !== 'string') return invalid(ack);
      if (show.endedAt) return ackReply(ack, endedReply);
      closeExpired();
      if (!socket.data.joined || socket.data.role !== 'audience') return ackReply(ack, { ok: false, error: '请在观众端参与。' });
      const current = state.interaction;
      if (!current?.open) return ackReply(ack, { ok: false, error: '这次互动已结束。' });
      if (payload.interactionId !== current.id) return ackReply(ack, { ok: false, code: 'INTERACTION_CHANGED', error: '这一轮已经切换，这次投递没有被发送。请跟随当前互动。' });
      const interaction = interactions.get(current.id);
      if (!interaction) return ackReply(ack, { ok: false, error: '互动不可用。' });
      const visitorId = socket.data.visitorId;
      const requestId = typeof payload.requestId === 'string' && /^[a-zA-Z0-9-]{12,64}$/.test(payload.requestId) ? payload.requestId : null;
      if (requestId && interaction.mode !== 'poll') {
        const original = database?.receipt(visitorId, current.id, requestId);
        if (original) return ackReply(ack, { ok: true, id: original.id });
      }
      if (!allowRate(`submit:${visitorId}`, 1, 3000)) return ackReply(ack, { ok: false, error: '请稍候 3 秒再投递。' });
      if (interaction.mode === 'poll') {
        const choice = payload.choice;
        if (!Number.isInteger(choice) || choice < 0 || choice >= (interaction.options?.length || 0)) return ackReply(ack, { ok: false, error: '请选择一个选项。' });
        if (!votes.has(current.id)) votes.set(current.id, new Map());
        const ledger = votes.get(current.id);
        if (ledger.has(visitorId)) return ackReply(ack, { ok: false, error: '你已经选择过了。' });
        if (!durable(db => db.vote(current.id, visitorId, choice), ack)) return;
        ledger.set(visitorId, choice);
        scheduleResults();
        return ackReply(ack, { ok: true });
      }
      const postshow = current.id === 'postshow-letter';
      const max = postshow ? 600 : current.id === 'initial-impression' ? 30 : 60;
      const text = safeText(payload.text, max, postshow);
      if (!text) return ackReply(ack, { ok: false, error: '请先写下一句话。' });
      if (blockedWords.some((word) => text.includes(word))) return ackReply(ack, { ok: false, error: '这句话暂时无法投递，请换一种表达。' });
      const message = { id: randomBytes(8).toString('hex'), interactionId: current.id, text, emoji: safeText(payload.emoji, 4), createdAt: Date.now(), selected: false, hidden: false, private: interaction.mode === 'private' };
      if (!durable(db => db.message(message, visitorId, requestId), ack)) return;
      messages.push(message);
      if (message.private) {
        privateCounts.set(current.id, (privateCounts.get(current.id) || 0) + 1);
        expireControllers();
        io.to('presenters').emit('private:messages', messages.filter((item) => item.private && !item.hidden)); broadcast();
      } else io.to('show').emit('public:message', message);
      ackReply(ack, { ok: true, id: message.id });
    });
    socket.on('moderate', (payload, ack) => {
      if (!record(payload) || typeof payload.id !== 'string' || typeof payload.action !== 'string') return invalid(ack);
      if (show.endedAt) return ackReply(ack, endedReply);
      if (!controlAllowed(socket, ack)) return;
      if (socket.data.role !== 'presenter') return ackReply(ack, { ok: false, error: '请在提词器端管理投递。' });
      const message = messages.find((item) => item.id === payload.id);
      if (!message || !['select', 'hide', 'restore'].includes(payload.action)) return ackReply(ack, { ok: false, error: '未找到这条投递。' });
      const selected = payload.action === 'select' ? !message.selected : message.selected;
      const hidden = payload.action === 'select' ? message.hidden : payload.action === 'hide';
      if (!durable(db => db.moderate(message, payload.action, selected, hidden), ack)) return;
      Object.assign(message, { selected, hidden });
      if (message.private) { expireControllers(); io.to('presenters').emit('private:messages', messages.filter((item) => item.private && !item.hidden)); }
      else io.to('show').emit('public:messages', publicMessages());
      ackReply(ack, { ok: true });
    });
    socket.on('deck:get', (payload, ack) => {
      if (!record(payload)) return invalid(ack);
      if (!controlAllowed(socket, ack)) return;
      if (socket.data.role !== 'presenter') return ackReply(ack, { ok: false, error: '只有提词器可读取完整提词。' });
      ackReply(ack, { ok: true, pages: deck });
    });
    socket.on('disconnect', () => {
      if (socket.data.joined) { online[socket.data.role] = Math.max(0, online[socket.data.role] - 1); broadcast(); }
    });
  }

  function end(nextShow) {
    if (show.endedAt) return persist();
    show = nextShow;
    if (state.interaction) state.interaction = { ...state.interaction, open: false };
    if (state.startedAt && !state.paused) { state.paused = true; state.pausedAt = show.endedAt; }
    if (media?.playing) {
      media = { ...media, playing: false, position: media.position + (show.endedAt - media.sampledAt) / 1000, sampledAt: show.endedAt };
    }
    return bump();
  }
  function archive() {
    const draw = database?.readDraw();
    return {
      state: publicState(), messages, results: results(),
      raffle: draw ? { count: draw.pool.length, startedAt: draw.startedAt, winners: draw.winners.filter(winner => winner.revealAt <= Date.now()).map(winner => winner.code) } : null,
    };
  }
  return {
    attach, admissions, publicState, end, archive,
    revealInProgress: () => raffle.revealTimes().some(at => at > Date.now()),
    maintenance() {
      closeExpired();
      expireControllers();
      for (const [key, times] of rateBuckets) if (!times.some(time => time > Date.now() - 60000)) rateBuckets.delete(key);
    },
    healthy: () => databaseError === null && persistenceError === null,
    async close() { for (const timer of raffleTimers) clearTimeout(timer); await persistChain; database?.close(); },
  };
}
