import { defineConfig } from 'vite';
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/liyun-moyuan/' : '/',
  server: { host: '127.0.0.1', port: 5181, strictPort: true },
  preview: { host: '127.0.0.1', port: 4181, strictPort: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 1100 }
}));
