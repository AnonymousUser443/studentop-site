import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1', port: 5174, strictPort: true,
    allowedHosts: ['.trycloudflare.com'],
    watch: { usePolling: true, interval: 200,
      ignored: ['**/*.tmpdir', '**/*.tmpdir/**', '**/*.tmp', /(^|[/\\])[^/\\]*\.tmpdir([/\\]|$)/, /\.tmp$/] },
  },
  preview: { host: '127.0.0.1', port: 4174, strictPort: true },
});
