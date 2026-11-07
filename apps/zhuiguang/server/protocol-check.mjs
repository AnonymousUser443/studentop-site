import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { readFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { io } from 'socket.io-client';
import { createTestShow } from './test-show.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PROTOCOL_TEST_PORT || 8791);
const pin = 'test-only-presentation-pin';
const base = `http://127.0.0.1:${port}`;
const testData = await mkdtemp(path.join(tmpdir(), 'zhuiguang-protocol-'));
const testEnv = { ...process.env, PRESENTATION_HOST: '127.0.0.1', PRESENTATION_PIN: pin, PRESENTATION_DATA_DIR: testData };
const server = spawn(process.execPath, ['server/index.mjs'], { cwd: root, env: { ...testEnv, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
let serverOutput = '';
server.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
server.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });
const clients = [];
const auxiliaryServers = [];
const skipLoad = process.argv.includes('--skip-load');
let showId;
const namespace = url => url + '/show-' + showId;
const roomState = (url = base) => fetch(url + '/api/rooms/' + showId + '/state').then(response => response.json());
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let nextStudent = 9900000000;
async function admit(url, name = '复核测试', studentNumber = String(nextStudent++)) {
  const response = await fetch(`${url}/api/rooms/${showId}/entry`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, studentNumber }) });
  return { response, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
async function connected(role, visitorId, url = base) {
  const entry = role === 'audience' ? await admit(url) : undefined;
  const cookie = entry?.cookie;
  if (entry && !cookie) throw new Error('Audience entry HTTP ' + entry.response.status + ' ' + await entry.response.text());
  const socket = io(namespace(url), { autoConnect: false, transports: ['websocket'], reconnection: false, timeout: 10000, extraHeaders: cookie ? { Cookie: cookie } : undefined });
  clients.push(socket);
  await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); socket.connect(); });
  const snapshot = new Promise((resolve) => socket.once('snapshot', resolve));
  await command(socket, 'join', { role, visitorId });
  const first = await snapshot;
  return { socket, first };
}
function command(socket, name, payload) {
  return new Promise((resolve, reject) => socket.timeout(10000).emit(name, payload, (error, reply) => error ? reject(new Error(name + " acknowledgement failed for " + socket.nsp, {cause: error})) : resolve(reply)));
}
async function health() { const response = await fetch(`${base}/api/health`); return response.json(); }
async function auxiliary(offset, extraEnv = {}) {
  const auxiliaryPort = port + offset;
  const processHandle = spawn(process.execPath, ['server/index.mjs'], { cwd: root, env: { ...testEnv, PORT: String(auxiliaryPort), ...extraEnv }, stdio: 'ignore' });
  auxiliaryServers.push(processHandle);
  const url = `http://127.0.0.1:${auxiliaryPort}`;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { if ((await fetch(`${url}/api/health`)).ok) return { processHandle, url }; } catch { /* Wait for listen. */ }
    if (processHandle.exitCode !== null) throw new Error('Auxiliary server failed to start');
    await delay(50);
  }
  throw new Error('Auxiliary server startup timeout');
}
try {
  let running = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { if ((await health()).ok) { running = true; break; } } catch { /* Wait for the child process to listen. */ }
    await delay(100);
  }
  assert.ok(running, 'Server starts');
  ({show:{id:showId}} = await createTestShow(base, pin, '协议回归'));
  const unjoined = io(namespace(base), { autoConnect: false, transports: ['websocket'], reconnection: false }); clients.push(unjoined);
  await new Promise((resolve) => { unjoined.once('connect', resolve); unjoined.connect(); });
  for (const malformed of [null, [], true, 42, 'text']) assert.equal((await command(unjoined, 'join', malformed)).code, 'INVALID_PAYLOAD');
  assert.equal((await health()).ok, true);
  assert.equal((await command(unjoined, 'join', { role: 'audience' })).admitted, false);
  const entry = await admit(base, '复核入场', '9999999911');
  assert.equal(entry.response.status, 200);
  assert.match(entry.response.headers.get('set-cookie'), /HttpOnly/);
  assert.equal((await admit(base, '其他姓名', '9999999911')).response.status, 409);
  const restoredAdmission = await admit(base, '复核入场', '9999999911');
  assert.equal(restoredAdmission.cookie?.split('.')[0], entry.cookie?.split('.')[0]);
  const audience = await connected('audience', 'audience-device-0001');
  const display = await connected('display', 'display-device-00001');
  const presenter = await connected('presenter', 'presenter-device-0001');
  assert.equal((await command(audience.socket, 'control', { action: 'go', pageId: 'P4-04' })).ok, false);
  assert.equal((await command(audience.socket, 'authenticate', { pin })).ok, false);
  assert.equal((await command(display.socket, 'control', { action: 'next' })).ok, false);
  assert.equal((await command(display.socket, 'authenticate', { pin: 'wrong' })).ok, false);
  const displayAuth = await command(display.socket, 'authenticate', { pin });
  assert.equal(displayAuth.ok, true);
  const authenticated = await command(presenter.socket, 'authenticate', { pin });
  assert.ok(authenticated.controlToken);
  for (const event of ['authenticate', 'control', 'submit', 'moderate', 'deck:get']) {
    for (const malformed of [null, [], true, 42, 'text']) assert.equal((await command(presenter.socket, event, malformed)).code, 'INVALID_PAYLOAD');
  }
  for (const invalidPin of [{ toString: null }, [], 123, null]) assert.equal((await command(presenter.socket, 'authenticate', { pin: invalidPin })).code, 'INVALID_PAYLOAD');
  assert.equal((await health()).ok, true);
  const publicDeck = await fetch(`${base}/api/deck`).then((response) => response.json());
  assert.equal(publicDeck.pages.length, 169); assert.equal('speakerNotes' in publicDeck.pages[0], false);
  assert.equal((await command(audience.socket, 'deck:get', {})).ok, false);
  assert.equal((await command(display.socket, 'deck:get', {})).ok, false);
  assert.equal(typeof (await command(presenter.socket, 'deck:get', {})).pages[0].speakerNotes, 'string');
  assert.equal((await command(presenter.socket, 'control', { action: 'go', pageId: 'not-a-slide' })).ok, false);
  await command(presenter.socket, 'control', { action: 'go', pageId: 'P1-03' });
  assert.equal((await roomState()).interaction?.id, 'private-letter');
  let displayPrivate = false; let audiencePrivate = false; let presenterPrivate = [];
  display.socket.on('private:messages', () => { displayPrivate = true; });
  audience.socket.on('private:messages', () => { audiencePrivate = true; });
  presenter.socket.on('private:messages', (messages) => { presenterPrivate = messages; });
  assert.equal((await command(audience.socket, 'submit', { interactionId: 'private-letter', text: '只给演讲者看的测试信' })).ok, true);
  await delay(30);
  assert.equal(presenterPrivate.length, 1);
  assert.equal(displayPrivate, false); assert.equal(audiencePrivate, false);
  const late = await connected('audience', 'audience-device-late1');
  assert.equal(late.first.state.pageId, 'P1-03'); assert.deepEqual(late.first.privateMessages, []);
  assert.equal(JSON.stringify(late.first).includes('只给演讲者'), false);
  const roleAttempt = io(namespace(base), { autoConnect: false, transports: ['websocket'], reconnection: false }); clients.push(roleAttempt);
  await new Promise((resolve) => { roleAttempt.once('connect', resolve); roleAttempt.connect(); });
  const roleSnapshot = new Promise((resolve) => roleAttempt.once('snapshot', resolve));
  await command(roleAttempt, 'join', { role: 'presenter', visitorId: 'role-change-test-0001', controlToken: displayAuth.controlToken });
  const rejectedRole = await roleSnapshot;
  assert.equal(rejectedRole.authorized, false); assert.deepEqual(rejectedRole.privateMessages, []);
  await command(presenter.socket, 'control', { action: 'go', pageId: 'P0-08' });
  assert.equal((await roomState()).interaction?.id, 'initial-impression');
  await command(presenter.socket, 'control', { action: 'interaction:open', id: 'initial-impression' });
  const leakedMessages = [];
  display.socket.on('public:message', (message) => leakedMessages.push(message));
  const staleLetter = await command(late.socket, 'submit', { interactionId: 'private-letter', text: '旧表单私密内容禁止出现在公屏' });
  assert.equal(staleLetter.ok, false); assert.equal(staleLetter.code, 'INTERACTION_CHANGED');
  assert.equal((await command(late.socket, 'submit', { text: '缺少互动ID的旧客户端也必须拒绝' })).code, 'INVALID_PAYLOAD');
  await delay(30); assert.equal(leakedMessages.length, 0);
  await command(presenter.socket, 'control', { action: 'interaction:open', id: 'free-afternoon' });
  assert.equal((await command(late.socket, 'submit', { interactionId: 'free-afternoon', choice: 0 })).ok, true);
  assert.equal((await command(late.socket, 'submit', { interactionId: 'free-afternoon', choice: 1 })).ok, false);
  await delay(3100);
  const repeatedVote = await command(late.socket, 'submit', { interactionId: 'free-afternoon', choice: 1 });
  assert.equal(repeatedVote.ok, false); assert.match(repeatedVote.error, /已经选择/);
  await command(presenter.socket, 'control', { action: 'interaction:close' });
  assert.equal((await command(audience.socket, 'submit', { interactionId: 'free-afternoon', choice: 2 })).ok, false);
  await command(presenter.socket, 'control', { action: 'go', pageId: 'P4-04' });
  const rejoined = await connected('presenter', 'presenter-reconnect-1');
  assert.equal(rejoined.first.authorized, false);
  rejoined.socket.disconnect();
  const reconnectSocket = io(namespace(base), { autoConnect: false, transports: ['websocket'], reconnection: false }); clients.push(reconnectSocket);
  await new Promise((resolve) => { reconnectSocket.once('connect', resolve); reconnectSocket.connect(); });
  const restored = new Promise((resolve) => reconnectSocket.once('snapshot', resolve));
  await command(reconnectSocket, 'join', { role: 'presenter', visitorId: 'presenter-reconnect-2', controlToken: authenticated.controlToken });
  const restoredState = await restored;
  assert.equal(restoredState.authorized, true); assert.equal(restoredState.state.pageId, 'P4-04'); assert.equal(restoredState.privateMessages.length, 1);
  // Twenty acknowledged page commands are never silently dropped by the server.
  await command(presenter.socket, 'control', { action: 'go', pageId: 'P0-02' });
  for (let index = 0; index < 20; index += 1) await command(presenter.socket, 'control', { action: 'next' });
  const current = await roomState();
  assert.equal(current.pageId, 'P1-04');
  const racing = await Promise.all([
    command(presenter.socket, 'control', { action: 'resume', expectedRevision: current.revision, pageId: 'P4-04', blackout: true }),
    command(display.socket, 'control', { action: 'resume', expectedRevision: current.revision, pageId: 'P0-02', blackout: false }),
  ]);
  assert.equal(racing.filter((reply) => reply.ok).length, 1); assert.equal(racing.filter((reply) => reply.code === 'REVISION_CONFLICT').length, 1);
  const winner = racing.findIndex((reply) => reply.ok);
  assert.equal(racing[winner].persisted, true); assert.equal(racing[winner].revision, current.revision + 1);
  const afterConflict = await roomState();
  assert.equal(afterConflict.pageId, winner === 0 ? 'P4-04' : 'P0-02'); assert.equal(afterConflict.blackout, winner === 0);
  await command(presenter.socket, 'control', { action: 'blackout', value: false });
  await command(presenter.socket, 'control', { action: 'start' });
  await command(presenter.socket, 'control', { action: 'pause', value: true });
  const reset = await command(presenter.socket, 'control', { action: 'reset-timer' });
  assert.equal(reset.ok, true); assert.equal(reset.persisted, true);
  const afterReset = await roomState();
  assert.equal(afterReset.startedAt, null); assert.equal(afterReset.pausedAt, null); assert.equal(afterReset.paused, false);
  const savedState = JSON.parse(await readFile(path.join(testData, 'rooms', showId, 'state.json'), 'utf8'));
  assert.equal(savedState.pageId, afterReset.pageId); assert.equal(savedState.revision, reset.revision); assert.equal(savedState.startedAt, null);

  await command(presenter.socket, 'control', { action: 'go', pageId: 'P8-19' });
  await command(presenter.socket, 'control', { action: 'next' });
  const postshow = await roomState();
  assert.equal(postshow.pageId, 'P8-20');
  assert.equal(postshow.interaction.id, 'postshow-letter');
  const letterText = '谢谢学长，祝演讲顺利。\n我还想试试社团。';
  const letter = { interactionId: 'postshow-letter', text: letterText, requestId: 'finale-retry-test-0001' };
  const receipt = await command(audience.socket, 'submit', letter);
  assert.equal(receipt.ok, true);
  assert.equal((await command(audience.socket, 'submit', letter)).id, receipt.id);
  assert.equal(displayPrivate, false); assert.equal(audiencePrivate, false);
  assert.equal(JSON.stringify(await roomState()).includes(letterText), false);
  const db = new DatabaseSync(path.join(testData, 'rooms', showId, 'audience.sqlite'), { readOnly: true });
  assert.equal(db.prepare("SELECT count(*) AS n FROM messages WHERE interaction_id='postshow-letter'").get().n, 1);
  assert.equal(db.prepare("SELECT event FROM audit WHERE target=?").get(receipt.id).event, 'message');
  db.close();
  const restarted = await auxiliary(1, { PRESENTATION_CONTROL_TTL_MS: '250' });
  const coldAudience = await connected('audience', 'cold-runtime-audience1', restarted.url);
  assert.equal(coldAudience.first.state.pageId, 'P8-20'); assert.equal(coldAudience.first.state.interaction.id, 'postshow-letter'); assert.deepEqual(coldAudience.first.privateMessages, []); assert.deepEqual(coldAudience.first.results['free-afternoon'].counts, [1, 0, 0, 0, 0].slice(0, publicDeck.pages.find(page => page.interaction?.id === 'free-afternoon').interaction.options.length));
  assert.equal(coldAudience.first.state.privateCount, 1);
  assert.equal(JSON.stringify(coldAudience.first).includes(letterText), false);
  const expiringPresenter = await connected('presenter', 'expiring-presenter-001', restarted.url);
  const recoveredInbox = new Promise(resolve => expiringPresenter.socket.once('snapshot', resolve));
  assert.equal((await command(expiringPresenter.socket, 'authenticate', { pin })).ok, true);
  assert.equal((await recoveredInbox).privateMessages.find(message => message.id === receipt.id)?.text, letterText);
  await command(expiringPresenter.socket, 'control', { action: 'interaction:open', id: 'private-letter' });
  let expiredPrivate = false; expiringPresenter.socket.on('private:messages', () => { expiredPrivate = true; });
  await delay(300);
  assert.equal((await command(expiringPresenter.socket, 'control', { action: 'next' })).ok, false);
  assert.equal((await command(coldAudience.socket, 'submit', { interactionId: 'private-letter', text: '授权过期后不应再推送的信' })).ok, true);
  await delay(30); assert.equal(expiredPrivate, false);
  restarted.processHandle.kill();
  const blockedDir = path.join(testData, 'rooms', showId, 'state.json.tmp');
  await mkdir(blockedDir);
  const brokenStorage = await auxiliary(2);
  const storagePresenter = await connected('presenter', 'storage-test-presenter1', brokenStorage.url);
  assert.equal((await command(storagePresenter.socket, 'authenticate', { pin })).ok, true);
  const unsaved = await command(storagePresenter.socket, 'control', { action: 'go', pageId: 'P4-04' });
  assert.equal(unsaved.ok, false); assert.equal(unsaved.applied, true); assert.equal(unsaved.persisted, false); assert.equal(unsaved.code, 'PERSISTENCE_FAILED');
  assert.equal((await roomState(brokenStorage.url)).pageId, 'P4-04');
  assert.equal((await fetch(`${brokenStorage.url}/api/health`).then((response) => response.json())).persistence.ok, false);
  brokenStorage.processHandle.kill();
  await rm(blockedDir, { recursive: true, force: true });
  let loadMs = null;
  if (!skipLoad) {
  await command(presenter.socket, 'control', { action: 'go', pageId: 'P4-23' });
  await command(presenter.socket, 'control', { action: 'interaction:open', id: 'ddl' });
  const started = performance.now();
  const viewers = await Promise.all(Array.from({ length: 500 }, (_, index) => connected('audience', `load-audience-${String(index).padStart(5, '0')}`)));
  const submissions = await Promise.all(viewers.map(({ socket }, index) => command(socket, 'submit', { interactionId: 'ddl', choice: index % 4 })));
  assert.equal(submissions.filter((result) => result.ok).length, 500);
  const afterLoad = await connected('audience', 'post-load-audience-01');
  assert.equal(afterLoad.first.results.ddl.total, 500);
  assert.deepEqual(afterLoad.first.results.ddl.counts, [125, 125, 125, 125]);
  loadMs = Math.round(performance.now() - started);
  }
  console.log(JSON.stringify({ ok: true, pages: (await health()).pages, checks: ['unregistered audience excluded; HttpOnly admission and same-identity recovery', 'P0-08 and P1-03 automatically open', 'null/array/primitive event payloads rejected without crash', 'object pin rejected without coercion', 'audience control denied', 'display control requires authentication', 'invalid page rejected', 'private messages presenter-only', 'late join snapshot', 'display token cannot become presenter', 'stale private form cannot publish into next interaction', 'missing interactionId rejected', 'repeat vote denied after rate-limit expires', 'closed interaction denied', 'reconnect token restores role', '20 consecutive next commands', 'atomic revision CAS', 'reset-timer clears paused and active timer', 'control ack waits for persisted file', 'cold runtime restores postshow round and private letters; no public leakage; one receipt per retry', 'active expired presenter cannot control or receive letters', 'storage failure explicitly returns applied true persisted false', 'public deck excludes notes and presenter deck requires auth', ...(!skipLoad ? ['500 concurrent audiences submit'] : [])], audienceCount: skipLoad ? null : 500, loadMs }, null, 2));
} catch (error) {
  console.error(error);
  // Do not print the child's startup output: it contains the presentation PIN.
  if (server.exitCode !== null) console.error('Test server exit code:', server.exitCode);
  process.exitCode = 1;
} finally {
  for (const socket of clients) socket.disconnect();
  for (const processHandle of auxiliaryServers) processHandle.kill();
  if (server.exitCode === null && server.signalCode === null) {
    const exited = new Promise(resolve => server.once('exit', resolve));
    server.kill(); await exited;
  }
  await rm(testData, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
