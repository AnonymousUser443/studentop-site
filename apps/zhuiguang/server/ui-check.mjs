import { io } from 'socket.io-client';

// Operator-only UI test helper. The control PIN is read from the environment,
// never persisted or printed. Browser interactions are performed with OpenCLI.
const base = (process.env.UI_BASE || 'http://127.0.0.1:8787').replace(/\/$/, '');
const showId = process.env.UI_SHOW;
if (!/^\d{6}$/.test(showId || '')) throw new Error('Set UI_SHOW to a six-digit show code');
const location = new URL(base);
const socket = io(location.origin + '/show-' + showId, { path: location.pathname.replace(/\/$/, '') + '/socket.io', autoConnect: false, transports: ['websocket'], reconnection: false });
function emit(event, payload) { return new Promise((resolve, reject) => socket.timeout(10000).emit(event, payload, (error, reply) => error ? reject(error) : resolve(reply))); }
try {
  await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); socket.connect(); });
  await emit('join', { role: 'presenter', visitorId: 'operator-ui-check-session' });
  const authorized = await emit('authenticate', { pin: process.env.UI_PIN });
  if (!authorized.ok) throw new Error(authorized.error || 'Authentication failed');
  const [action, value] = process.argv.slice(2);
  let reply;
  if (action === 'go') reply = await emit('control', { action: 'go', pageId: value });
  else if (action === 'open') reply = await emit('control', { action: 'interaction:open', id: value });
  else if (action === 'close') reply = await emit('control', { action: 'interaction:close' });
  else if (action === 'start') reply = await emit('control', { action: 'start' });
  else if (action === 'restore') {
    await emit('control', { action: 'interaction:close' });
    await emit('control', { action: 'go', pageId: 'P0-02' });
    await emit('control', { action: 'blackout', value: false });
    reply = await emit('control', { action: 'reset-timer' });
  } else throw new Error('Use go PAGE | open ID | close | start | restore');
  const state = await fetch(`${base}/api/rooms/${showId}/state`).then((response) => response.json());
  console.log(JSON.stringify({ ok: reply.ok, error: reply.error, state }));
  if (!reply.ok) process.exitCode = 1;
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { socket.disconnect(); }
