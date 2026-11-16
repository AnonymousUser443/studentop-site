/** Loopback-only preview. Synthetic fixture, dedicated SQLite and no production API calls. */
import { createServer as createViteServer } from 'vite';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStore } from '../server/store.mjs';
import { createApiServer } from '../server/server.mjs';

const app = fileURLToPath(new URL('../', import.meta.url));
const data = await mkdtemp(join(tmpdir(), 'liyun-paper-preview-'));
const store = openStore({ dataDir: data });
const api = createApiServer(store, { publicOrigin: null, production: false });
await new Promise((resolve, reject) => { api.once('error', reject); api.listen(0, '127.0.0.1', resolve); });
const target = 'http://127.0.0.1:' + api.address().port;
const vite = await createViteServer({
  root: app,
  server: {
    host: '127.0.0.1', port: Number(process.env.LIYUN_QA_PORT || 5224), strictPort: true,
    proxy: { '/api': { target }, '/api/content': { target }, '/api/editor': { target } },
  },
  plugins: [{
    name: 'paper-stage-preview',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/__paper-qa-phone') {
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end('<!doctype html><meta charset=utf-8><title>LIYUN QA · 667 × 375</title><body style="margin:0;overflow:hidden;background:#182b22"><iframe title="667px landscape viewport" src="/?qa=1" width="667" height="375" style="display:block;border:0"></iframe>');
        } else if (req.url === '/api/content/published') {
          res.setHeader('Content-Type', 'application/json');
          res.end('{"published":null}');
        } else next();
      });
    },
  }],
});
await vite.listen();
vite.printUrls();
for (const name of ['SIGINT', 'SIGTERM']) process.once(name, async () => {
  await vite.close();
  await new Promise(resolve => api.close(resolve));
  store.close();
  process.exit(0);
});
