import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

export const DRACO_PREFIX = '/_legacy-draco/';
export const REMOTE_DRACO = 'https://www.gstatic.com/draco/versioned/decoders/1.5.5/';
export const DRACO_FILES = ['draco_decoder.js', 'draco_wasm_wrapper.js', 'draco_decoder.wasm'];
export const GAME_FILES = [
  'BGM.mp3', 'ClickMe.png', 'Entry.png', 'Genshin Impact [DoorComeout].mp3',
  'Genshin Impact [DoorThrough].mp3', 'Genshin Impact [Duang].mp3', 'Genshin.png', 'jump.png',
  'Login/DOOR.glb', 'Login/SM_BigCloud.glb', 'Login/SM_Light.glb',
  'Login/SM_Qiao01.glb', 'Login/SM_Qiao02.glb', 'Login/SM_Qiao03.glb', 'Login/SM_Qiao04.glb',
  'Login/SM_Road.glb', 'Login/SM_ZhuZi01.glb', 'Login/SM_ZhuZi02.glb', 'Login/SM_ZhuZi03.glb',
  'Login/SM_ZhuZi04.glb', 'Login/WHITE_PLANE.glb', 'Mouse.ani', 'Tex_0096.png', 'T_Mouse.png',
  'Login/Textures/Tex_0061.png', 'Login/Textures/Tex_0062.png', 'Login/Textures/Tex_0063.png',
  'Login/Textures/Tex_0067b.png', 'Login/Textures/Tex_0071.png', 'Login/Textures/Tex_0075.png',
  'Login/Textures/Tex_0077.png',
];
export function legacyAssets(root) {
  return [
    ...GAME_FILES.map(name => ({ fileName: 'Genshin/' + name, source: resolve(root, 'public/Genshin', name) })),
    ...DRACO_FILES.map(name => ({ fileName: '_legacy-draco/' + name, source: resolve(root, 'node_modules/three/examples/jsm/libs/draco/gltf', name) })),
    { fileName: '_legacy-draco/README.md', source: resolve(root, 'node_modules/three/examples/jsm/libs/draco/README.md') },
    { fileName: '_legacy-draco/LICENSE-APACHE-2.0.txt', source: resolve(root, 'scripts/licenses/Apache-2.0.txt') },
    { fileName: 'licenses/three-MIT.txt', source: resolve(root, 'node_modules/three/LICENSE') },
    { fileName: 'licenses/UPSTREAM-MIT.txt', source: resolve(root, 'LICENSE') },
    { fileName: 'licenses/LEGACY-NOTICE.txt', source: resolve(root, 'src/legacy/NOTICE.txt') },
    { fileName: 'logo.ico', source: resolve(root, 'public/logo.ico') },
  ];
}
export async function auditLegacyAssets(root) {
  const files = [];
  for (const entry of legacyAssets(root)) {
    const bytes = await readFile(entry.source);
    files.push({ path: entry.fileName, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  const upstream = resolve(root, 'src/libs/xviewer/xviewer.module.min.js');
  const source = await readFile(upstream, 'utf8');
  if (source.split(REMOTE_DRACO).length !== 2) throw new Error('Expected exactly one audited upstream Draco URL; review the decoder transform.');
  const upstreamLicensePresent = await stat(upstream + '.LICENSE.txt').then(() => true, () => false);
  return {
    entry: 'legacy.html', output: 'dist-legacy', publicationStatus: 'blocked-pending-third-party-rights-review',
    gameFiles: GAME_FILES.length, gameBytes: files.filter(file => file.path.startsWith('Genshin/')).reduce((total, file) => total + file.bytes, 0),
    upstreamBytes: Buffer.byteLength(source), upstreamLicensePresent, runtimeNetwork: 'same-origin assets only; explicit navigation uses validated exit policy', files,
  };
}

/** Only the preserved xviewer source is transformed; campus rendering and shared source stay untouched. */
export function legacySupport({ productionAssets = false } = {}) {
  let root = '';
  let development = false;
  return {
    name: 'isolated-original-genshin',
    enforce: 'pre',
    ...(productionAssets ? {} : { apply: 'serve' }),
    configResolved(config) { root = config.root; development = config.command === 'serve'; },
    transformIndexHtml(html) {
      return html.split('__LEGACY_HOME__').join(development ? 'http://127.0.0.1:8899/' : 'https://studentop.cn:14355/');
    },
    transform(source, id) {
      const path = id.split('?')[0].replaceAll('\\', '/');
      if (!path.endsWith('/src/libs/xviewer/xviewer.module.min.js')) return null;
      if (source.split(REMOTE_DRACO).length !== 2) this.error('Upstream Draco URL changed; refusing an unaudited external decoder.');
      return { code: '/* Local restoration: Draco decoder is served from the same origin; upstream source is not modified. */\n' + source.replace(REMOTE_DRACO, DRACO_PREFIX), map: null };
    },
    configureServer(server) {
      const routes = new Map(legacyAssets(root).filter(entry => entry.fileName.startsWith('_legacy-draco/')).map(entry => ['/' + entry.fileName, entry.source]));
      server.middlewares.use(async (req, res, next) => {
        let pathname;
        try { pathname = decodeURIComponent(new URL(req.url || '/', 'http://local.invalid').pathname); } catch { return next(); }
        if (!pathname.startsWith(DRACO_PREFIX)) return next();
        const file = routes.get(pathname);
        if (!file) { res.statusCode = 404; res.end('Unknown local decoder asset'); return; }
        if (req.method !== 'GET' && req.method !== 'HEAD') { res.statusCode = 405; res.end(); return; }
        try {
          const data = await readFile(file);
          res.setHeader('Content-Type', file.endsWith('.wasm') ? 'application/wasm' : file.endsWith('.js') ? 'application/javascript; charset=utf-8' : 'text/plain; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache'); res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
          res.statusCode = 200; res.end(req.method === 'HEAD' ? undefined : data);
        } catch { res.statusCode = 500; res.end('Required local decoder asset is missing'); }
      });
    },
    async generateBundle() {
      if (!productionAssets) return;
      const audit = await auditLegacyAssets(root);
      for (const entry of legacyAssets(root)) this.emitFile({ type: 'asset', fileName: entry.fileName, source: await readFile(entry.source) });
      this.emitFile({ type: 'asset', fileName: 'legacy-asset-manifest.json', source: JSON.stringify(audit, null, 2) + '\n' });
    },
  };
}
