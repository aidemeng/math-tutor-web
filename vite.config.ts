import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * 移动端 PWA 配置。
 *
 * - 开发态把 /v1 代理到本地后端，浏览器看到的是同源请求，避免 CORS 与预检。
 * - 生产态通过 VITE_API_BASE_URL 指向真实 API（留空则使用同源相对路径）。
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:8787';

  return {
    server: {
      host: '127.0.0.1',
      port: 5173,
      proxy: {
        '/v1': { target: proxyTarget, changeOrigin: true },
        '/internal': { target: proxyTarget, changeOrigin: true },
      },
    },
    preview: { host: '127.0.0.1', port: 4173 },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icons/*.png'],
        manifest: {
          name: '数学备课助手',
          short_name: '备课助手',
          description: '面向数学老师的备课助手：找真题、出变式、降难度、看解析、做讲解视频。',
          lang: 'zh-CN',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#f5f6f4',
          theme_color: '#15704e',
          categories: ['education', 'productivity'],
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
          shortcuts: [
            { name: '开始备课', url: '/', description: '打开首页开始新的备课' },
            { name: '我的视频', url: '/videos', description: '查看讲解视频制作进度' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/v1\//, /^\/internal\//],
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            {
              // 题目配图、视频、照片：私有内容，网络优先，命中后短期缓存。
              urlPattern: ({ url, request }) =>
                request.method === 'GET' &&
                (url.pathname.startsWith('/v1/questions/') ||
                  url.pathname.startsWith('/v1/video-jobs/') ||
                  url.pathname.startsWith('/v1/conversations/')),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'tutor-media',
                networkTimeoutSeconds: 20,
                expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 3 },
                cacheableResponse: { statuses: [200] },
              },
            },
          ],
        },
        devOptions: { enabled: false },
      }),
    ],
    build: {
      target: 'es2022',
      sourcemap: false,
      chunkSizeWarningLimit: 900,
    },
  };
});
