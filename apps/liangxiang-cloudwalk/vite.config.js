import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    host: '127.0.0.1', port: 5180, strictPort: true,
    watch: { ignored: ['**/*.tmpdir', '**/*.tmpdir/**', '**/*.tmp'], usePolling: process.platform === 'win32', interval: 200 },
  },
  preview: { host: '127.0.0.1', port: 4180, strictPort: true },
  build: {
    rollupOptions: { output: { manualChunks: { three: ['three'] } } },
  },
});
