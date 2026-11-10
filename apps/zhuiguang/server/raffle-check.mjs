import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { io } from 'socket.io-client';
import { openShowDatabase } from './show-database.mjs';
import { createTestShow } from './test-show.mjs';

const temp = await mkdtemp(join(tmpdir(), 'show-raffle-test-'));
const pin = 'rooms-fixture-only';
const port = 8798;
const origin = 'http://127.0.0.1:' + port;
const path = '/test/';
const base = origin + path;
let showId;
const clients = [];
const legacy = await openShowDatabase(temp);
legacy.message({ id:'prior-record', interactionId:'postshow-letter', text:'旧版归档保留', emoji:'', createdAt:Date.now(), private:true }, 'legacy-visitor', null);
legacy.close();
let service;
async function start() {
  service = spawn(process.execPath, ['server/index.mjs'], { env: {
    ...process.env, PORT: String(port), PRESENTATION_HOST: '127.0.0.1', PRESENTATION_BASE: path,
    PRESENTATION_PIN: pin, PRESENTATION_DATA_DIR: temp,
  }, stdio: 'ignore' });
  for (let i = 0; i < 100; i++) {
    try { const h = await fetch(base + 'api/health').then(r => r.json()); if (h.ok) return h; }
    catch {}
    await delay(100);
  }
  throw new Error('Test instance did not become ready');
}
async function stop() {
  for (const client of clients.splice(0)) client.disconnect();
  if (service?.exitCode === null && service.signalCode === null) { const exited = once(service, 'exit'); service.kill(); await exited; }
  service = undefined;
}
const ask = (socket, event, payload) => socket.timeout(4000).emitWithAck(event, payload);
const state = (id = showId) => fetch(base + 'api/rooms/' + id + '/state').then(r => r.json());
async function client(role, cookie, id = showId) {
  const socket = io(origin + '/show-' + id, { path: path + 'socket.io', transports: ['websocket'], reconnection: false, timeout: 3000,
    ...(cookie ? { extraHeaders: { Cookie: cookie } } : {}),
  });
  clients.push(socket);
  await once(socket, 'connect');
  return {socket, join: await ask(socket, 'join', { role })};
}
async function admit(i) {
  const response = await fetch(base + 'api/rooms/' + showId + '/entry', { method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({name:'测试同学 ' + i, studentNumber:String(99990000+i)}),
  });
  assert.equal(response.status, 200);
  const header = response.headers.get('set-cookie');
  assert.ok(header.startsWith('zhuiguang_entry_' + showId + '='));
  assert.match(header, /HttpOnly/i);
  return header.split(';')[0];
}

try {

  assert.equal((await start()).mode, 'rooms');
  const { show, cookie: manager } = await createTestShow(base.slice(0,-1), pin, '场次 A');
  const { show: other } = await createTestShow(base.slice(0,-1), pin, '场次 B');
  showId = show.id;
  assert.notEqual(show.id, other.id);
  const list = await fetch(base + 'api/rooms', { headers:{ Cookie: manager } }).then(r => r.json());
  const archived = list.shows.find(item => item.name === '旧版演讲记录');
  assert.ok(archived?.endedAt);
  const historical = await fetch(base + 'api/rooms/' + archived.id + '/archive', { headers:{Cookie:manager} }).then(r => r.json());
  assert.equal(historical.messages[0].id, 'prior-record');
  assert.equal((await fetch(base + 'api/rooms')).status, 401);
  assert.equal((await fetch(base + 'api/rooms/' + showId + '/archive')).status, 401);
  assert.equal((await client('presenter', manager)).join.authorized, true);
  const {socket:host} = await client('presenter');
  assert.equal((await ask(host,'authenticate',{pin:'wrong-host-pin'})).ok,false);
  assert.equal((await ask(host,'authenticate',{pin})).ok,true);
  const {socket:display} = await client('display');
  const {socket:separateStage} = await client('display', undefined, other.id);
  let crossRoomBroadcasts = 0;
  separateStage.on('state', () => crossRoomBroadcasts++);
  await ask(display,'authenticate',{pin});
  const control = async (action, extra = {}) => {
    const reply = await ask(host,'control',{action,...extra});
    assert.equal(reply.ok,true,JSON.stringify(reply));
  };
  assert.equal((await ask(host,'control',{action:'raffle:open'})).ok,false);
  const cookies = await Promise.all(Array.from({length:24},(_,i)=>admit(i)));
  const audience = await Promise.all(cookies.map(async cookie => {
    const {socket,join} = await client('audience',cookie);
    assert.equal(join.admitted,true);
    return socket;
  }));
  await control('go',{pageId:'P0-08'});
  for(const socket of audience) assert.equal((await ask(socket,'submit',{interactionId:'initial-impression',text:'测试互动'})).ok,true);
  await delay(3100);
  await control('go',{pageId:'P2-17'});
  await control('interaction:open',{id:'free-afternoon'});
  for(const socket of audience.slice(0,20)) assert.equal((await ask(socket,'submit',{interactionId:'free-afternoon',choice:0})).ok,true);
  await control('go',{pageId:'P8-20'});
  assert.equal((await state()).raffle,null);
  assert.equal((await ask(display,'control',{action:'raffle:open'})).ok,false);
  await control('raffle:open');
  assert.equal((await state()).raffle.count,20);
  const winningAudience=new Map();
  audience.forEach((socket,i)=>socket.on('raffle:ticket',code=>{if(code)winningAudience.set(i,code)}));
  await control('raffle:draw');
  assert.deepEqual((await state()).raffle.winners,[]);
  await delay(5100);
  const revealed=(await state()).raffle;
  assert.equal(new Set(revealed.winners).size,4);
  assert.equal(winningAudience.size,4);
  assert.ok([...winningAudience.keys()].every(index=>index<20));
  assert.deepEqual(new Set(winningAudience.values()),new Set(revealed.winners));
  assert.doesNotMatch(JSON.stringify(revealed),/visitorId|测试同学/);
  await control('raffle:close');
  assert.equal((await state()).raffle,null);
  await control('raffle:open');
  assert.deepEqual((await state()).raffle.winners,revealed.winners);
  assert.equal((await ask(host,'control',{action:'raffle:draw'})).ok,false);

  assert.equal(crossRoomBroadcasts,0);
  assert.equal((await client('audience', cookies[0], other.id)).join.admitted,false);
  assert.equal((await state(other.id)).pageId, 'P0-02');
  const endRequest = confirm => fetch(base + 'api/rooms/' + showId + '/end', {
    method:'POST',headers:{Cookie:manager,'Content-Type':'application/json'},body:JSON.stringify({confirm}),
  });
  assert.equal((await endRequest(false)).status,400);
  assert.equal((await endRequest(true)).status,200);
  const frozen=await state();
  assert.ok(frozen.show.endedAt);
  assert.equal(frozen.pageId,'P8-20');
  assert.equal(frozen.interaction.open,false);
  assert.equal((await ask(host,'control',{action:'prev'})).code,'SHOW_ENDED');
  assert.equal((await ask(audience[0],'submit',{interactionId:'postshow-letter',text:'已结束'})).code,'SHOW_ENDED');
  assert.equal((await client('audience',cookies[0])).join.code,'SHOW_ENDED');
  const stored = await fetch(base + 'api/rooms/' + showId + '/archive',{headers:{Cookie:manager}}).then(r=>r.json());
  assert.equal(stored.messages.length,24);
  assert.deepEqual(stored.raffle.winners,revealed.winners);
  await stop();
  assert.equal((await start()).mode,'rooms');
  assert.equal((await state()).show.endedAt,frozen.show.endedAt);
  assert.equal((await state()).pageId,'P8-20');
  assert.equal((await state(other.id)).show.endedAt,null);
  const restored = await openShowDatabase(join(temp,'rooms',showId));
  assert.equal(restored.messages().length,24);
  assert.deepEqual(restored.readDraw().winners.map(w=>w.code),revealed.winners);
  restored.close();
  await stop();
  console.log('OK: six-digit rooms, legacy archive, host authorization, independent scopes and cookies, 24-to-20 ranking, four private tickets, confirmed end, durable records on restart.');
} finally {
  await stop();
  await rm(temp,{recursive:true,force:true,maxRetries:3,retryDelay:80});
}
