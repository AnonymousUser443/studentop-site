import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * 分包策略（见 docs/UI-REFACTOR-PLAN-V2.md 3.3）：
 *  - vendor-react：React + Radix（Radix 强依赖 React，拆开会形成循环 chunk）
 *  - vendor-motion：framer-motion，首屏 HUD 过渡要用
 *  - vendor-p5 / vendor-gsap：环境层与时间轴，由页面动态 import 延后拉取
 */
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          // React 与 Radix 必须同块：Radix 反向引用 React，拆分会报 Circular chunk
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')
            || id.includes('/@radix-ui/') || id.includes('/@floating-ui/') || id.includes('/radix-ui/')
            || /\/(react-remove-scroll(?:-bar)?|react-style-singleton|use-callback-ref|use-sidecar|use-sync-external-store)\//.test(id)) {
            return 'vendor-react';
          }
          if (id.includes('/framer-motion/') || id.includes('/motion-dom/') || id.includes('/motion-utils/')) return 'vendor-motion';
          if (id.includes('/gsap/') || id.includes('/@gsap/')) return 'vendor-gsap';
          if (id.includes('/p5/')) return 'vendor-p5';
          if (id.includes('/zustand/')) return 'vendor-state';
          return 'vendor-misc';
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
  server: {
    host: '127.0.0.1', port: 5174, strictPort: true,
    allowedHosts: ['.trycloudflare.com'],
    proxy: { '/api': { target: 'http://127.0.0.1:8787', changeOrigin: true } },
    watch: { usePolling: true, interval: 200,
      ignored: ['**/*.tmpdir', '**/*.tmpdir/**', '**/*.tmp', /(^|[/\\])[^/\\]*\.tmpdir([/\\]|$)/, /\.tmp$/] },
  },
  preview: { host: '127.0.0.1', port: 4174, strictPort: true },
});
