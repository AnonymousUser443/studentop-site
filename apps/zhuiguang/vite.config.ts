import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ base: process.env.PRESENTATION_BASE || '/', plugins: [react()], server: { port: 5173, host: '0.0.0.0', proxy: { '/socket.io': { target: 'http://127.0.0.1:8787', ws: true }, '/api': 'http://127.0.0.1:8787' } }, build: { outDir: process.env.PRESENTATION_DIST || 'dist', chunkSizeWarningLimit: 650, rollupOptions: { output: { manualChunks: { react: ['react', 'react-dom'], motion: ['gsap'] } } } } });
