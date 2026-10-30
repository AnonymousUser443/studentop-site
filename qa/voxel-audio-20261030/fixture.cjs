'use strict';
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const app = path.resolve(__dirname, '../../apps/liangxiang-cloudwalk');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.opus': 'audio/ogg', '.woff2': 'font/woff2', '.txt': 'text/plain' };

async function startFixture() {
  const requests = [], sockets = new Set(), timers = new Set();
  let policy = 'instant', sourceOverride = null;
  const later = (fn, ms) => {
    const timer = setTimeout(() => { timers.delete(timer); fn(); }, ms);
    timers.add(timer);
    return timer;
  };
  const html = `<!doctype html><html lang="en"><title>Isolated real Opus regression</title><link rel="icon" href="data:,"><body>
<button id="start">Start</button><button id="night">Night</button><button id="day">Day</button><button id="morning">Morning</button><button id="evening">Evening</button><button id="toggle">Toggle</button><button id="dispose">Dispose</button>
<script type="module">
import { CampusAudio } from '/src/audio.js';
window.audioErrors = [];
window.audio = new CampusAudio({ onError: message => audioErrors.push(message) });
document.querySelector('#start').onclick = () => audio.start();
for (const key of ['night', 'day', 'morning', 'evening']) document.getElementById(key).onclick = () => audio.setPeriod(key);
document.querySelector('#toggle').onclick = () => audio.toggle();
document.querySelector('#dispose').onclick = () => audio.dispose();
window.tapOutput = () => { window.audioTap = audio.context.createAnalyser(); audio.master.connect(audioTap); };
window.hasOutput = () => { if (!window.audioTap) return false; const a = new Float32Array(audioTap.fftSize); audioTap.getFloatTimeDomainData(a); return a.some(v => Math.abs(v) > 0.0001); };
window.bufferComplete = key => { const m = audio.tracks.get(key)?.media; return !!m && Number.isFinite(m.duration) && m.buffered.length === 1 && m.buffered.start(0) < .05 && m.buffered.end(0) >= m.duration - .05; };
</script></body></html>`;
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(html); return; }
    if (pathname === '/src/audio.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); res.end(sourceOverride || fs.readFileSync(path.join(app, 'src/audio.js'))); return; }
    let data, media = false, contentType = types[path.extname(pathname)] || 'application/octet-stream';
    if (/^\/bgm\/(day|night|dawn_dusk)\.opus$/.test(pathname)) { data = fs.readFileSync(path.join(app, pathname)); media = true; }
    else if (pathname.startsWith('/voxel-campus/')) {
      const relative = decodeURIComponent(pathname.slice('/voxel-campus/'.length)) || 'index.html';
      const filename = path.resolve(app, 'dist', relative);
      contentType = types[path.extname(filename)] || 'application/octet-stream';
      if (!filename.startsWith(path.join(app, 'dist') + path.sep)) { res.writeHead(403); res.end(); return; }
      try { data = fs.readFileSync(filename); media = filename.endsWith('.opus'); } catch { res.writeHead(404); res.end(); return; }
    } else { res.writeHead(404); res.end(); return; }
    const entry = { file: pathname, range: req.headers.range || null, at: Date.now(), closedAt: null, endedAt: null, bytes: 0 };
    if (media) requests.push(entry);
    res.on('close', () => { entry.closedAt = Date.now(); });
    const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    let first = 0, last = data.length - 1;
    if (match) {
      if (!match[1] && match[2]) first = Math.max(0, data.length - Number(match[2]));
      else { first = Number(match[1]); if (match[2]) last = Math.min(last, Number(match[2])); }
      if (first > last || first >= data.length) { res.writeHead(416, { 'Content-Range': `bytes */${data.length}` }); res.end(); return; }
    }
    const localPolicy = media ? policy : 'instant';
    const send = () => {
      if (res.destroyed) return;
      if (localPolicy === 'fail') { res.writeHead(503); res.end(); entry.endedAt = Date.now(); return; }
      res.writeHead(match ? 206 : 200, { 'Content-Type': contentType, 'Content-Length': last - first + 1, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store', ...(match ? { 'Content-Range': `bytes ${first}-${last}/${data.length}` } : {}) });
      let offset = first;
      const chunk = () => {
        if (res.destroyed) return;
        const end = localPolicy === 'stream' ? Math.min(offset + 8192, last + 1) : last + 1;
        res.write(data.subarray(offset, end)); entry.bytes += end - offset; offset = end;
        if (offset > last) { res.end(); entry.endedAt = Date.now(); }
        else later(chunk, 150);
      };
      chunk();
    };
    if (localPolicy === 'hold') later(send, 30000);
    else if (localPolicy === 'delay') later(send, 700);
    else send();
  });
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return {
    origin: 'http://127.0.0.1:' + server.address().port,
    requests,
    configure(value, source = null) { policy = value; sourceOverride = source; },
    async close() {
      for (const timer of timers) clearTimeout(timer);
      for (const socket of sockets) socket.destroy();
      await new Promise(resolve => server.close(resolve));
    },
  };
}
module.exports = { startFixture };
