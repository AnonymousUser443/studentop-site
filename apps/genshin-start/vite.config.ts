import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { legacySupport } from './scripts/legacy-assets.mjs'

/** Keep historical game assets in source, never silently ship them in the new build. */
function campusPublicAssets(): Plugin {
  let root = ''
  const assets = [
    'campus-fallback.svg',
    'campus/fonts/noto-sans-sc.woff2',
    'campus/fonts/noto-serif-sc.woff2',
    'campus/fonts/OFL-NotoSansSC.txt',
    'campus/fonts/OFL-NotoSerifSC.txt',
  ]
  return {
    name: 'campus-public-allowlist',
    apply: 'build',
    configResolved(config) { root = config.root },
    async generateBundle() {
      for (const fileName of assets) {
        try {
          const source = await readFile(resolve(root, 'public', fileName))
          this.emitFile({ type: 'asset', fileName, source })
        } catch (error) {
          this.error('Missing required campus asset: ' + fileName + '. ' + String(error))
        }
      }
      this.emitFile({ type: 'asset', fileName: 'LICENSE.txt', source: await readFile(resolve(root, 'LICENSE')) })
    },
  }
}

export default defineConfig(({ command }) => ({
  // Production lives beside the native homepage; the existing original subdomain stays untouched.
  base: command === 'build' ? '/campus-entry/' : '/',
  plugins: [react(), legacySupport(), campusPublicAssets(), {
    name: 'campus-safe-html-exit',
    transformIndexHtml(html: string) {
      // The skip link and noscript remain usable before the application chunk loads.
      return html.split('__CAMPUS_EXIT__').join(command === 'serve'
        ? 'http://127.0.0.1:5174/' : 'https://liyun.studentop.cn:14355/')
    },
  }],
  server: {
    host: '127.0.0.1', port: 8081, strictPort: true,
    watch: { ignored: ['**/*.tmpdir', '**/*.tmpdir/**', '**/*.tmp'], usePolling: process.platform === 'win32', interval: 200 },
  },
  preview: { host: '127.0.0.1', port: 8081, strictPort: true },
  build: { target: 'es2020', chunkSizeWarningLimit: 650, copyPublicDir: false },
}))
