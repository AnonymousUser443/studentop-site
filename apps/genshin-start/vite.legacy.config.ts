import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import { legacySupport } from './scripts/legacy-assets.mjs'

export default defineConfig(({ command }) => ({
  plugins: [legacySupport({ productionAssets: true }), {
    name: 'legacy-safe-html-exit',
    transformIndexHtml(html: string) {
      return html.split('__CAMPUS_EXIT__').join(command === 'serve'
        ? 'http://127.0.0.1:5174/' : 'https://liyun.studentop.cn:14355/')
    },
  }],
  server: {
    host: '127.0.0.1', port: 8081, strictPort: true,
    watch: { ignored: ['**/*.tmpdir', '**/*.tmpdir/**', '**/*.tmp'], usePolling: process.platform === 'win32', interval: 200 },
  },
  preview: { host: '127.0.0.1', port: 8081, strictPort: true },
  build: {
    target: 'es2020', outDir: 'dist-legacy', copyPublicDir: false, emptyOutDir: true,
    rollupOptions: { input: fileURLToPath(new URL('./legacy.html', import.meta.url)) },
    chunkSizeWarningLimit: 1500,
  },
}))
